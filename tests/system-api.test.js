const express = require('express');
const request = require('supertest');
const { createSystemController } = require('../server/controllers/system.controller');
const { createSystemRouter } = require('../server/routes/system.routes');
const { requireAuth } = require('../server/middleware/require-auth');

function buildApp() {
  const app = express();
  app.use((req, res, next) => { req.session = {}; next(); });
  const controller = createSystemController({
    getState: () => ({ usersCollection: {}, portfolioCollection: {}, transactionsCollection: {}, mailTransport: null, allowDevOtpFallback: true }),
    stockCatalog: [{ symbol: 'TCS', name: 'Tata Consultancy Services' }],
    getLatestMarketQuote: async () => ({ symbol: 'TCS', price: 3000 }),
    respondServerError: (res) => res.status(500).json({ error: 'unexpected' })
  });
  app.use('/api', createSystemRouter({ controller, requireAuth }));
  return app;
}

describe('system API routes', () => {
  test('returns health without authentication', async () => {
    const response = await request(buildApp()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', services: { database: 'connected', email: 'dev-fallback' } });
  });

  test('protects stock endpoints', async () => {
    const response = await request(buildApp()).get('/api/stocks');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });
});
