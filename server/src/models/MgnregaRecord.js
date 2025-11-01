const mongoose = require('mongoose');

/**
 * MGNREGA Record Schema
 * Stores raw data from data.gov.in API
 */
const mgnregaRecordSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    district: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    fin_year: {
      type: String,
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      index: true,
    },
    // Composite index for efficient queries
    metrics: {
      person_days_generated: { type: Number, default: 0 },
      works_completed: { type: Number, default: 0 },
      works_in_progress: { type: Number, default: 0 },
      payments_made: { type: Number, default: 0 },
      amount_spent: { type: Number, default: 0 },
    },
    // Store raw API data for reference
    raw_data: {
      type: mongoose.Schema.Types.Mixed,
    },
    // Metadata
    data_source: {
      type: String,
      default: 'data.gov.in',
    },
    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Composite index for efficient district queries
mgnregaRecordSchema.index({ state: 1, district: 1, fin_year: 1, month: 1 }, { unique: true });
mgnregaRecordSchema.index({ state: 1, district: 1, 'metrics.person_days_generated': -1 });

module.exports = mongoose.model('MgnregaRecord', mgnregaRecordSchema);

