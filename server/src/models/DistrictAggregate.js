const mongoose = require('mongoose');

/**
 * District Aggregate Schema
 * Pre-computed aggregates for faster queries
 */
const districtAggregateSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
      index: true,
    },
    district: {
      type: String,
      required: true,
      index: true,
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
    // Aggregated metrics
    total_person_days: { type: Number, default: 0 },
    total_works_completed: { type: Number, default: 0 },
    total_works_in_progress: { type: Number, default: 0 },
    total_payments: { type: Number, default: 0 },
    total_amount_spent: { type: Number, default: 0 },
    // Comparison metrics (vs state average)
    vs_state_avg_person_days: { type: Number, default: 0 }, // percentage
    performance_tag: {
      type: String,
      enum: ['Good', 'Average', 'Poor'],
      default: 'Average',
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

// Composite unique index
districtAggregateSchema.index({ state: 1, district: 1, fin_year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('DistrictAggregate', districtAggregateSchema);

