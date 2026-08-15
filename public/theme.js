(function initTheme() {
  const THEME_KEY = 'stock_portfolio_theme';
  const LIGHT = 'light';
  const DARK = 'dark';

  function getInitialTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === LIGHT || saved === DARK) {
      return saved;
    }
    return DARK;
  }

  function getNextTheme(current) {
    return current === LIGHT ? DARK : LIGHT;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.textContent = theme === LIGHT ? 'Dark Mode' : 'Light Mode';
      toggle.setAttribute('aria-label', `Switch to ${theme === LIGHT ? 'dark' : 'light'} mode`);
    }
  }

  function attachToggle(toggle) {
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || DARK;
      applyTheme(getNextTheme(current));
    });
  }

  function ensureToggle() {
    if (document.querySelector('.theme-toggle')) {
      return;
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'theme-toggle';

    const topbarNav = document.querySelector('.topbar nav');
    if (topbarNav) {
      topbarNav.appendChild(toggle);
    } else {
      toggle.classList.add('floating');
      document.body.appendChild(toggle);
    }

    attachToggle(toggle);
    applyTheme(document.documentElement.getAttribute('data-theme') || DARK);
  }

  applyTheme(getInitialTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureToggle);
  } else {
    ensureToggle();
  }
})();
