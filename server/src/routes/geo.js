const express = require('express');
const router = express.Router();
const axios = require('axios');
const { findDistrictFromCoordinates, isGeoJSONLoaded } = require('../utils/geospatial');
const MgnregaRecord = require('../models/MgnregaRecord');

/**
 * Reverse geocoding using OpenStreetMap Nominatim API (free, no API key needed)
 */
async function reverseGeocode(lat, lon) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon,
        format: 'json',
        addressdetails: 1,
        'accept-language': 'en',
      },
      headers: {
        'User-Agent': 'OurVoiceOurRights/1.0', // Required by Nominatim
      },
      timeout: 5000,
    });

    if (response.data && response.data.address) {
      const address = response.data.address;
      const state = address.state || address.region || '';
      
      // Better district extraction - prioritize county/district over city/town
      // For Indian addresses, county often contains the district name
      let district = '';
      
      // Priority order for district extraction:
      // 1. county (often contains district name in India)
      // 2. district (explicit district field)
      // 3. city (major cities like Ahmedabad, Mumbai)
      // 4. town (smaller cities)
      
      if (address.county) {
        // County might contain "Ahmedabad District" or just "Ahmedabad"
        district = address.county.replace(/\s*District\s*/i, '').trim();
      } else if (address.district) {
        district = address.district;
      } else if (address.city) {
        district = address.city;
      } else if (address.town) {
        district = address.town;
      } else if (address.village) {
        district = address.village;
      }
      
      // Special handling: If we got a locality (like "Vejalpur") but no major district,
      // and we have a city, use the city as district
      // This handles cases where OSM returns neighborhoods instead of districts
      if (address.city && address.city !== district) {
        // If city exists and is different from district, and district seems like a locality
        const majorCities = ['Ahmadabad', 'Mumbai', 'Delhi', 'Bangalore', 'Kolkata', 'Chennai', 'Hyderabad', 'Pune', 'Jaipur'];
        if (majorCities.some(city => address.city.toLowerCase().includes(city.toLowerCase()))) {
          district = address.city;
        }
      }
      
      if (district && state) {
        return { 
          district: district.trim(), 
          state: state.trim(), 
          source: 'reverse-geocoding', 
          accuracy: 'medium',
          rawAddress: address // Keep raw address for debugging
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    return null;
  }
}

/**
 * GET /api/v1/geo/district?lat=&lon=
 * Maps lat/lon to district using GeoJSON + turf.js or reverse geocoding fallback
 */
router.get('/district', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        error: 'Valid lat and lon parameters are required',
      });
    }

    // Validate lat/lon range
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lat/lon coordinates',
      });
    }

    let result = null;
    let source = 'unknown';

    // Try GeoJSON first (more accurate)
    if (isGeoJSONLoaded()) {
      result = findDistrictFromCoordinates(lat, lon);
      if (result && result.state && result.district) {
        source = 'geojson';
      }
    }

    // Fallback to reverse geocoding if GeoJSON not available or didn't find result
    if (!result || !result.state || !result.district) {
      console.log('Using reverse geocoding fallback...');
      const geocodeResult = await reverseGeocode(lat, lon);
      if (geocodeResult && geocodeResult.state && geocodeResult.district) {
        // Try to match with database districts for better accuracy
        const dbMatch = await MgnregaRecord.findOne({
          state: new RegExp(`^${geocodeResult.state}$`, 'i'),
          district: new RegExp(`^${geocodeResult.district}$`, 'i'),
        }).lean();

        if (dbMatch) {
          result = {
            district: dbMatch.district,
            state: dbMatch.state,
            source: 'reverse-geocoding-db-matched',
            accuracy: 'high',
          };
        } else {
          // If no exact match, try multiple strategies (prioritize city-based matching):
          
          // Strategy 1: Check if we have a city that might be the actual district
          let fuzzyDistrict = null;
          let matchedFromCity = false;
          
          if (geocodeResult.rawAddress) {
            const address = geocodeResult.rawAddress;
            const city = address.city || address.town;
            
            // If we have a city and it's different from the district we got
            // (likely means district is a locality/sub-area), try matching city to district
            if (city && city.toLowerCase() !== geocodeResult.district.toLowerCase()) {
              fuzzyDistrict = await MgnregaRecord.findOne({
                state: new RegExp(`^${geocodeResult.state}$`, 'i'),
                district: new RegExp(`^${city}$`, 'i'),
              })
                .select('state district')
                .sort({ createdAt: -1 })
                .lean();
              
              if (fuzzyDistrict) {
                matchedFromCity = true;
                result = {
                  district: fuzzyDistrict.district,
                  state: fuzzyDistrict.state,
                  source: 'reverse-geocoding-city-matched',
                  accuracy: 'high',
                  note: `Matched city "${city}" to district "${fuzzyDistrict.district}" (ignored locality "${geocodeResult.district}")`,
                };
              }
            }
          }

          // Strategy 2: If city matching failed, try fuzzy match with district name in same state
          if (!fuzzyDistrict && !result) {
            fuzzyDistrict = await MgnregaRecord.findOne({
              state: new RegExp(`^${geocodeResult.state}$`, 'i'),
              district: new RegExp(geocodeResult.district.split(' ')[0], 'i'),
            })
              .select('state district')
              .sort({ createdAt: -1 })
              .lean();

            if (fuzzyDistrict) {
              result = {
                district: fuzzyDistrict.district,
                state: fuzzyDistrict.state,
                source: 'reverse-geocoding-fuzzy-matched',
                accuracy: 'medium',
              };
            }
          }

          // Last resort: return what we got from reverse geocoding
          if (!result) {
            result = geocodeResult;
          }
        }
        source = result.source || 'reverse-geocoding';
      }
    }

    // Still no result?
    if (!result || !result.state || !result.district) {
      return res.status(404).json({
        success: false,
        error: 'District not found for given coordinates',
        message: 'Could not determine district from coordinates. Please use the search feature.',
        coordinates: { lat, lon },
      });
    }

    res.json({
      success: true,
      data: {
        coordinates: { lat, lon },
        district: result.district,
        state: result.state,
        accuracy: result.accuracy || 'medium',
        source,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

