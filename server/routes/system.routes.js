const express = require('express');

function createSystemRouter({ controller, requireAuth }) {
  const router = express.Router();
  router.get('/status', controller.status);
  router.get('/health', controller.health);
  router.get('/stocks', requireAuth, controller.listStocks);
  router.get('/stocks/:symbol', requireAuth, controller.getStock);
  router.get('/market/quote/:symbol', requireAuth, controller.quote);
  return router;
}

module.exports = { createSystemRouter };
