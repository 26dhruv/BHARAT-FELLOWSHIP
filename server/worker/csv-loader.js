require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');
const connectDB = require('../src/config/database');
const MgnregaRecord = require('../src/models/MgnregaRecord');
const { invalidateDistrictCache } = require('../src/utils/cache');

/**
 * Parse CSV file and import into MongoDB
 */
async function loadCSVData(csvFilePath) {
  console.log('Starting CSV import process...');
  const startTime = Date.now();

  try {
    // Connect to database
    await connectDB();

    // Read CSV file
    console.log(`Reading CSV file: ${csvFilePath}`);
    const csvContent = await fs.readFile(csvFilePath, 'utf8');

    // Parse CSV
    const records = parse(csvContent, {
      columns: true, // Use first line as column headers
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle BOM if present
    });

    console.log(`Parsed ${records.length} records from CSV`);
    
    if (records.length === 0) {
      console.error('No records found in CSV. Check file format and headers.');
      process.exit(1);
    }

    let totalProcessed = 0;
    let totalUpserted = 0;
    let totalSkipped = 0;
    const districtsUpdated = new Set();

    // Debug: Show first record structure
    if (records.length > 0) {
      console.log('\nFirst CSV record sample:');
      console.log('Columns:', Object.keys(records[0]));
      console.log('Sample values:', {
        state_name: records[0].state_name,
        district_name: records[0].district_name,
        fin_year: records[0].fin_year,
        month: records[0].month,
      });
      console.log('');
    }

    // Process each record
    for (const csvRecord of records) {
      try {
        // Normalize the CSV record to our schema
        const normalized = normalizeCSVRecord(csvRecord);

        // Skip if essential fields are missing
        if (!normalized.state || !normalized.district || !normalized.fin_year || !normalized.month) {
          // Only log first few skipped records to avoid spam
          if (totalSkipped < 3) {
            console.warn('Skipping record with missing fields:', {
              state: csvRecord.state_name || csvRecord.state,
              district: csvRecord.district_name || csvRecord.district,
              fin_year: csvRecord.fin_year,
              month: csvRecord.month,
              allKeys: Object.keys(csvRecord).slice(0, 10),
            });
          }
          totalSkipped++;
          continue;
        }

        // Upsert to MongoDB
        await upsertRecord(normalized);
        totalUpserted++;

        // Track districts for cache invalidation
        districtsUpdated.add(`${normalized.state}|${normalized.district}`);
        totalProcessed++;

        // Progress logging every 100 records
        if (totalProcessed % 100 === 0) {
          console.log(`Processed ${totalProcessed} records...`);
        }
      } catch (error) {
        console.error('Error processing CSV record:', error.message);
        totalSkipped++;
      }
    }

    // Invalidate cache for updated districts
    console.log('Invalidating cache for updated districts...');
    for (const key of districtsUpdated) {
      const [state, district] = key.split('|');
      await invalidateDistrictCache(state, district);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nCSV import completed in ${duration}s`);
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Total upserted: ${totalUpserted}`);
    console.log(`Total skipped: ${totalSkipped}`);
    console.log(`Districts updated: ${districtsUpdated.size}`);

    process.exit(0);
  } catch (error) {
    console.error('CSV import failed:', error);
    process.exit(1);
  }
}

/**
 * Normalize CSV record to MgnregaRecord schema
 * Maps your CSV columns to the database schema
 */
function normalizeCSVRecord(csvRecord) {
  // Helper to safely parse numbers from CSV with multiple possible column names
  const parseNum = (...possibleKeys) => {
    for (const key of possibleKeys) {
      const val = csvRecord[key] || csvRecord[key.toLowerCase()] || csvRecord[key.toUpperCase()] || 
                  csvRecord[key.replace(/_/g, ' ')] || csvRecord[key.replace(/_/g, '-')];
      if (val !== '' && val !== null && val !== undefined) {
        const num = parseFloat(val);
        if (!isNaN(num)) return num;
      }
    }
    return 0;
  };

  // Calculate total person days from available metrics (try multiple column name variations)
  const scPersondays = parseNum('SC_persondays', 'sc_persondays', 'SC Persondays');
  const stPersondays = parseNum('ST_persondays', 'st_persondays', 'ST Persondays');
  const womenPersondays = parseNum('Women_Persondays', 'women_persondays', 'Women Persondays');
  const centralLiabilityPersondays = parseNum('Persondays_of_Central_Liability_so_far', 'persondays_of_central_liability_so_far');
  
  // Estimate total person days if not directly available
  // Sum of SC, ST, Women persondays gives a good estimate
  const estimatedPersonDays = scPersondays + stPersondays + womenPersondays + centralLiabilityPersondays;

  // Helper to get value from CSV with multiple possible column names
  const getValue = (...possibleKeys) => {
    for (const key of possibleKeys) {
      const val = csvRecord[key] || csvRecord[key.toLowerCase()] || csvRecord[key.toUpperCase()] || 
                  csvRecord[key.replace(/_/g, ' ')] || csvRecord[key.replace(/_/g, '-')];
      if (val && String(val).trim()) {
        return String(val).trim();
      }
    }
    return '';
  };

  // Map CSV columns to our schema - try multiple possible column name variations
  const record = {
    state: getValue('state_name', 'State_Name', 'STATE_NAME', 'state', 'State', 'STATE'),
    district: getValue('district_name', 'District_Name', 'DISTRICT_NAME', 'district', 'District', 'DISTRICT'),
    fin_year: getValue('fin_year', 'Fin_Year', 'FIN_YEAR', 'financial_year', 'Financial Year'),
    month: getValue('month', 'Month', 'MONTH'),
    metrics: {
      person_days_generated: estimatedPersonDays,
      works_completed: parseNum('Number_of_Completed_Works', 'number_of_completed_works'),
      works_in_progress: parseNum('Number_of_Ongoing_Works', 'number_of_ongoing_works'),
      payments_made: parseNum('Total_No_of_JobCards_issued', 'total_no_of_jobcards_issued'),
      amount_spent: parseNum('Total_Exp', 'total_exp', 'Total_Expenditure', 'total_expenditure'),
      // Store additional metrics in raw_data
      // These can be accessed via raw_data if needed
    },
    // Store all CSV data for reference and future use
    raw_data: {
      // Basic info - try to get with case variations
      state_code: getValue('state_code', 'State_Code', 'STATE_CODE') || csvRecord.state_code,
      district_code: getValue('district_code', 'District_Code', 'DISTRICT_CODE') || csvRecord.district_code,
      // Financial metrics
      approved_labour_budget: parseNum('Approved_Labour_Budget', 'approved_labour_budget'),
      average_wage_rate: parseNum('Average_Wage_rate_per_day_per_person', 'average_wage_rate_per_day_per_person'),
      average_days_employment: parseNum('Average_days_of_employment_provided_per_Household', 'average_days_of_employment_provided_per_household'),
      material_skilled_wages: parseNum('Material_and_skilled_Wages', 'material_and_skilled_wages'),
      wages: parseNum('Wages', 'wages'),
      total_adm_expenditure: parseNum('Total_Adm_Expenditure', 'total_adm_expenditure'),
      // Worker metrics
      total_households_worked: parseNum('Total_Households_Worked', 'total_households_worked'),
      total_individuals_worked: parseNum('Total_Individuals_Worked', 'total_individuals_worked'),
      total_active_workers: parseNum('Total_No_of_Active_Workers', 'total_no_of_active_workers'),
      total_active_job_cards: parseNum('Total_No_of_Active_Job_Cards', 'total_no_of_active_job_cards'),
      total_job_cards_issued: parseNum('Total_No_of_JobCards_issued', 'total_no_of_jobcards_issued'),
      total_workers: parseNum('Total_No_of_Workers', 'total_no_of_workers'),
      total_100_days_hhs: parseNum('Total_No_of_HHs_completed_100_Days_of_Wage_Employment', 'total_no_of_hhs_completed_100_days_of_wage_employment'),
      // Work metrics
      total_works: parseNum('Total_No_of_Works_Takenup', 'total_no_of_works_takenup'),
      gps_with_nil_exp: parseNum('Number_of_GPs_with_NIL_exp', 'number_of_gps_with_nil_exp'),
      // Person-days breakdown
      sc_persondays: scPersondays,
      st_persondays: stPersondays,
      women_persondays: womenPersondays,
      central_liability_persondays: centralLiabilityPersondays,
      // Worker categories
      sc_workers_ratio: parseNum('SC_workers_against_active_workers', 'sc_workers_against_active_workers'),
      st_workers_ratio: parseNum('ST_workers_against_active_workers', 'st_workers_against_active_workers'),
      differently_abled_persons: parseNum('Differently_abled_persons_worked', 'differently_abled_persons_worked'),
      // Percentages
      category_b_works_percent: parseNum('percent_of_Category_B_Works', 'percent_of_category_b_works'),
      agriculture_expenditure_percent: parseNum('percent_of_Expenditure_on_Agriculture_Allied_Works', 'percent_of_expenditure_on_agriculture_allied_works'),
      nrm_expenditure_percent: parseNum('percent_of_NRM_Expenditure', 'percent_of_nrm_expenditure'),
      payments_within_15_days_percent: parseNum('percentage_payments_gererated_within_15_days', 'percentage_payments_generated_within_15_days'),
      // Other
      remarks: getValue('Remarks', 'remarks') || '',
    },
    data_source: 'csv-import',
    last_updated: new Date(),
  };

  return record;
}

/**
 * Upsert record into MongoDB
 */
async function upsertRecord(normalizedRecord) {
  try {
    const filter = {
      state: normalizedRecord.state,
      district: normalizedRecord.district,
      fin_year: normalizedRecord.fin_year,
      month: normalizedRecord.month,
    };

    await MgnregaRecord.updateOne(
      filter,
      { $set: normalizedRecord },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error upserting record:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const csvPath = process.argv[2] || process.env.CSV_FILE_PATH || './data/mgnrega-data.csv';
  
  if (!csvPath) {
    console.error('Please provide CSV file path:');
    console.error('  node worker/csv-loader.js <path-to-csv-file>');
    console.error('  Or set CSV_FILE_PATH in .env');
    process.exit(1);
  }

  loadCSVData(csvPath);
}

module.exports = loadCSVData;

