require('dotenv').config();
const Queue = require('bull');
const runETL = require('./etl');

// Create Bull queue for ETL jobs
const etlQueue = new Queue('mgnrega-etl', {
  redis: {
    host: process.env.REDIS_URL?.replace('redis://', '').split(':')[0] || 'localhost',
    port: process.env.REDIS_URL?.match(/:(\d+)/)?.[1] || 6379,
  },
});

/**
 * Process ETL jobs from queue
 */
etlQueue.process(async (job) => {
  console.log(`Processing ETL job ${job.id}`);
  try {
    await runETL();
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('ETL job failed:', error);
    throw error;
  }
});

// Job completion handlers
etlQueue.on('completed', (job, result) => {
  console.log(`ETL job ${job.id} completed:`, result);
});

etlQueue.on('failed', (job, error) => {
  console.error(`ETL job ${job.id} failed:`, error.message);
});

// Schedule daily ETL at 2 AM (IST)
// Cron format: minute hour day month day-of-week
const cronSchedule = process.env.ETL_CRON || '0 2 * * *'; // 2 AM daily

console.log('ETL Queue Worker started');
console.log(`Scheduled ETL: ${cronSchedule}`);

// Add recurring job
etlQueue.add(
  'daily-etl',
  {},
  {
    repeat: {
      cron: cronSchedule,
    },
  }
);

// Keep process alive
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing queue...');
  await etlQueue.close();
  process.exit(0);
});

