require('dotenv').config();
const cron = require('node-cron');
const { runETL } = require('./etl');

/**
 * Monthly ETL Scheduler
 * Runs on the 1st day of each month at 2:00 AM
 * 
 * Cron pattern: '0 2 1 * *'
 * - 0: minute (at :00)
 * - 2: hour (at 2 AM)
 * - 1: day of month (1st day)
 * - *: month (every month)
 * - *: day of week (any day)
 */
class MonthlyETLScheduler {
  constructor() {
    this.task = null;
    this.isRunning = false;
    this.lastRun = null;
  }

  /**
   * Start the monthly cron job
   */
  start() {
    if (this.task) {
      console.log('Monthly ETL scheduler is already running');
      return;
    }

    // Schedule to run on the 1st of every month at 2:00 AM
    // You can customize this: '0 2 1 * *' = 1st of month at 2 AM
    const cronExpression = process.env.ETL_CRON_SCHEDULE || '0 2 1 * *';
    
    console.log(`Setting up monthly ETL cron job with schedule: ${cronExpression}`);
    console.log('Job will run on the 1st day of each month at 2:00 AM');

    this.task = cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.log('ETL job is already running, skipping this execution');
        return;
      }

      try {
        this.isRunning = true;
        this.lastRun = new Date();
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Starting scheduled ETL job at ${this.lastRun.toISOString()}`);
        console.log(`${'='.repeat(60)}\n`);

        await runETL();

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Scheduled ETL job completed at ${new Date().toISOString()}`);
        console.log(`${'='.repeat(60)}\n`);
      } catch (error) {
        console.error('Error in scheduled ETL job:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'Asia/Kolkata', // Default to IST
    });

    console.log('✅ Monthly ETL scheduler started successfully');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('Monthly ETL scheduler stopped');
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      isScheduled: !!this.task,
    };
  }

  /**
   * Manually trigger ETL (for testing)
   */
  async triggerManually() {
    if (this.isRunning) {
      throw new Error('ETL job is already running');
    }

    try {
      this.isRunning = true;
      this.lastRun = new Date();
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Manually triggering ETL job at ${this.lastRun.toISOString()}`);
      console.log(`${'='.repeat(60)}\n`);

      await runETL();

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Manual ETL job completed at ${new Date().toISOString()}`);
      console.log(`${'='.repeat(60)}\n`);
    } catch (error) {
      console.error('Error in manual ETL job:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

// Create singleton instance
const scheduler = new MonthlyETLScheduler();

// Export scheduler instance
module.exports = scheduler;

// If run directly, start the scheduler (for testing)
if (require.main === module) {
  console.log('Starting ETL scheduler in standalone mode...');
  scheduler.start();
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nStopping ETL scheduler...');
    scheduler.stop();
    process.exit(0);
  });
  
  // Also allow manual trigger for testing
  if (process.argv.includes('--trigger')) {
    setTimeout(async () => {
      try {
        await scheduler.triggerManually();
      } catch (error) {
        console.error('Manual trigger failed:', error);
      }
    }, 2000);
  }
}

