const currentPath = window.location.pathname;
const currentPage = currentPath.split('/').pop() || 'index.html';

async function requireAuthRedirect() {
  const response = await apiFetch('/api/status');
  const data = await response.json();
  if (!data.authenticated) {
    window.location.href = 'index.html';
  }
}

async function handleLogout() {
  const response = await apiFetch('/api/logout', { method: 'POST' });
  if (response.ok) {
    window.location.href = 'index.html';
  }
}

function bindLogoutLink() {
  const logoutLink = document.getElementById('logout-link');
  if (!logoutLink) {
    return;
  }

  logoutLink.addEventListener('click', async (event) => {
    event.preventDefault();
    await handleLogout();
  });
}

function formatCurrency(value) {
  return `Rs ${Number(value).toFixed(2)}`;
}

function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-IN');
}

async function loadProfileSummary(target) {
  if (!target) {
    return;
  }

  const response = await apiFetch('/api/profile');
  if (!response.ok) {
    return;
  }

  const data = await response.json();
  target.textContent = data.user.name || 'Investor';
}

async function fetchPortfolio(search = '', filter = 'all') {
  const query = new URLSearchParams({ search, filter });
  const response = await apiFetch(`/api/portfolio?${query.toString()}`);

  if (!response.ok) {
    window.location.href = 'index.html';
    return null;
  }

  return response.json();
}

async function fetchTransactions() {
  const response = await apiFetch('/api/transactions');

  if (!response.ok) {
    window.location.href = 'index.html';
    return null;
  }

  return response.json();
}

function renderAllocation(portfolio, totalValue, allocationList) {
  if (!allocationList) {
    return;
  }

  if (!portfolio.length || totalValue <= 0) {
    allocationList.innerHTML = `
      <div class="empty-state compact-empty">
        <strong>No allocations yet</strong>
        <p>Your top holdings by current value will be visualized here.</p>
      </div>
    `;
    return;
  }

  allocationList.innerHTML = [...portfolio]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5)
    .map((item) => {
      const share = (item.currentValue / totalValue) * 100;
      return `
        <div class="allocation-row">
          <div class="allocation-header">
            <strong>${item.stock_name}</strong>
            <span>${formatPercent(share)} • ${formatCurrency(item.currentValue)}</span>
          </div>
          <div class="allocation-bar">
            <div class="allocation-fill" style="width: ${Math.max(share, 6)}%"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderInsights(portfolio, totals, elements) {
  const profitableItems = portfolio.filter((item) => item.profitLoss > 0);
  const topItem = [...portfolio].sort((a, b) => b.profitLoss - a.profitLoss)[0];
  const weakestItem = [...portfolio].sort((a, b) => a.profitLoss - b.profitLoss)[0];
  const largestItem = [...portfolio].sort((a, b) => b.currentValue - a.currentValue)[0];
  const winRate = portfolio.length ? (profitableItems.length / portfolio.length) * 100 : 0;

  elements.heroHoldingsCount.textContent = `${portfolio.length} Holding${portfolio.length === 1 ? '' : 's'}`;
  elements.heroWinRate.textContent = portfolio.length
    ? `${formatPercent(winRate)} of positions are currently profitable.`
    : 'Win rate will appear here after you add positions.';

  if (topItem) {
    elements.topPerformer.textContent = topItem.stock_name;
    elements.topPerformerNote.textContent = `${formatCurrency(topItem.profitLoss)} gain, ${formatPercent(topItem.profitLossPercent)} return.`;
  } else {
    elements.topPerformer.textContent = 'No data yet';
    elements.topPerformerNote.textContent = 'Add holdings to see the strongest position.';
  }

  if (weakestItem) {
    elements.riskStock.textContent = weakestItem.stock_name;
    elements.riskStockNote.textContent =
      weakestItem.profitLoss < 0
        ? `${formatCurrency(Math.abs(weakestItem.profitLoss))} below cost basis right now.`
        : 'No positions are in the red right now.';
  } else {
    elements.riskStock.textContent = 'No data yet';
    elements.riskStockNote.textContent = 'Loss-making positions will show up here.';
  }

  if (largestItem && totals.currentValue > 0) {
    elements.largestPosition.textContent = largestItem.stock_name;
    elements.largestPositionNote.textContent = `${formatPercent((largestItem.currentValue / totals.currentValue) * 100)} of portfolio value.`;
  } else {
    elements.largestPosition.textContent = 'No data yet';
    elements.largestPositionNote.textContent = 'Your biggest capital allocation will appear here.';
  }

  if (portfolio.length >= 8) {
    elements.diversificationScore.textContent = 'Strong';
    elements.diversificationNote.textContent = 'You have a healthy spread of holdings, which reduces concentration risk.';
  } else if (portfolio.length >= 4) {
    elements.diversificationScore.textContent = 'Balanced';
    elements.diversificationNote.textContent = 'The portfolio is diversifying well, with room to broaden sector exposure.';
  } else if (portfolio.length >= 1) {
    elements.diversificationScore.textContent = 'Focused';
    elements.diversificationNote.textContent = 'A concentrated portfolio is easier to track, but carries higher single-stock risk.';
  } else {
    elements.diversificationScore.textContent = 'Starter';
    elements.diversificationNote.textContent = 'Spread risk by adding positions from multiple companies.';
  }

  renderAllocation(portfolio, totals.currentValue, elements.allocationList);
}

function renderPortfolioRows(portfolio, tableBody) {
  tableBody.innerHTML = '';

  portfolio.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.stock_name}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.buy_price)}</td>
      <td>${formatCurrency(item.current_price)}</td>
      <td>${formatCurrency(item.invested)}</td>
      <td>${formatCurrency(item.currentValue)}</td>
      <td class="stock-profit ${item.profitLoss >= 0 ? 'positive' : 'negative'}">${formatCurrency(item.profitLoss)}</td>
      <td class="stock-actions">
        <button type="button" class="secondary-btn" data-action="edit" data-id="${item.id}">Update</button>
        <button type="button" class="secondary-btn" data-action="delete" data-id="${item.id}">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function renderTransactionsRows(transactions, tableBody) {
  tableBody.innerHTML = '';

  transactions.forEach((tx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDateTime(tx.date)}</td>
      <td>${tx.stock_name}</td>
      <td><span class="table-type ${tx.type.toLowerCase()}">${tx.type}</span></td>
      <td>${tx.quantity}</td>
      <td>${formatCurrency(tx.price)}</td>
    `;
    tableBody.appendChild(row);
  });
}

function buildLineCoordinates(items, getValue, minValue, maxValue, width, height, padding) {
  const safeRange = Math.max(maxValue - minValue, 1);
  const step = items.length > 1 ? (width - padding * 2) / (items.length - 1) : 0;

  return items
    .map((item, index) => {
      const x = padding + (step * index);
      const normalized = (getValue(item) - minValue) / safeRange;
      const y = height - padding - normalized * (height - padding * 2);
      return {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2))
      };
    });
}

function initStockGraphPage() {
  requireAuthRedirect();
  bindLogoutLink();

  const graphSvg = document.getElementById('portfolio-graph');
  const graphWrap = document.getElementById('graph-wrap');
  const graphEmpty = document.getElementById('graph-empty');
  const graphHover = document.getElementById('graph-hover');
  const moversBody = document.querySelector('#movers-table tbody');
  const totalHoldingsEl = document.getElementById('graph-total-holdings');
  const avgReturnEl = document.getElementById('graph-average-return');

  function renderMovers(items) {
    moversBody.innerHTML = '';

    const movers = [...items]
      .sort((a, b) => b.profitLossPercent - a.profitLossPercent)
      .slice(0, 6);

    movers.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.stock_name}</td>
        <td>${formatCurrency(item.buy_price)}</td>
        <td>${formatCurrency(item.current_price)}</td>
        <td class="stock-profit ${item.profitLossPercent >= 0 ? 'positive' : 'negative'}">${formatPercent(item.profitLossPercent)}</td>
      `;
      moversBody.appendChild(row);
    });
  }

  function renderGraph(items) {
    if (!items.length) {
      graphWrap.classList.add('hidden');
      graphEmpty.classList.remove('hidden');
      moversBody.innerHTML = '';
      totalHoldingsEl.textContent = '0';
      avgReturnEl.textContent = '0.0%';
      graphHover.textContent = 'Hover a point to inspect stock values.';
      return;
    }

    graphWrap.classList.remove('hidden');
    graphEmpty.classList.add('hidden');

    const sorted = [...items].sort((a, b) => b.currentValue - a.currentValue);
    const width = 900;
    const height = 360;
    const padding = 40;
    const values = sorted.flatMap((item) => [item.buy_price, item.current_price]);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const buyCoordinates = buildLineCoordinates(sorted, (item) => item.buy_price, minValue, maxValue, width, height, padding);
    const currentCoordinates = buildLineCoordinates(sorted, (item) => item.current_price, minValue, maxValue, width, height, padding);
    const buyPoints = buyCoordinates.map((point) => `${point.x},${point.y}`).join(' ');
    const currentPoints = currentCoordinates.map((point) => `${point.x},${point.y}`).join(' ');
    const currentArea = `${padding},${height - padding} ${currentPoints} ${width - padding},${height - padding}`;

    const gridLines = Array.from({ length: 5 }, (_, index) => {
      const y = padding + ((height - padding * 2) / 4) * index;
      const value = maxValue - ((maxValue - minValue) / 4) * index;
      return `
        <line x1="${padding}" y1="${y.toFixed(2)}" x2="${width - padding}" y2="${y.toFixed(2)}" class="grid-line"></line>
        <text x="${padding - 10}" y="${(y + 4).toFixed(2)}" text-anchor="end" class="axis-label">${formatCurrency(value)}</text>
      `;
    }).join('');

    const labels = sorted
      .map((item, index) => {
        const step = sorted.length > 1 ? (width - padding * 2) / (sorted.length - 1) : 0;
        const x = padding + (step * index);
        const y = height - 12;
        return `<text x="${x.toFixed(2)}" y="${y}" text-anchor="middle" class="axis-label">${item.stock_name.slice(0, 6)}</text>`;
      })
      .join('');

    const pointGroups = sorted.map((item, index) => {
      const buyPoint = buyCoordinates[index];
      const currentPoint = currentCoordinates[index];
      return `
        <g>
          <circle cx="${buyPoint.x}" cy="${buyPoint.y}" r="4.5" class="graph-point buy-point"></circle>
          <circle cx="${currentPoint.x}" cy="${currentPoint.y}" r="4.5" class="graph-point current-point"></circle>
          <circle cx="${currentPoint.x}" cy="${currentPoint.y}" r="14" class="graph-point-hit" data-index="${index}"></circle>
        </g>
      `;
    }).join('');

    graphSvg.innerHTML = `
      ${gridLines}
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="axis-line"></line>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis-line"></line>
      <polygon points="${currentArea}" class="current-area"></polygon>
      <polyline points="${buyPoints}" class="graph-line buy-line"></polyline>
      <polyline points="${currentPoints}" class="graph-line current-line"></polyline>
      ${pointGroups}
      ${labels}
    `;

    const avgReturn = sorted.reduce((total, item) => total + item.profitLossPercent, 0) / sorted.length;
    totalHoldingsEl.textContent = String(sorted.length);
    avgReturnEl.textContent = formatPercent(avgReturn);
    avgReturnEl.className = avgReturn >= 0 ? 'stock-profit positive' : 'stock-profit negative';
    renderMovers(sorted);

    graphHover.textContent = `Best performer: ${sorted.reduce((best, item) => (
      item.profitLossPercent > best.profitLossPercent ? item : best
    ), sorted[0]).stock_name}`;

    graphSvg.querySelectorAll('.graph-point-hit').forEach((pointEl) => {
      pointEl.addEventListener('mouseenter', () => {
        const index = Number(pointEl.dataset.index);
        const item = sorted[index];
        graphHover.textContent = `${item.stock_name}: Buy ${formatCurrency(item.buy_price)} | Current ${formatCurrency(item.current_price)} | Return ${formatPercent(item.profitLossPercent)}`;
      });
    });

    graphSvg.addEventListener('mouseleave', () => {
      graphHover.textContent = 'Hover a point to inspect stock values.';
    });
  }

  async function loadGraphPage() {
    const data = await fetchPortfolio();
    if (!data) {
      return;
    }
    renderGraph(data.portfolio || []);
  }

  loadGraphPage();
}

function setupPortfolioPage(options) {
  const {
    tableBody,
    transactionBody,
    portfolioEmpty,
    transactionEmpty,
    searchInput,
    filterSelect,
    messageEl,
    totalInvestmentEl,
    currentValueEl,
    profitLossEl,
    holdingsTotalEl,
    transactionCountEl,
    editDialog,
    editForm,
    editMessage,
    editStockId,
    editStockTitle,
    editQuantity,
    editBuyPrice,
    editCurrentPrice
  } = options;

  function openEditDialog(item) {
    editMessage.textContent = '';
    editStockId.value = item.id;
    editStockTitle.textContent = `Update ${item.stock_name}`;
    editQuantity.value = item.quantity;
    editBuyPrice.value = item.buy_price;
    editCurrentPrice.value = item.current_price;
    editDialog.showModal();
  }

  function closeEditDialog() {
    editDialog.close();
    editForm.reset();
    editMessage.textContent = '';
  }

  async function loadRecords() {
    const portfolioData = await fetchPortfolio(searchInput.value.trim(), filterSelect.value);
    if (!portfolioData) {
      return;
    }

    const transactionsData = await fetchTransactions();
    if (!transactionsData) {
      return;
    }

    totalInvestmentEl.textContent = formatCurrency(portfolioData.totals.totalInvestment);
    currentValueEl.textContent = formatCurrency(portfolioData.totals.currentValue);
    profitLossEl.textContent = formatCurrency(portfolioData.totals.totalProfitLoss);
    profitLossEl.className = portfolioData.totals.totalProfitLoss >= 0 ? 'stock-profit positive' : 'stock-profit negative';

    if (holdingsTotalEl) {
      holdingsTotalEl.textContent = `${portfolioData.portfolio.length} Holding${portfolioData.portfolio.length === 1 ? '' : 's'}`;
    }

    if (transactionCountEl) {
      transactionCountEl.textContent = `${transactionsData.transactions.length} Entries`;
    }

    portfolioEmpty.classList.toggle('hidden', portfolioData.portfolio.length > 0);
    transactionEmpty.classList.toggle('hidden', transactionsData.transactions.length > 0);

    renderPortfolioRows(portfolioData.portfolio, tableBody);
    renderTransactionsRows(transactionsData.transactions, transactionBody);
  }

  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === 'delete') {
      if (!confirm('Delete this stock position from your portfolio?')) {
        return;
      }

      await apiFetch(`/api/portfolio/${id}`, { method: 'DELETE' });
      await loadRecords();
    }

    if (action === 'edit') {
      const currentRow = button.closest('tr');
      openEditDialog({
        id,
        stock_name: currentRow.children[0].textContent,
        quantity: currentRow.children[1].textContent,
        buy_price: currentRow.children[2].textContent.replace('Rs ', ''),
        current_price: currentRow.children[3].textContent.replace('Rs ', '')
      });
    }
  });

  document.getElementById('edit-close').addEventListener('click', closeEditDialog);
  document.getElementById('edit-cancel').addEventListener('click', closeEditDialog);

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    editMessage.textContent = '';

    const response = await apiFetch(`/api/portfolio/${editStockId.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: editQuantity.value,
        buyPrice: editBuyPrice.value,
        currentPrice: editCurrentPrice.value
      })
    });
    const data = await response.json();

    if (response.ok) {
      messageEl.textContent = 'Holding updated successfully.';
      closeEditDialog();
      await loadRecords();
    } else {
      editMessage.textContent = data.error || 'Update failed.';
    }
  });

  editDialog.addEventListener('click', (event) => {
    const rect = editForm.getBoundingClientRect();
    const isOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (isOutside) {
      closeEditDialog();
    }
  });

  editDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeEditDialog();
  });

  searchInput.addEventListener('input', loadRecords);
  filterSelect.addEventListener('change', loadRecords);

  return { loadRecords };
}

function initDashboardPage() {
  requireAuthRedirect();
  bindLogoutLink();

  const stockForm = document.getElementById('stock-form');
  const stockNameInput = document.getElementById('stock-name');
  const stockSymbolInput = document.getElementById('stock-symbol');
  const quantityInput = document.getElementById('quantity');
  const buyPriceInput = document.getElementById('buy-price');
  const currentPriceInput = document.getElementById('current-price');
  const buyTotalPreview = document.getElementById('buy-total-preview');
  const currentTotalPreview = document.getElementById('current-total-preview');
  const suggestionsEl = document.getElementById('stock-suggestions');
  const messageEl = document.getElementById('stock-message');
  const totalInvestment = document.getElementById('total-investment');
  const currentValue = document.getElementById('current-value');
  const profitLoss = document.getElementById('profit-loss');
  const heroUserName = document.getElementById('hero-user-name');
  const heroDate = document.getElementById('hero-date');
  const heroTime = document.getElementById('hero-time');
  let suggestionItems = [];
  let suggestionRequestId = 0;

  function toPositiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function updatePricePreviews() {
    const quantity = toPositiveNumber(quantityInput.value);
    const buyPrice = toPositiveNumber(buyPriceInput.value);
    const currentPrice = toPositiveNumber(currentPriceInput.value);
    const buyTotal = quantity * buyPrice;
    const currentTotal = quantity * currentPrice;

    if (buyTotalPreview) {
      buyTotalPreview.textContent = `Total Buy Value: ${formatCurrency(buyTotal)}`;
    }

    if (currentTotalPreview) {
      currentTotalPreview.textContent = `Total Current Value: ${formatCurrency(currentTotal)}`;
    }
  }

  const insightElements = {
    heroHoldingsCount: document.getElementById('hero-holdings-count'),
    heroWinRate: document.getElementById('hero-win-rate'),
    topPerformer: document.getElementById('top-performer'),
    topPerformerNote: document.getElementById('top-performer-note'),
    riskStock: document.getElementById('risk-stock'),
    riskStockNote: document.getElementById('risk-stock-note'),
    largestPosition: document.getElementById('largest-position'),
    largestPositionNote: document.getElementById('largest-position-note'),
    diversificationScore: document.getElementById('diversification-score'),
    diversificationNote: document.getElementById('diversification-note'),
    allocationList: document.getElementById('allocation-list')
  };

  function updateHeroDateTime() {
    const now = new Date();

    heroDate.textContent = new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(now);

    if (heroTime) {
      heroTime.textContent = new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      }).format(now);
    }
  }

  updateHeroDateTime();
  window.setInterval(updateHeroDateTime, 1000);

  function hideSuggestions() {
    suggestionsEl.classList.add('hidden');
    suggestionsEl.innerHTML = '';
  }

  function selectStock(stock) {
    stockNameInput.value = `${stock.name} (${stock.symbol})`;
    stockSymbolInput.value = stock.symbol;
    currentPriceInput.value = stock.price;
    updatePricePreviews();
    hideSuggestions();
  }

  function renderSuggestions(stocks) {
    suggestionItems = stocks;
    if (!stocks.length) {
      suggestionsEl.innerHTML = '<div class="stock-suggestion empty">No matching listed company found.</div>';
      suggestionsEl.classList.remove('hidden');
      return;
    }

    suggestionsEl.innerHTML = stocks
      .map(
        (stock, index) => `
          <button type="button" class="stock-suggestion" data-index="${index}">
            <span>${stock.name}</span>
            <strong>${stock.symbol}</strong>
            <small>${formatCurrency(stock.price)}</small>
          </button>
        `
      )
      .join('');
    suggestionsEl.classList.remove('hidden');
  }

  async function loadStockSuggestions(query) {
    suggestionRequestId += 1;
    const requestId = suggestionRequestId;
    const response = await apiFetch(`/api/stocks?query=${encodeURIComponent(query)}`);
    if (!response.ok || requestId !== suggestionRequestId) {
      return;
    }

    const data = await response.json();
    renderSuggestions(data.stocks || []);
  }

  async function loadDashboard() {
    const data = await fetchPortfolio();
    if (!data) {
      return;
    }

    if (totalInvestment) {
      totalInvestment.textContent = formatCurrency(data.totals.totalInvestment);
    }

    if (currentValue) {
      currentValue.textContent = formatCurrency(data.totals.currentValue);
    }

    if (profitLoss) {
      profitLoss.textContent = formatCurrency(data.totals.totalProfitLoss);
      profitLoss.className = data.totals.totalProfitLoss >= 0 ? 'stock-profit positive' : 'stock-profit negative';
    }

    renderInsights(data.portfolio, data.totals, insightElements);
  }

  stockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageEl.textContent = '';

    const stockName = stockNameInput.value.trim();
    const quantity = document.getElementById('quantity').value;
    const buyPrice = buyPriceInput.value;
    const currentPrice = currentPriceInput.value;

    if (!stockSymbolInput.value || !currentPrice) {
      messageEl.textContent = 'Please choose a company from the suggestions so current price can fill automatically.';
      return;
    }

    const response = await apiFetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockName, quantity, buyPrice, currentPrice })
    });
    const data = await response.json();

    if (response.ok) {
      messageEl.textContent = 'Stock added successfully.';
      stockForm.reset();
      stockSymbolInput.value = '';
      currentPriceInput.value = '';
      updatePricePreviews();
      await loadDashboard();
    } else {
      messageEl.textContent = data.error || 'Failed to add stock.';
    }
  });

  stockNameInput.addEventListener('input', async () => {
    stockSymbolInput.value = '';
    buyPriceInput.value = '';
    currentPriceInput.value = '';
    updatePricePreviews();
    const query = stockNameInput.value.trim();
    if (query.length < 1) {
      hideSuggestions();
      return;
    }
    await loadStockSuggestions(query);
  });

  stockNameInput.addEventListener('focus', async () => {
    const query = stockNameInput.value.trim();
    if (query.length >= 1) {
      await loadStockSuggestions(query);
    }
  });

  suggestionsEl.addEventListener('click', (event) => {
    const button = event.target.closest('.stock-suggestion[data-index]');
    if (!button) {
      return;
    }

    const stock = suggestionItems[Number(button.dataset.index)];
    if (stock) {
      selectStock(stock);
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.stock-picker')) {
      hideSuggestions();
    }
  });

  quantityInput.addEventListener('input', updatePricePreviews);
  buyPriceInput.addEventListener('input', updatePricePreviews);
  currentPriceInput.addEventListener('input', updatePricePreviews);

  loadProfileSummary(heroUserName);
  updatePricePreviews();
  loadDashboard();
}

function initPortfolioRecordsPage() {
  requireAuthRedirect();
  bindLogoutLink();

  const recordsPage = setupPortfolioPage({
    tableBody: document.querySelector('#portfolio-table tbody'),
    transactionBody: document.querySelector('#transaction-table tbody'),
    portfolioEmpty: document.getElementById('portfolio-empty'),
    transactionEmpty: document.getElementById('transaction-empty'),
    searchInput: document.getElementById('search-input'),
    filterSelect: document.getElementById('filter-select'),
    messageEl: document.getElementById('records-message'),
    totalInvestmentEl: document.getElementById('total-investment'),
    currentValueEl: document.getElementById('current-value'),
    profitLossEl: document.getElementById('profit-loss'),
    holdingsTotalEl: document.getElementById('holdings-total'),
    transactionCountEl: document.getElementById('transactions-total'),
    editDialog: document.getElementById('edit-dialog'),
    editForm: document.getElementById('edit-form'),
    editMessage: document.getElementById('edit-message'),
    editStockId: document.getElementById('edit-stock-id'),
    editStockTitle: document.getElementById('edit-stock-title'),
    editQuantity: document.getElementById('edit-quantity'),
    editBuyPrice: document.getElementById('edit-buy-price'),
    editCurrentPrice: document.getElementById('edit-current-price')
  });

  recordsPage.loadRecords();
}

function initProfilePage() {
  requireAuthRedirect();
  bindLogoutLink();

  const profileForm = document.getElementById('profile-form');
  const passwordForm = document.getElementById('password-form');
  const profileMessage = document.getElementById('profile-message');
  const passwordMessage = document.getElementById('password-message');

  async function loadProfile() {
    const response = await apiFetch('/api/profile');
    if (!response.ok) {
      window.location.href = 'index.html';
      return;
    }

    const data = await response.json();
    document.getElementById('profile-name').value = data.user.name;
    document.getElementById('profile-email').value = data.user.email;
  }

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    profileMessage.textContent = '';
    const name = document.getElementById('profile-name').value.trim().replace(/\s+/g, ' ');
    const email = document.getElementById('profile-email').value.trim();
    if (name.length < 2 || name.length > 50) {
      profileMessage.textContent = 'Name must be 2 to 50 characters.';
      return;
    }
    const response = await apiFetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    const data = await response.json();
    profileMessage.textContent = response.ok ? 'Profile updated.' : data.error || 'Update failed.';
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordMessage.textContent = '';
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const response = await apiFetch('/api/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await response.json();
    passwordMessage.textContent = response.ok ? 'Password changed successfully.' : data.error || 'Update failed.';
    if (response.ok) {
      passwordForm.reset();
    }
  });

  loadProfile();
}

if (currentPage === 'dashboard.html') {
  initDashboardPage();
}

if (currentPage === 'portfolio.html') {
  initPortfolioRecordsPage();
}

if (currentPage === 'profile.html') {
  initProfilePage();
}

if (currentPage === 'stock-graph.html') {
  initStockGraphPage();
}
