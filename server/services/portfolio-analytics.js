const SECTOR_BY_SYMBOL = {
  RELIANCE: 'Energy', GAIL: 'Energy', TCS: 'Information Technology', INFY: 'Information Technology',
  HCLTECH: 'Information Technology', TECHM: 'Information Technology', PERSISTENT: 'Information Technology',
  MPHASIS: 'Information Technology', LTIM: 'Information Technology', WIPRO: 'Information Technology',
  HDFCBANK: 'Financial Services', ICICIBANK: 'Financial Services', SBIN: 'Financial Services',
  AXISBANK: 'Financial Services', KOTAKBANK: 'Financial Services', BAJFINANCE: 'Financial Services',
  ITC: 'Consumer Staples', HINDUNILVR: 'Consumer Staples', ASIANPAINT: 'Consumer Discretionary',
  MARUTI: 'Automobile', TATAMOTORS: 'Automobile', 'M&M': 'Automobile', TITAN: 'Consumer Discretionary',
  LT: 'Industrials', ULTRACEMCO: 'Materials', GLAND: 'Healthcare', GLAXO: 'Healthcare',
  SUNPHARMA: 'Healthcare', CIPLA: 'Healthcare'
};

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculatePortfolioAnalytics(portfolio) {
  const totals = portfolio.reduce((acc, item) => {
    acc.totalInvestment += item.invested;
    acc.currentValue += item.currentValue;
    acc.totalProfitLoss += item.profitLoss;
    acc.todayProfitLoss += (item.current_price - (item.previous_close || item.current_price)) * item.quantity;
    return acc;
  }, { totalInvestment: 0, currentValue: 0, totalProfitLoss: 0, todayProfitLoss: 0 });

  if (!portfolio.length) {
    return { summary: { holdingsCount: 0, profitableCount: 0, losingCount: 0, winRate: 0, averageReturnPercent: 0, totalInvestment: 0, currentValue: 0, totalProfitLoss: 0, todayProfitLoss: 0, overallReturnPercent: 0, diversificationScore: 0 }, topPerformer: null, weakestPerformer: null, largestAllocation: null, allocation: [], sectorAllocation: [] };
  }

  const byReturn = [...portfolio].sort((a, b) => b.profitLossPercent - a.profitLossPercent);
  const byValue = [...portfolio].sort((a, b) => b.currentValue - a.currentValue);
  const sectorValues = new Map();
  portfolio.forEach((item) => {
    const sector = SECTOR_BY_SYMBOL[item.stock_symbol] || 'Other';
    sectorValues.set(sector, (sectorValues.get(sector) || 0) + item.currentValue);
  });
  const sectorAllocation = [...sectorValues.entries()]
    .map(([sector, value]) => ({ sector, value: round(value), sharePercent: totals.currentValue ? round((value / totals.currentValue) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
  const largest = byValue[0];
  const allocation = byValue.map((item) => ({ stock: item.stock_name, symbol: item.stock_symbol, value: round(item.currentValue), sharePercent: totals.currentValue ? round((item.currentValue / totals.currentValue) * 100) : 0 }));
  const effectiveHoldings = totals.currentValue ? 1 / portfolio.reduce((sum, item) => sum + Math.pow(item.currentValue / totals.currentValue, 2), 0) : 0;
  const diversificationScore = Math.min(100, Math.round((effectiveHoldings / 8) * 70 + (sectorValues.size / 5) * 30));
  const performance = (item) => ({ stock: item.stock_name, symbol: item.stock_symbol, returnPercent: round(item.profitLossPercent), profitLoss: round(item.profitLoss) });

  return {
    summary: {
      holdingsCount: portfolio.length,
      profitableCount: portfolio.filter((item) => item.profitLoss > 0).length,
      losingCount: portfolio.filter((item) => item.profitLoss < 0).length,
      winRate: round((portfolio.filter((item) => item.profitLoss > 0).length / portfolio.length) * 100),
      averageReturnPercent: round(portfolio.reduce((sum, item) => sum + item.profitLossPercent, 0) / portfolio.length),
      totalInvestment: round(totals.totalInvestment), currentValue: round(totals.currentValue),
      totalProfitLoss: round(totals.totalProfitLoss), todayProfitLoss: round(totals.todayProfitLoss),
      overallReturnPercent: totals.totalInvestment ? round((totals.totalProfitLoss / totals.totalInvestment) * 100) : 0,
      diversificationScore
    },
    topPerformer: performance(byReturn[0]),
    weakestPerformer: performance(byReturn[byReturn.length - 1]),
    largestAllocation: { stock: largest.stock_name, symbol: largest.stock_symbol, value: round(largest.currentValue), sharePercent: totals.currentValue ? round((largest.currentValue / totals.currentValue) * 100) : 0 },
    allocation,
    sectorAllocation
  };
}

module.exports = { calculatePortfolioAnalytics };
