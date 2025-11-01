const fs = require('fs').promises;
const path = require('path');
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');

let geojsonData = null;
let geojsonLoaded = false;

/**
 * Load GeoJSON file into memory
 * Call this once at startup
 */
const loadGeoJSON = async (filePath) => {
  try {
    const fullPath = path.resolve(filePath);
    const data = await fs.readFile(fullPath, 'utf8');
    geojsonData = JSON.parse(data);
    geojsonLoaded = true;
    console.log(`GeoJSON loaded: ${geojsonData.features.length} features`);
    return geojsonData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('⚠️  GeoJSON file not found at:', filePath);
      console.warn('   Geospatial district lookup will be unavailable.');
      console.warn('   To enable it:');
      console.warn('   1. Download GeoJSON from: https://github.com/datameet/maps');
      console.warn('   2. Place it in server/data/geojson/');
      console.warn('   3. Update GEOJSON_PATH in .env file');
    } else {
      console.error('Error loading GeoJSON:', error.message);
      console.warn('Geospatial lookup will be unavailable');
    }
    return null;
  }
};

/**
 * Find district from lat/lon using point-in-polygon
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Object|null} - { state, district } or null if not found
 */
const findDistrictFromCoordinates = (lat, lon) => {
  if (!geojsonData || !geojsonData.features) {
    return null;
  }

  const searchPoint = point([lon, lat]); // GeoJSON is [lon, lat]

  // Search through all features
  for (const feature of geojsonData.features) {
    if (feature.geometry && feature.geometry.type === 'Polygon') {
      if (booleanPointInPolygon(searchPoint, feature)) {
        // Extract state and district from properties
        // Adjust property names based on your GeoJSON structure
        const props = feature.properties || {};
        return {
          state: props.STATE || props.state || props.ST_NM || '',
          district: props.DISTRICT || props.district || props.DISTRICT_N || '',
          accuracy: 'high',
        };
      }
    } else if (feature.geometry && feature.geometry.type === 'MultiPolygon') {
      // Handle MultiPolygon (union of polygons)
      for (const polygon of feature.geometry.coordinates) {
        const tempFeature = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: polygon,
          },
        };
        if (booleanPointInPolygon(searchPoint, tempFeature)) {
          const props = feature.properties || {};
          return {
            state: props.STATE || props.state || props.ST_NM || '',
            district: props.DISTRICT || props.district || props.DISTRICT_N || '',
            accuracy: 'high',
          };
        }
      }
    }
  }

  return null;
};

/**
 * Get all districts for a state
 */
const getDistrictsByState = (stateName) => {
  if (!geojsonData || !geojsonData.features) {
    return [];
  }

  const districts = new Set();
  for (const feature of geojsonData.features) {
    const props = feature.properties || {};
    const state = props.STATE || props.state || props.ST_NM || '';
    if (state.toLowerCase() === stateName.toLowerCase()) {
      const district = props.DISTRICT || props.district || props.DISTRICT_N || '';
      if (district) districts.add(district);
    }
  }
  return Array.from(districts).sort();
};

/**
 * Check if GeoJSON is loaded
 */
const isGeoJSONLoaded = () => geojsonLoaded;

module.exports = {
  loadGeoJSON,
  findDistrictFromCoordinates,
  getDistrictsByState,
  isGeoJSONLoaded,
};

