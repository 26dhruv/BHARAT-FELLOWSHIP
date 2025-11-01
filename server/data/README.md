# Data Directory

Place your data files here.

## CSV Import

If you have MGNREGA data in CSV format:

1. Place your CSV file in this directory (e.g., `data/mgnrega-data.csv`)

2. Ensure CSV has these required columns:
   - `fin_year` - Financial year
   - `month` - Month
   - `state_name` - State name
   - `district_name` - District name
   - Other metric columns (see csv-loader.js for mapping)

3. Run the CSV import:
   ```bash
   cd server
   npm run csv-import <path-to-csv>
   # Or set CSV_FILE_PATH in .env
   ```

4. The script will:
   - Parse the CSV file
   - Normalize data to match MongoDB schema
   - Upsert records into MongoDB
   - Invalidate Redis cache for updated districts

## Example CSV Headers

Your CSV should have headers matching your data structure. The csv-loader.js will automatically map common column names:

- `state_name` → state
- `district_name` → district
- `fin_year` → fin_year
- `month` → month
- `Number_of_Completed_Works` → works_completed
- `Number_of_Ongoing_Works` → works_in_progress
- `Total_Exp` → amount_spent
- etc.

## Notes

- Large CSV files will be processed in batches
- Duplicate records (same state+district+fin_year+month) will be updated
- Progress is logged every 100 records

