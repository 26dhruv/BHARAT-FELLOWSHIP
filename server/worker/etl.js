require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const connectDB = require('../src/config/database');
const MgnregaRecord = require('../src/models/MgnregaRecord');
const { invalidateDistrictCache } = require('../src/utils/cache');

const API_BASE = process.env.MGNREGA_API_BASE || 'https://data.gov.in/api/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722';
const API_KEY = process.env.MGNREGA_API_KEY || '579b464db66ec23bdd00000104002ad973e2489a5a9ebc4c15f5f9c2';
// Processing batch size for chunked processing (to avoid memory issues)
// Set to large number or null to process all at once
const PROCESSING_BATCH_SIZE = process.env.ETL_BATCH_SIZE ? parseInt(process.env.ETL_BATCH_SIZE) : 1000;

/**
 * Sleep helper for rate limiting
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch data from data.gov.in API
 * Note: API seems to return all records at once regardless of limit parameter
 */
async function fetchMgnregaData() {
  try {
    // Remove limit and offset - fetch all records at once
    const url = `${API_BASE}?api-key=${API_KEY}&format=json`;
    
    console.log(`Fetching data from API (no limit - fetching all records)...`);
    
    const response = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'OurVoiceOurRights/1.0',
        'Accept': 'application/json',
      },
      responseType: 'json',
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      },
    });

    // Check if response is HTML (error page)
    if (typeof response.data === 'string' && response.data.trim().startsWith('<!')) {
      console.error('API returned HTML instead of JSON - possible error page or API issue');
      console.error('Response preview:', response.data.substring(0, 500));
      throw new Error('API returned HTML error page instead of JSON data');
    }

    // Debug: log response structure
    if (response.data && typeof response.data === 'object') {
      const keys = Object.keys(response.data);
      console.log(`API Response keys: ${keys.length} keys (showing first 20):`, keys.slice(0, 20));
      
      // Check for HTML content in response
      const dataStr = JSON.stringify(response.data).substring(0, 200);
      if (dataStr.includes('<!doctype') || dataStr.includes('<html')) {
        throw new Error('API response contains HTML instead of JSON data');
      }
    }

    return response.data;
  } catch (error) {
    console.error(`Error fetching data at offset ${offset}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      if (error.response.data) {
        const preview = typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 500)
          : JSON.stringify(error.response.data).substring(0, 500);
        console.error('Response data preview:', preview);
      }
    } else if (error.request) {
      console.error('No response received from API - check network/API availability');
    }
    throw error;
  }
}

/**
 * Normalize and parse MGNREGA record
 * Handles multiple field name variations (matches CSV loader logic)
 */
function normalizeRecord(rawRecord) {
  // Helper function to get value with multiple possible keys (case-insensitive, flexible)
  const getValue = (...possibleKeys) => {
    for (const key of possibleKeys) {
      // Try exact match first
      if (rawRecord.hasOwnProperty(key) && rawRecord[key] !== undefined && rawRecord[key] !== null && rawRecord[key] !== '') {
        return String(rawRecord[key]).trim();
      }
      
      // Try case-insensitive match (exact case-insensitive comparison)
      const lowerKey = key.toLowerCase();
      for (const recordKey of Object.keys(rawRecord)) {
        if (recordKey.toLowerCase() === lowerKey) {
          const value = rawRecord[recordKey];
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim();
          }
        }
      }
      
      // Try matching without underscores/spaces
      const keyNormalized = key.toLowerCase().replace(/[_\s]/g, '');
      for (const recordKey of Object.keys(rawRecord)) {
        const recordKeyNormalized = recordKey.toLowerCase().replace(/[_\s]/g, '');
        if (recordKeyNormalized === keyNormalized) {
          const value = rawRecord[recordKey];
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim();
          }
        }
      }
    }
    return '';
  };

  // Helper function to parse number with multiple possible keys
  const parseNum = (...possibleKeys) => {
    for (const key of possibleKeys) {
      // Try exact match first
      if (rawRecord.hasOwnProperty(key) && rawRecord[key] !== undefined && rawRecord[key] !== null && rawRecord[key] !== '') {
        const value = parseFloat(String(rawRecord[key]).replace(/,/g, '')) || 0;
        if (!isNaN(value)) return value;
      }
      
      // Try case-insensitive match
      const lowerKey = key.toLowerCase();
      for (const recordKey of Object.keys(rawRecord)) {
        if (recordKey.toLowerCase() === lowerKey) {
          const value = parseFloat(String(rawRecord[recordKey]).replace(/,/g, '')) || 0;
          if (!isNaN(value)) return value;
        }
      }
      
      // Try matching without underscores/spaces
      const keyNormalized = key.toLowerCase().replace(/[_\s]/g, '');
      for (const recordKey of Object.keys(rawRecord)) {
        const recordKeyNormalized = recordKey.toLowerCase().replace(/[_\s]/g, '');
        if (recordKeyNormalized === keyNormalized) {
          const value = parseFloat(String(rawRecord[recordKey]).replace(/,/g, '')) || 0;
          if (!isNaN(value)) return value;
        }
      }
    }
    return 0;
  };

  // Extract state and district (handles state_name, district_name, etc.)
  const state = getValue('state_name', 'State_Name', 'STATE_NAME', 'state', 'State', 'STATE');
  const district = getValue('district_name', 'District_Name', 'DISTRICT_NAME', 'district', 'District', 'DISTRICT');
  const fin_year = getValue('fin_year', 'Fin_Year', 'FIN_YEAR', 'financial_year', 'Financial Year', 'financialyear');
  const month = getValue('month', 'Month', 'MONTH');

  // Calculate person_days_generated from various sources
  const scPersondays = parseNum('SC_persondays', 'sc_persondays', 'SC Persondays', 'scPersondays');
  const stPersondays = parseNum('ST_persondays', 'st_persondays', 'ST Persondays', 'stPersondays');
  const womenPersondays = parseNum('Women_Persondays', 'women_persondays', 'Women Persondays', 'womenPersondays');
  const centralLiabilityPersondays = parseNum('Persondays_of_Central_Liability_so_far', 'persondays_of_central_liability_so_far', 'Central_Liability_Persondays');
  const estimatedPersonDays = scPersondays + stPersondays + womenPersondays + centralLiabilityPersondays;

  const record = {
    state,
    district,
    fin_year,
    month,
    metrics: {
      person_days_generated: parseNum('person_days_generated', 'Person_Days_Generated', 'personDaysGenerated', 'PERSON_DAYS') || estimatedPersonDays,
      works_completed: parseNum('Number_of_Completed_Works', 'number_of_completed_works', 'works_completed', 'Works_Completed'),
      works_in_progress: parseNum('Number_of_Ongoing_Works', 'number_of_ongoing_works', 'works_in_progress', 'Works_In_Progress'),
      payments_made: parseNum('Total_No_of_JobCards_issued', 'total_no_of_jobcards_issued', 'payments_made', 'Payments_Made'),
      amount_spent: parseNum('Total_Exp', 'total_exp', 'Total_Expenditure', 'total_expenditure', 'amount_spent', 'Amount_Spent'),
    },
    raw_data: {
      state_code: getValue('state_code', 'State_Code', 'STATE_CODE'),
      district_code: getValue('district_code', 'District_Code', 'DISTRICT_CODE'),
      approved_labour_budget: parseNum('Approved_Labour_Budget', 'approved_labour_budget'),
      average_wage_rate: parseNum('Average_Wage_rate_per_day_per_person', 'average_wage_rate_per_day_per_person'),
      sc_persondays: scPersondays,  // Use the calculated variable
      st_persondays: stPersondays,  // Use the calculated variable
      women_persondays: womenPersondays,  // Use the calculated variable
      central_liability_persondays: centralLiabilityPersondays,  // Use the calculated variable
      total_households_worked: parseNum('Total_Households_Worked', 'total_households_worked'),
      total_individuals_worked: parseNum('Total_Individuals_Worked', 'total_individuals_worked'),
      total_works_takenup: parseNum('Total_No_of_Works_Takenup', 'total_no_of_works_takenup'),
      wages: parseNum('Wages', 'wages'),
      remarks: getValue('Remarks', 'remarks'),
      // Include all other fields from raw record
      ...rawRecord,
    },
    data_source: 'data.gov.in',
    last_updated: new Date(),
  };

  return record;
}

/**
 * Upsert record into MongoDB - only updates if data has changed
 * Returns: { updated: boolean, inserted: boolean, changed: boolean }
 */
async function upsertRecord(normalizedRecord) {
  try {
    const filter = {
      state: normalizedRecord.state,
      district: normalizedRecord.district,
      fin_year: normalizedRecord.fin_year,
      month: normalizedRecord.month,
    };

    // Check if record exists
    const existingRecord = await MgnregaRecord.findOne(filter).lean();

    if (!existingRecord) {
      // New record - insert it
      await MgnregaRecord.create(normalizedRecord);
      return { updated: false, inserted: true, changed: true };
    }

    // Compare metrics to see if data has changed
    const metricsChanged = 
      existingRecord.metrics?.person_days_generated !== normalizedRecord.metrics.person_days_generated ||
      existingRecord.metrics?.works_completed !== normalizedRecord.metrics.works_completed ||
      existingRecord.metrics?.works_in_progress !== normalizedRecord.metrics.works_in_progress ||
      existingRecord.metrics?.payments_made !== normalizedRecord.metrics.payments_made ||
      existingRecord.metrics?.amount_spent !== normalizedRecord.metrics.amount_spent;

    // Also check if raw_data has changed (for any additional fields)
    const rawDataChanged = JSON.stringify(existingRecord.raw_data || {}) !== JSON.stringify(normalizedRecord.raw_data || {});

    if (metricsChanged || rawDataChanged) {
      // Data has changed - update the record
      await MgnregaRecord.updateOne(
        filter,
        { 
          $set: {
            ...normalizedRecord,
            last_updated: new Date(), // Always update timestamp
          }
        }
      );
      return { updated: true, inserted: false, changed: true };
    }

    // No changes - skip update to avoid unnecessary writes
    return { updated: false, inserted: false, changed: false };
  } catch (error) {
    console.error('Error upserting record:', error.message);
    throw error;
  }
}

/**
 * Save snapshot to file
 */
async function saveSnapshot(data, date) {
  try {
    const snapshotDir = path.join(__dirname, '..', 'data', 'snapshots');
    await fs.mkdir(snapshotDir, { recursive: true });
    
    const filename = `snapshot-${date}.json`;
    const filepath = path.join(snapshotDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`Snapshot saved: ${filepath}`);
  } catch (error) {
    console.error('Error saving snapshot:', error.message);
  }
}

/**
 * Main ETL function
 * Can be imported and called by scheduler
 */
async function runETL() {
  console.log('Starting ETL process...');
  const startTime = Date.now();

  try {
    // Connect to database
    await connectDB();

    let totalProcessed = 0;
    let totalUpserted = 0;
    const allRecords = [];
    const districtsUpdated = new Set();

    // Fetch all data from API (no pagination needed - API returns all records)
    console.log('Fetching all data from API...');
    const response = await fetchMgnregaData();

    if (!response) {
      throw new Error('No response received from API');
    }

    // Process response and extract records array
    let recordsArray = null;

    // If response is directly an array, use it
    if (Array.isArray(response)) {
      recordsArray = response;
    }
    // If response is an object, check for common array properties
    else if (typeof response === 'object' && response !== null) {
      // Check if it has a records/data/rows property that's an array
      recordsArray = response.records || response.data || response.rows || response.result;
      
      // If still not an array, check if response has numeric keys (array-like object)
      if (!Array.isArray(recordsArray)) {
        const keys = Object.keys(response);
        // If all keys are numeric (array-like object), convert to array
        if (keys.length > 0 && keys.every(key => /^\d+$/.test(key))) {
          recordsArray = Object.values(response);
          console.log(`✓ Converted array-like object to array with ${recordsArray.length} items`);
        }
      }
    }

    if (!recordsArray || !Array.isArray(recordsArray) || recordsArray.length === 0) {
      console.error('No records found in API response');
      console.log('Response structure:', {
        hasResponse: !!response,
        isArray: Array.isArray(response),
        responseType: typeof response,
        responseKeys: response && typeof response === 'object' ? Object.keys(response).slice(0, 10) : [],
        recordsType: recordsArray ? typeof recordsArray : 'null',
        recordsIsArray: Array.isArray(recordsArray),
        recordsLength: recordsArray ? recordsArray.length : 0,
      });
      
      // If response is a string (HTML), log it
      if (typeof response === 'string') {
        console.error('API returned string/HTML instead of JSON. First 500 chars:');
        console.error(response.substring(0, 500));
      }
      
      throw new Error('No records found in API response');
    }

    console.log(`✓ Found ${recordsArray.length} total records to process`);
    
    // Debug: Log first record structure
    if (recordsArray.length > 0) {
      const firstRecord = recordsArray[0];
      console.log('\n=== First Record Structure ===');
      console.log('Record keys:', Object.keys(firstRecord || {}).slice(0, 20));
      if (firstRecord) {
        console.log('Sample values:', {
          state_name: firstRecord.state_name,
          district_name: firstRecord.district_name,
          fin_year: firstRecord.fin_year,
          month: firstRecord.month,
          SC_persondays: firstRecord.SC_persondays,
        });
      }
      console.log('=============================\n');
    }

    // Process records in batches to avoid memory issues
    let offset = 0;
    const batchSize = PROCESSING_BATCH_SIZE || recordsArray.length;
    
    while (offset < recordsArray.length) {
      const startIndex = offset;
      const endIndex = Math.min(offset + batchSize, recordsArray.length);
      const batchRecords = recordsArray.slice(startIndex, endIndex);

      console.log(`Processing batch: records ${startIndex + 1} to ${endIndex} of ${recordsArray.length} (batch size: ${batchRecords.length})`);

      // Process each record in the batch
      for (const rawRecord of batchRecords) {
          try {

            const normalized = normalizeRecord(rawRecord);
            
            // Skip if essential fields are missing
            if (!normalized.state || !normalized.district || !normalized.fin_year || !normalized.month) {
              // Only log first few to avoid spam
              if (totalProcessed < 5) {
                console.warn('Skipping record with missing fields:', {
                  normalized: {
                    state: normalized.state,
                    district: normalized.district,
                    fin_year: normalized.fin_year,
                    month: normalized.month,
                  },
                  rawRecord: {
                    state_name: rawRecord.state_name,
                    district_name: rawRecord.district_name,
                    fin_year: rawRecord.fin_year,
                    month: rawRecord.month,
                    allKeys: Object.keys(rawRecord).slice(0, 15),
                  },
                });
              }
              continue;
            }

            const result = await upsertRecord(normalized);
            
            // Count processed records (including skipped ones)
            totalProcessed++;
            
            // Only count as updated if data actually changed
            if (result.changed) {
              if (result.inserted) {
                totalUpserted++;
              } else if (result.updated) {
                totalUpserted++;
              }
              
              // Track districts for cache invalidation (only if changed)
              districtsUpdated.add(`${normalized.state}|${normalized.district}`);
            }
            
            allRecords.push(normalized);
            
            // Progress logging every 100 records
            if (totalProcessed % 100 === 0) {
              console.log(`  Progress: Processed ${totalProcessed}/${recordsArray.length}, Updated/Inserted ${totalUpserted}, Skipped (no changes) ${totalProcessed - totalUpserted}`);
            }
            
            // Progress logging every 1000 records for large datasets
            if (totalProcessed % 1000 === 0) {
              console.log(`📊 Major milestone: Processed ${totalProcessed} records, ${totalUpserted} updated/inserted`);
            }
          } catch (error) {
            console.error('Error processing record:', error.message);
            // Continue with next record
          }
        }

        // Move to next batch
        offset = endIndex;
        
        // Small delay between batches to avoid overloading the database
        if (offset < recordsArray.length) {
          await sleep(100); // Very short delay since data is already in memory
        }

        // For demo/development: limit total records processed (optional)
        // Remove or set to a high value for production
        if (process.env.ETL_LIMIT && totalProcessed >= parseInt(process.env.ETL_LIMIT)) {
          console.log(`ETL limit reached (processed ${totalProcessed} records, limit: ${process.env.ETL_LIMIT}), stopping`);
          break;
        }
    }

    console.log(`\n✓ Finished processing all ${recordsArray.length} records`);

    // Save snapshot
    const snapshotDate = new Date().toISOString().split('T')[0];
    await saveSnapshot({
      date: snapshotDate,
      total_records: allRecords.length,
      records: allRecords.slice(0, 100), // Save first 100 as sample
      metadata: {
        total_processed: totalProcessed,
        total_upserted: totalUpserted,
        districts_updated: districtsUpdated.size,
      },
    }, snapshotDate);

    // Invalidate cache for updated districts
    console.log('Invalidating cache for updated districts...');
    for (const key of districtsUpdated) {
      const [state, district] = key.split('|');
      await invalidateDistrictCache(state, district);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`ETL completed in ${duration}s`);
    console.log(`Total processed: ${totalProcessed}, Upserted: ${totalUpserted}`);
    console.log(`Districts updated: ${districtsUpdated.size}`);

    process.exit(0);
  } catch (error) {
    console.error('ETL failed:', error);
    process.exit(1);
  }
}

// Export runETL for use by scheduler
module.exports = { runETL };

// Run ETL if called directly
if (require.main === module) {
  runETL()
    .then(() => {
      console.log('ETL process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('ETL process failed:', error);
      process.exit(1);
    });
}

