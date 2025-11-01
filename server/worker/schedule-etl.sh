#!/bin/bash
# Script to schedule ETL runs for fetching latest MGNREGA data from API

echo "Running scheduled ETL to fetch latest MGNREGA data from data.gov.in API..."
cd "$(dirname "$0")/.."
npm run etl

