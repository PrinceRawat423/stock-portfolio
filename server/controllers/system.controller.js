function createSystemController({ getState, stockCatalog, getLatestMarketQuote, respondServerError }) {
  const status = (req, res) => res.json({ authenticated: Boolean(req.session.userId) });

  const health = (req, res) => {
    const { usersCollection, portfolioCollection, transactionsCollection, mailTransport, allowDevOtpFallback } = getState();
    const databaseReady = Boolean(usersCollection && portfolioCollection && transactionsCollection);
    res.json({
      status: databaseReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: databaseReady ? 'connected' : 'disconnected',
        email: mailTransport ? 'configured' : allowDevOtpFallback ? 'dev-fallback' : 'not-configured'
      }
    });
  };

  const listStocks = (req, res) => {
    const query = String(req.query.query || '').trim().toLowerCase();
    const matches = stockCatalog.filter((stock) => !query || stock.symbol.toLowerCase().includes(query) || stock.name.toLowerCase().includes(query));
    const stocks = matches.sort((a, b) => {
      const aStarts = a.symbol.toLowerCase().startsWith(query) || a.name.toLowerCase().startsWith(query);
      const bStarts = b.symbol.toLowerCase().startsWith(query) || b.name.toLowerCase().startsWith(query);
      return Number(bStarts) - Number(aStarts) || a.name.localeCompare(b.name);
    }).slice(0, 3);
    res.json({ stocks });
  };

  const getStock = (req, res) => {
    const stock = stockCatalog.find((item) => item.symbol === String(req.params.symbol || '').trim().toUpperCase());
    return stock ? res.json({ stock }) : res.status(404).json({ error: 'Stock not found.' });
  };

  const quote = async (req, res) => {
    const symbol = String(req.params.symbol || '').trim().toUpperCase();
    if (!stockCatalog.some((stock) => stock.symbol === symbol)) return res.status(404).json({ error: 'Stock not found.' });
    try {
      return res.json({ quote: await getLatestMarketQuote(symbol) });
    } catch (error) {
      if (error.statusCode === 429) return res.status(429).json({ error: 'Market data limit reached. Please try again in a few minutes.' });
      if (error.statusCode === 404) return res.status(404).json({ error: 'No live quote is available for this stock.' });
      if (error.statusCode === 503) return res.status(503).json({ error: 'Live market data is not configured.' });
      return respondServerError(res, error, 'Unable to retrieve the latest market quote.');
    }
  };

  return { status, health, listStocks, getStock, quote };
}

module.exports = { createSystemController };
