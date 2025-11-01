const express = require('express');
const router = express.Router();
const MgnregaRecord = require('../models/MgnregaRecord');
const DistrictAggregate = require('../models/DistrictAggregate');
const {
  getCachedDistrictCurrent,
  cacheDistrictCurrent,
  getCachedDistrictHistory,
  cacheDistrictHistory,
} = require('../utils/cache');

/**
 * GET /api/v1/district/:state/:district/current
 * Get current month summary for a district
 */
router.get('/:state/:district/current', async (req, res, next) => {
  try {
    const { state, district } = req.params;

    // Try cache first
    const cached = await getCachedDistrictCurrent(state, district);
    if (cached) {
      return res.json(cached);
    }

    // Get current financial year and month
    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'short' });
    const currentYear = now.getFullYear();
    const finYear = currentMonth === 'Jan' || currentMonth === 'Feb' || currentMonth === 'Mar'
      ? `${currentYear - 1}-${currentYear.toString().slice(-2)}`
      : `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

    // Query MongoDB
    const record = await MgnregaRecord.findOne({
      state: new RegExp(`^${state}$`, 'i'),
      district: new RegExp(`^${district}$`, 'i'),
      fin_year: finYear,
      month: currentMonth,
    });

    if (!record) {
      // Try to get latest available record
      const latest = await MgnregaRecord.findOne({
        state: new RegExp(`^${state}$`, 'i'),
        district: new RegExp(`^${district}$`, 'i'),
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!latest) {
        return res.status(404).json({
          success: false,
          error: 'District data not found',
          source: 'database',
        });
      }

      const response = {
        success: true,
        data: {
          state: latest.state,
          district: latest.district,
          fin_year: latest.fin_year,
          month: latest.month,
          metrics: latest.metrics,
          source: 'database',
          last_updated: latest.last_updated,
        },
      };

      await cacheDistrictCurrent(state, district, response);
      return res.json(response);
    }

    const response = {
      success: true,
      data: {
        state: record.state,
        district: record.district,
        fin_year: record.fin_year,
        month: record.month,
        metrics: record.metrics,
        source: 'database',
        last_updated: record.last_updated,
      },
    };

    // Cache the response
    await cacheDistrictCurrent(state, district, response);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/district/:state/:district/history
 * Get historical data for last N months
 */
router.get('/:state/:district/history', async (req, res, next) => {
  try {
    const { state, district } = req.params;
    const months = parseInt(req.query.months) || 12;

    // Try cache first
    const cached = await getCachedDistrictHistory(state, district, months);
    if (cached) {
      return res.json(cached);
    }

    // Query MongoDB for last N records (sorted by date)
    const records = await MgnregaRecord.find({
      state: new RegExp(`^${state}$`, 'i'),
      district: new RegExp(`^${district}$`, 'i'),
    })
      .sort({ fin_year: -1, month: -1 })
      .limit(months)
      .lean();

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'District history not found',
        source: 'database',
      });
    }

    const history = records.map((r) => ({
      fin_year: r.fin_year,
      month: r.month,
      metrics: r.metrics,
      last_updated: r.last_updated,
    }));

    const response = {
      success: true,
      data: {
        state: records[0].state,
        district: records[0].district,
        history,
        source: 'database',
        last_updated: records[0].last_updated,
      },
    };

    // Cache the response
    await cacheDistrictHistory(state, district, months, response);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

