const mongoose = require('mongoose');

/**
 * Subscription Schema
 * For future notifications/alerts feature
 */
const subscriptionSchema = new mongoose.Schema(
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
    // Subscription preferences
    notification_preferences: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
    contact_info: {
      email: String,
      phone: String,
      device_token: String,
    },
    // Language preference
    language: {
      type: String,
      enum: ['en', 'hi'],
      default: 'en',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ state: 1, district: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);

