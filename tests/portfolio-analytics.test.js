const { calculatePortfolioAnalytics } = require('../server/services/portfolio-analytics');

const holding = (overrides = {}) => ({
  stock_name: 'Reliance Industries',
  stock_symbol: 'RELIANCE',
  quantity: 10,
  buy_price: 100,
  current_price: 120,
  invested: 1000,
  currentValue: 1200,
  profitLoss: 200,
  profitLossPercent: 20,
  ...overrides
});

describe('calculatePortfolioAnalytics', () => {
  test('returns a safe empty response for a new portfolio', () => {
    const analytics = calculatePortfolioAnalytics([]);
    expect(analytics.summary).toMatchObject({ holdingsCount: 0, currentValue: 0 });
    expect(analytics.allocation).toEqual([]);
  });

  test('calculates allocation, sector allocation, and performance leaders', () => {
    const analytics = calculatePortfolioAnalytics([
      holding(),
      holding({ stock_name: 'Tata Consultancy Services', stock_symbol: 'TCS', invested: 2000, currentValue: 1800, profitLoss: -200, profitLossPercent: -10, quantity: 10, buy_price: 200, current_price: 180 })
    ]);

    expect(analytics.summary).toMatchObject({ holdingsCount: 2, totalInvestment: 3000, currentValue: 3000, overallReturnPercent: 0 });
    expect(analytics.topPerformer).toMatchObject({ symbol: 'RELIANCE', returnPercent: 20 });
    expect(analytics.weakestPerformer).toMatchObject({ symbol: 'TCS', returnPercent: -10 });
    expect(analytics.allocation.map((item) => item.sharePercent)).toEqual([60, 40]);
    expect(analytics.sectorAllocation).toHaveLength(2);
  });
});
