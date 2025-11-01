const express = require('express');
const router = express.Router();
const MgnregaRecord = require('../models/MgnregaRecord');
const DistrictAggregate = require('../models/DistrictAggregate');
const {
  getCachedStateCompare,
  cacheStateCompare,
} = require('../utils/cache');

/**
 * GET /api/v1/state/:state/compare
 * Get ranking and state average comparison for a district
 */
router.get('/:state/compare', async (req, res, next) => {
  try {
    const { state } = req.params;
    const { district } = req.query;

    if (!district) {
      return res.status(400).json({
        success: false,
        error: 'District parameter is required',
      });
    }

    // Try cache first
    const cached = await getCachedStateCompare(state, district);
    if (cached) {
      return res.json(cached);
    }

    // Get current month data
    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'short' });
    const currentYear = now.getFullYear();
    const finYear = currentMonth === 'Jan' || currentMonth === 'Feb' || currentMonth === 'Mar'
      ? `${currentYear - 1}-${currentYear.toString().slice(-2)}`
      : `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

    // Get district record
    const districtRecord = await MgnregaRecord.findOne({
      state: new RegExp(`^${state}$`, 'i'),
      district: new RegExp(`^${district}$`, 'i'),
      fin_year: finYear,
      month: currentMonth,
    });

    if (!districtRecord) {
      // Fallback to latest available
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
        });
      }

      // Use latest record for comparison
      const allDistricts = await MgnregaRecord.find({
        state: new RegExp(`^${state}$`, 'i'),
        fin_year: latest.fin_year,
        month: latest.month,
      });

      const stateAvg = calculateStateAverage(allDistricts);
      const ranking = calculateRanking(allDistricts, district);

      const response = {
        success: true,
        data: {
          district: latest.district,
          state: latest.state,
          fin_year: latest.fin_year,
          month: latest.month,
          district_metrics: latest.metrics,
          state_average: stateAvg,
          ranking,
          performance_tag: getPerformanceTag(latest.metrics.person_days_generated, stateAvg.person_days_generated),
          source: 'database',
          last_updated: latest.last_updated,
        },
      };

      await cacheStateCompare(state, district, response);
      return res.json(response);
    }

    // Get all districts in state for current month
    const allDistricts = await MgnregaRecord.find({
      state: new RegExp(`^${state}$`, 'i'),
      fin_year: finYear,
      month: currentMonth,
    });

    const stateAvg = calculateStateAverage(allDistricts);
    const ranking = calculateRanking(allDistricts, district);

    const response = {
      success: true,
      data: {
        district: districtRecord.district,
        state: districtRecord.state,
        fin_year: districtRecord.fin_year,
        month: districtRecord.month,
        district_metrics: districtRecord.metrics,
        state_average: stateAvg,
        ranking,
        performance_tag: getPerformanceTag(districtRecord.metrics.person_days_generated, stateAvg.person_days_generated),
        source: 'database',
        last_updated: districtRecord.last_updated,
      },
    };

    await cacheStateCompare(state, district, response);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Calculate state average metrics
 */
function calculateStateAverage(districts) {
  if (districts.length === 0) {
    return {
      person_days_generated: 0,
      works_completed: 0,
      works_in_progress: 0,
      payments_made: 0,
      amount_spent: 0,
    };
  }

  const totals = districts.reduce(
    (acc, d) => ({
      person_days_generated: acc.person_days_generated + (d.metrics.person_days_generated || 0),
      works_completed: acc.works_completed + (d.metrics.works_completed || 0),
      works_in_progress: acc.works_in_progress + (d.metrics.works_in_progress || 0),
      payments_made: acc.payments_made + (d.metrics.payments_made || 0),
      amount_spent: acc.amount_spent + (d.metrics.amount_spent || 0),
    }),
    {
      person_days_generated: 0,
      works_completed: 0,
      works_in_progress: 0,
      payments_made: 0,
      amount_spent: 0,
    }
  );

  return {
    person_days_generated: Math.round(totals.person_days_generated / districts.length),
    works_completed: Math.round(totals.works_completed / districts.length),
    works_in_progress: Math.round(totals.works_in_progress / districts.length),
    payments_made: Math.round(totals.payments_made / districts.length),
    amount_spent: Math.round(totals.amount_spent / districts.length),
  };
}

/**
 * Calculate ranking of district within state
 */
function calculateRanking(districts, targetDistrict) {
  // Sort by person_days_generated descending
  const sorted = [...districts].sort(
    (a, b) => (b.metrics.person_days_generated || 0) - (a.metrics.person_days_generated || 0)
  );

  const rank = sorted.findIndex(
    (d) => d.district.toLowerCase() === targetDistrict.toLowerCase()
  ) + 1;

  return {
    rank: rank || null,
    total_districts: sorted.length,
  };
}

/**
 * Determine performance tag (Good/Average/Poor)
 * Good: > state_avg + 10%
 * Poor: < state_avg - 10%
 * Average: otherwise
 */
function getPerformanceTag(districtValue, stateAvg) {
  if (!districtValue || !stateAvg || stateAvg === 0) return 'Average';

  const percentDiff = ((districtValue - stateAvg) / stateAvg) * 100;

  if (percentDiff > 10) return 'Good';
  if (percentDiff < -10) return 'Poor';
  return 'Average';
}

module.exports = router;

