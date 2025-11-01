#!/usr/bin/env node
/**
 * GeoJSON Loader Script
 * Validates and provides info about GeoJSON file
 */
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { loadGeoJSON } = require('../src/utils/geospatial');

async function main() {
  const geojsonPath = process.argv[2] || process.env.GEOJSON_PATH || './data/geojson/india-districts.geojson';
  
  console.log(`Loading GeoJSON from: ${geojsonPath}`);
  
  try {
    const geojson = await loadGeoJSON(geojsonPath);
    
    if (!geojson) {
      console.error('Failed to load GeoJSON');
      process.exit(1);
    }
    
    console.log('\n✅ GeoJSON loaded successfully!');
    console.log(`\nFeatures: ${geojson.features.length}`);
    
    // Sample feature properties
    if (geojson.features.length > 0) {
      const sample = geojson.features[0].properties;
      console.log('\nSample feature properties:');
      console.log(JSON.stringify(sample, null, 2));
      
      // Count unique states and districts
      const states = new Set();
      const districts = new Set();
      
      geojson.features.forEach(f => {
        const props = f.properties || {};
        const state = props.STATE || props.state || props.ST_NM || '';
        const district = props.DISTRICT || props.district || props.DISTRICT_N || '';
        if (state) states.add(state);
        if (district) districts.add(district);
      });
      
      console.log(`\nUnique States: ${states.size}`);
      console.log(`Unique Districts: ${districts.size}`);
    }
    
    console.log('\n✅ GeoJSON is ready for use!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

