const { calculatePortfolioAnalytics } = require('../services/portfolio-analytics');

function createAnalyticsController({ getPortfolioCollection, ensureSessionUserId, mapPortfolioItem, respondServerError }) {
  return async function getAnalytics(req, res) {
    const userId = ensureSessionUserId(req, res);
    if (!userId) return;
    try {
      const rows = await getPortfolioCollection().find({ user_id: userId }).sort({ created_at: -1 }).toArray();
      return res.json(calculatePortfolioAnalytics(rows.map(mapPortfolioItem)));
    } catch (error) {
      return respondServerError(res, error, 'Unable to load portfolio analytics.');
    }
  };
}

module.exports = { createAnalyticsController };
