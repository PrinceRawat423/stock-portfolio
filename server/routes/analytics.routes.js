const express = require('express');

function createAnalyticsRouter({ requireAuth, getAnalytics }) {
  const router = express.Router();
  router.get('/portfolio/analytics', requireAuth, getAnalytics);
  return router;
}

module.exports = { createAnalyticsRouter };
