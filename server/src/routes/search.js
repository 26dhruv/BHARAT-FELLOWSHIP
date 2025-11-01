const express = require('express');
const router = express.Router();
const MgnregaRecord = require('../models/MgnregaRecord');
const { getCache, setCache } = require('../config/redis');

/**
 * GET /api/v1/search?query=
 * Fuzzy search for districts
 */
router.get('/', async (req, res, next) => {
  try {
    const query = req.query.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
      });
    }

    // Try cache first
    const cacheKey = `search:${query.toLowerCase().trim()}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Perform fuzzy search on district names
    // Using MongoDB regex for case-insensitive partial matching
    const searchRegex = new RegExp(query.trim(), 'i');

    // Get districts matching the query
    const records = await MgnregaRecord.find({
      $or: [
        { district: searchRegex },
        { state: searchRegex },
      ],
    })
      .select('state district')
      .lean();

    // Get unique state-district pairs
    const districts = [];
    const seen = new Set();

    for (const record of records) {
      const key = `${record.state}|${record.district}`;
      if (!seen.has(key)) {
        seen.add(key);
        districts.push({
          state: record.state,
          district: record.district,
        });
      }
    }

    // Sort by district name
    districts.sort((a, b) => a.district.localeCompare(b.district));

    const response = {
      success: true,
      data: {
        query: query.trim(),
        results: districts.slice(0, 50), // Limit to 50 results
        count: districts.length,
        source: 'database',
      },
    };

    // Cache for 1 hour
    await setCache(cacheKey, response, 3600);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

