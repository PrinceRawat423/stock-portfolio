require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { MongoClient, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/stock_portfolio';
const dbName = process.env.MONGO_DB_NAME || 'stock_portfolio';

let usersCollection;
let portfolioCollection;
let transactionsCollection;
let sessionMiddleware;
const passwordResetOtps = new Map();
const stockCatalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'stocks.json'), 'utf8')
);
const otpLifetimeMs = 10 * 60 * 1000;
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const allowDevOtpFallback =
  String(process.env.DEV_OTP_FALLBACK || 'false').toLowerCase() === 'true' && !isProduction;
const oauthRedirectBase = process.env.OAUTH_REDIRECT_BASE || `http://localhost:${port}`;

function hasRealEnvValue(value, placeholders = []) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }

  return !placeholders.includes(normalized.toLowerCase());
}

const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const smtpHostConfigured = hasRealEnvValue(process.env.SMTP_HOST);
const smtpUserConfigured = hasRealEnvValue(process.env.SMTP_USER, ['your_email@gmail.com']);
const smtpPassConfigured = hasRealEnvValue(process.env.SMTP_PASS, ['your_app_password']);
const mailTransport =
  smtpHostConfigured && smtpUserConfigured && smtpPassConfigured
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number.isNaN(smtpPort) ? 587 : smtpPort,
        secure: smtpSecure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })
    : null;
const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@example.com';
const EMPTY_ANALYTICS_RESPONSE = {
  summary: {
    holdingsCount: 0,
    profitableCount: 0,
    losingCount: 0,
    winRate: 0,
    averageReturnPercent: 0
  },
  topPerformer: null,
  weakestPerformer: null,
  largestAllocation: null,
  allocation: []
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isFileOrigin = origin === 'null';
  const isAllowedLocalOrigin = (() => {
    if (!origin) {
      return false;
    }

    try {
      const originUrl = new URL(origin);
      return ['localhost', '127.0.0.1'].includes(originUrl.hostname);
    } catch {
      return false;
    }
  })();

  if (isAllowedLocalOrigin || isFileOrigin) {
    res.header('Access-Control-Allow-Origin', isFileOrigin ? 'null' : origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});
app.use((req, res, next) => {
  if (!sessionMiddleware) {
    return res.status(503).json({ error: 'Server is still connecting to the database.' });
  }
  return sessionMiddleware(req, res, next);
});
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

function respondServerError(res, error, message) {
  console.error(error);
  return res.status(500).json({ error: message });
}

function parseUserId(userId) {
  try {
    return new ObjectId(userId);
  } catch (error) {
    return null;
  }
}

function mapUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    created_at: user.created_at
  };
}

function mapPortfolioItem(item) {
  const invested = item.quantity * item.buy_price;
  const currentValue = item.quantity * item.current_price;
  const profitLoss = currentValue - invested;
  const profitLossPercent = invested ? (profitLoss / invested) * 100 : 0;

  return {
    id: item._id.toString(),
    stock_symbol: item.stock_symbol || '',
    stock_name: item.stock_name,
    quantity: item.quantity,
    buy_price: item.buy_price,
    current_price: item.current_price,
    created_at: item.created_at,
    invested,
    currentValue,
    profitLoss,
    profitLossPercent
  };
}

function mapTransaction(transaction) {
  return {
    id: transaction._id.toString(),
    user_id: transaction.user_id.toString(),
    stock_symbol: transaction.stock_symbol || '',
    stock_name: transaction.stock_name,
    type: transaction.type,
    quantity: transaction.quantity,
    price: transaction.price,
    date: transaction.date
  };
}

function parseSessionUserId(req) {
  return parseUserId(req.session.userId);
}

function ensureSessionUserId(req, res) {
  const userId = parseSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeProvider(provider) {
  return String(provider || '').trim().toLowerCase();
}

function getOAuthConfig(provider) {
  const redirectUri = `${oauthRedirectBase}/auth/${provider}/callback`;
  const baseConfig = {
    redirectUri
  };

  if (provider === 'google') {
    return {
      ...baseConfig,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile'
    };
  }

  if (provider === 'facebook') {
    return {
      ...baseConfig,
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
      scope: 'email public_profile'
    };
  }

  if (provider === 'apple') {
    return {
      ...baseConfig,
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      authUrl: 'https://appleid.apple.com/auth/authorize',
      tokenUrl: 'https://appleid.apple.com/auth/token',
      scope: 'name email'
    };
  }

  return null;
}

function createStateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function createAppleClientSecret(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: config.teamId,
      iat: now,
      exp: now + 60 * 60 * 24 * 180,
      aud: 'https://appleid.apple.com',
      sub: config.clientId
    })
  ).toString('base64url');
  const toSign = `${header}.${payload}`;
  const signer = crypto.createSign('SHA256');
  signer.update(toSign);
  signer.end();
  const signature = signer.sign(config.privateKey, 'base64url');
  return `${toSign}.${signature}`;
}

function parseJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) {
      return null;
    }
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

async function upsertSocialUser({ provider, providerId, email, name }) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedProvider || !providerId || !normalizedEmail) {
    throw new Error('SOCIAL_PROFILE_INCOMPLETE');
  }

  const fallbackName = `${normalizedProvider[0].toUpperCase()}${normalizedProvider.slice(1)} User`;
  const normalizedName = normalizeName(name || fallbackName);
  const socialProviderId = String(providerId);
  const socialQuery = {
    social_provider: normalizedProvider,
    social_provider_id: socialProviderId
  };

  const existingByProvider = await usersCollection.findOne(socialQuery);
  if (existingByProvider) {
    return existingByProvider;
  }

  const existingByEmail = await usersCollection.findOne({ email: normalizedEmail });
  if (existingByEmail) {
    await usersCollection.updateOne(
      { _id: existingByEmail._id },
      {
        $set: {
          social_provider: normalizedProvider,
          social_provider_id: socialProviderId,
          name: existingByEmail.name || normalizedName
        }
      }
    );
    return { ...existingByEmail, social_provider: normalizedProvider, social_provider_id: socialProviderId };
  }

  const result = await usersCollection.insertOne({
    name: normalizedName,
    email: normalizedEmail,
    created_at: new Date().toISOString(),
    social_provider: normalizedProvider,
    social_provider_id: socialProviderId
  });
  return {
    _id: result.insertedId,
    name: normalizedName,
    email: normalizedEmail,
    social_provider: normalizedProvider,
    social_provider_id: socialProviderId
  };
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function isValidUserName(name) {
  const normalized = String(name || '').trim();
  return normalized.length >= 2 && normalized.length <= 50;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseBoundedPositiveInt(value, defaultValue, maxValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = parsePositiveInt(value);
  if (!parsed) {
    return null;
  }

  return Math.min(parsed, maxValue);
}

function parsePositiveFloat(value) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Number(parsed.toFixed(2));
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSymbolFromStockName(stockName) {
  const match = String(stockName || '').match(/\(([A-Za-z.\-]+)\)\s*$/);
  return match ? match[1].toUpperCase() : '';
}

function findStockByQuery(stockName, explicitSymbol = '') {
  const symbol = String(explicitSymbol || extractSymbolFromStockName(stockName)).trim().toUpperCase();
  if (symbol) {
    return stockCatalog.find((stock) => stock.symbol === symbol) || null;
  }

  const cleanedName = String(stockName || '').replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase();
  if (!cleanedName) {
    return null;
  }

  return (
    stockCatalog.find((stock) => stock.name.toLowerCase() === cleanedName) ||
    stockCatalog.find((stock) => stock.name.toLowerCase().includes(cleanedName)) ||
    null
  );
}

function calculateTotals(items) {
  return items.reduce(
    (acc, item) => {
      acc.totalInvestment += item.invested;
      acc.currentValue += item.currentValue;
      acc.totalProfitLoss += item.profitLoss;
      return acc;
    },
    { totalInvestment: 0, currentValue: 0, totalProfitLoss: 0 }
  );
}

function getFilteredPortfolio(portfolio, filter) {
  if (filter === 'profit') {
    return portfolio.filter((item) => item.profitLoss > 0);
  }
  if (filter === 'loss') {
    return portfolio.filter((item) => item.profitLoss < 0);
  }
  return portfolio;
}

async function loadOAuthProfile(provider, tokenData) {
  if (provider === 'google') {
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!profileResponse.ok) {
      throw new Error('google-profile-failed');
    }
    const googleProfile = await profileResponse.json();
    return {
      providerId: googleProfile.sub,
      email: googleProfile.email,
      name: googleProfile.name
    };
  }

  if (provider === 'facebook') {
    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,name,email');
    profileUrl.searchParams.set('access_token', tokenData.access_token);
    const profileResponse = await fetch(profileUrl);
    if (!profileResponse.ok) {
      throw new Error('facebook-profile-failed');
    }
    const facebookProfile = await profileResponse.json();
    return {
      providerId: facebookProfile.id,
      email: facebookProfile.email,
      name: facebookProfile.name
    };
  }

  const applePayload = parseJwtPayload(tokenData.id_token);
  return {
    providerId: applePayload?.sub,
    email: applePayload?.email,
    name: applePayload?.email ? applePayload.email.split('@')[0] : ''
  };
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendPasswordResetOtp(email, otp) {
  if (!mailTransport) {
    if (allowDevOtpFallback) {
      console.log(`[DEV OTP] Password reset OTP for ${email}: ${otp}`);
      return { mode: 'dev-fallback' };
    }

    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  await mailTransport.sendMail({
    from: mailFrom,
    to: email,
    subject: 'Your password reset OTP',
    text: `Your password reset OTP is ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Password reset request</h2>
        <p>Your OTP for password reset is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `
  });

  return { mode: 'email' };
}

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const normalizedName = normalizeName(name);
    if (!isValidUserName(normalizedName)) {
      return res.status(400).json({ error: 'Name must be 2 to 50 characters.' });
    }
    const passwordLength = String(password).length;
    if (passwordLength < 5 || passwordLength > 15) {
      return res.status(400).json({ error: 'Password must be 5 to 15 characters long.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await usersCollection.insertOne({
      name: normalizedName,
      email: normalizedEmail,
      password_hash,
      created_at: new Date().toISOString()
    });

    req.session.userId = result.insertedId.toString();
    return res.json({ success: true });
  } catch (error) {
    return respondServerError(res, error, 'Internal error during registration.');
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await usersCollection.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Use social login for this account.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user._id.toString();
    return res.json({ success: true });
  } catch (error) {
    return respondServerError(res, error, 'Login failed.');
  }
});

app.get('/auth/:provider', (req, res) => {
  const provider = normalizeProvider(req.params.provider);
  const config = getOAuthConfig(provider);
  if (!config) {
    return res.status(404).json({ error: 'Unsupported social provider.' });
  }

  if (!config.clientId || (provider !== 'apple' && !config.clientSecret)) {
    return res.redirect('/index.html?error=social-not-configured');
  }

  const state = createStateToken();
  req.session.oauthState = { state, provider };

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: provider === 'apple' ? 'code id_token' : 'code',
    scope: config.scope,
    state
  });

  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  if (provider === 'apple') {
    params.set('response_mode', 'query');
  }

  return res.redirect(`${config.authUrl}?${params.toString()}`);
});

app.get('/auth/:provider/callback', async (req, res) => {
  const provider = normalizeProvider(req.params.provider);
  const config = getOAuthConfig(provider);
  if (!config) {
    return res.redirect('/index.html?error=social-invalid-provider');
  }

  const savedState = req.session.oauthState;
  if (!savedState || savedState.provider !== provider || savedState.state !== req.query.state) {
    return res.redirect('/index.html?error=social-invalid-state');
  }

  delete req.session.oauthState;
  const code = String(req.query.code || '');
  if (!code) {
    return res.redirect('/index.html?error=social-missing-code');
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId
    });

    if (provider === 'apple') {
      if (!config.teamId || !config.keyId || !config.privateKey) {
        return res.redirect('/index.html?error=apple-config-missing');
      }
      tokenParams.set('client_secret', createAppleClientSecret(config));
    } else {
      tokenParams.set('client_secret', config.clientSecret);
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams
    });

    if (!tokenResponse.ok) {
      return res.redirect('/index.html?error=social-token-failed');
    }

    const tokenData = await tokenResponse.json();
    let profile;
    try {
      profile = await loadOAuthProfile(provider, tokenData);
    } catch (profileError) {
      if (profileError.message === 'google-profile-failed') {
        return res.redirect('/index.html?error=google-profile-failed');
      }
      if (profileError.message === 'facebook-profile-failed') {
        return res.redirect('/index.html?error=facebook-profile-failed');
      }
      throw profileError;
    }

    const user = await upsertSocialUser({
      provider,
      providerId: profile.providerId,
      email: profile.email,
      name: profile.name
    });
    req.session.userId = user._id.toString();
    return res.redirect('/dashboard.html');
  } catch (error) {
    console.error(error);
    return res.redirect('/index.html?error=social-login-failed');
  }
});

app.post('/api/forgot-password/request-otp', async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const user = await usersCollection.findOne({ email: normalizedEmail }, { projection: { _id: 1 } });
    if (!user) {
      return res.status(404).json({ error: 'No account found with that email.' });
    }

    const otp = generateOtp();
    passwordResetOtps.set(normalizedEmail, {
      otp,
      expiresAt: Date.now() + otpLifetimeMs
    });

    const delivery = await sendPasswordResetOtp(normalizedEmail, otp);
    if (delivery.mode === 'dev-fallback') {
      return res.json({
        success: true,
        message: 'Email service is not configured. In development mode, the OTP has been printed to the server console.'
      });
    }

    return res.json({ success: true, message: 'OTP sent to your email address.' });
  } catch (error) {
    if (error.message === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Email service is not configured on the server. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM in .env.'
      });
    }
    return respondServerError(res, error, 'Unable to send OTP right now.');
  }
});

app.post('/api/forgot-password/reset', async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();
  const newPassword = String(req.body.newPassword || '');

  if (!normalizedEmail || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  try {
    const otpRecord = passwordResetOtps.get(normalizedEmail);
    if (!otpRecord) {
      return res.status(400).json({ error: 'Please request a new OTP first.' });
    }

    if (Date.now() > otpRecord.expiresAt) {
      passwordResetOtps.delete(normalizedEmail);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const result = await usersCollection.updateOne(
      { email: normalizedEmail },
      { $set: { password_hash } }
    );

    if (result.matchedCount === 0) {
      passwordResetOtps.delete(normalizedEmail);
      return res.status(404).json({ error: 'No account found with that email.' });
    }

    passwordResetOtps.delete(normalizedEmail);
    return res.json({ success: true, message: 'Password reset successful. Redirecting to login...' });
  } catch (error) {
    return respondServerError(res, error, 'Internal error during password reset.');
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Logout failed.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

app.get('/api/profile', requireAuth, async (req, res) => {
  const userId = ensureSessionUserId(req, res);
  if (!userId) return;

  try {
    const user = await usersCollection.findOne(
      { _id: userId },
      { projection: { name: 1, email: 1, created_at: 1 } }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({ user: mapUser(user) });
  } catch (error) {
    return respondServerError(res, error, 'Unable to load profile.');
  }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const userId = ensureSessionUserId(req, res);
  if (!userId) return;

  try {
    const normalizedName = normalizeName(name);
    if (!isValidUserName(normalizedName)) {
      return res.status(400).json({ error: 'Name must be 2 to 50 characters.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await usersCollection.findOne({
      email: normalizedEmail,
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    await usersCollection.updateOne(
      { _id: userId },
      { $set: { name: normalizedName, email: normalizedEmail } }
    );

    return res.json({ success: true });
  } catch (error) {
    return respondServerError(res, error, 'Unable to update profile.');
  }
});

app.put('/api/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const userId = ensureSessionUserId(req, res);
  if (!userId) return;

  try {
    const user = await usersCollection.findOne(
      { _id: userId },
      { projection: { password_hash: 1 } }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await usersCollection.updateOne({ _id: userId }, { $set: { password_hash } });
    return res.json({ success: true });
  } catch (error) {
    return respondServerError(res, error, 'Password update failed.');
  }
});

app.get('/api/portfolio', requireAuth, async (req, res) => {
  const search = (req.query.search || '').trim();
  const filter = req.query.filter || 'all';
  const userId = ensureSessionUserId(req, res);
  if (!userId) return;

  try {
    const query = { user_id: userId };
    if (search) {
      query.stock_name = { $regex: escapeRegex(search), $options: 'i' };
    }

    const rows = await portfolioCollection.find(query).sort({ created_at: -1 }).toArray();
    const portfolio = rows.map(mapPortfolioItem);

    const filtered = getFilteredPortfolio(portfolio, filter);
    const totals = calculateTotals(filtered);

    return res.json({ portfolio: filtered, totals });
  } catch (error) {
    return respondServerError(res, error, 'Unable to load portfolio.');
  }
});

app.get('/api/portfolio/analytics', requireAuth, async (req, res) => {
  const userId = ensureSessionUserId(req, res);
  if (!userId) return;

  try {
    const rows = await portfolioCollection.find({ user_id: userId }).sort({ created_at: -1 }).toArray();
    const portfolio = rows.map(mapPortfolioItem);

    if (!portfolio.length) {
      return res.json(EMPTY_ANALYTICS_RESPONSE);
    }

    const totals = calculateTotals(portfolio);
    const profitableCount = portfolio.filter((item) => item.profitLoss > 0).length;
    const losingCount = portfolio.filter((item) => item.profitLoss < 0).length;
    const winRate = portfolio.length ? (profitableCount / portfolio.length) * 100 : 0;

    const sortedByReturn = [...portfolio].sort((a, b) => b.profitLossPercent - a.profitLossPercent);
    const sortedByValue = [...portfolio].sort((a, b) => b.currentValue - a.currentValue);

    const topPerformer = sortedByReturn[0];
    const weakestPerformer = sortedByReturn[sortedByReturn.length - 1];
    const largestAllocation = sortedByValue[0];

    const allocation = sortedByValue.slice(0, 5).map((item) => ({
      stock: item.stock_name,
      symbol: item.stock_symbol,
      sharePercent: totals.currentValue ? Number(((item.currentValue / totals.currentValue) * 100).toFixed(2)) : 0,
      value: item.currentValue
    }));

    return res.json({
      summary: {
        holdingsCount: portfolio.length,
        profitableCount,
        losingCount,
        winRate: Number(winRate.toFixed(2)),
        averageReturnPercent: Number((portfolio.reduce((acc, item) => acc + item.profitLossPercent, 0) / portfolio.length).toFixed(2)),
        totalInvestment: Number(totals.totalInvestment.toFixed(2)),
        currentValue: Number(totals.currentValue.toFixed(2)),
        totalProfitLoss: Number(totals.totalProfitLoss.toFixed(2))
      },
      topPerformer: {
        stock: topPerformer.stock_name,
        symbol: topPerformer.stock_symbol,
        returnPercent: Number(topPerformer.profitLossPercent.toFixed(2)),
        profitLoss: Number(topPerformer.profitLoss.toFixed(2))
      },
      weakestPerformer: {
        stock: weakestPerformer.stock_name,
        symbol: weakestPerformer.stock_symbol,
        returnPercent: Number(weakestPerformer.profitLossPercent.toFixed(2)),
        profitLoss: Number(weakestPerformer.profitLoss.toFixed(2))
      },
      largestAllocation: {
        stock: largestAllocation.stock_name,
        symbol: largestAllocation.stock_symbol,
        sharePercent: totals.currentValue ? Number(((largestAllocation.currentValue / totals.currentValue) * 100).toFixed(2)) : 0,
        value: Number(largestAllocation.currentValue.toFixed(2))
      },
      allocation
    });
  } catch (error) {
    return respondServerError(res, error, 'Unable to load portfolio analytics.');
  }
});

app.post('/api/portfolio', requireAuth, async (req, res) => {
  const { stockName, stockSymbol, quantity, buyPrice, currentPrice } = req.body;
  if (!stockName || !quantity || !buyPrice || !currentPrice) {
    return res.status(400).json({ error: 'Stock name, quantity, buy price, and current price are required.' });
  }

  const userId = ensureSessionUserId(req, res);
  if (!userId) return;

  try {
    const parsedQuantity = parsePositiveInt(quantity);
    const parsedBuyPrice = parsePositiveFloat(buyPrice);
    const parsedCurrentPrice = parsePositiveFloat(currentPrice);
    if (!parsedQuantity || !parsedBuyPrice || !parsedCurrentPrice) {
      return res.status(400).json({ error: 'Quantity and prices must be positive numbers.' });
    }

    const matchedStock = findStockByQuery(stockName, stockSymbol);
    if (!matchedStock) {
      return res.status(400).json({ error: 'Please select a valid stock from the suggestion list.' });
    }

    const portfolioItem = {
      user_id: userId,
      stock_symbol: matchedStock.symbol,
      stock_name: matchedStock.name,
      quantity: parsedQuantity,
      buy_price: parsedBuyPrice,
      current_price: parsedCurrentPrice,
      created_at: new Date().toISOString()
    };

    await portfolioCollection.insertOne(portfolioItem);
    await transactionsCollection.insertOne({
      user_id: userId,
      stock_symbol: matchedStock.symbol,
      stock_name: matchedStock.name,
      type: 'BUY',
      quantity: parsedQuantity,
      price: parsedBuyPrice,
      date: new Date().toISOString()
    });

    return res.json({ success: true });
  } catch (error) {
    return respondServerError(res, error, 'Failed to add stock.');
  }
});

app.put('/api/portfolio/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { quantity, buyPrice, currentPrice } = req.body;
  if (!quantity || !buyPrice || !currentPrice) {
    return res.status(400).json({ error: 'Quantity, buy price, and current price are required.' });
  }

  const userId = parseSessionUserId(req);
  const portfolioId = parseUserId(id);
  if (!userId || !portfolioId) {
    return res.status(400).json({ error: 'Invalid portfolio item.' });
  }

  try {
    const parsedQuantity = parsePositiveInt(quantity);
    const parsedBuyPrice = parsePositiveFloat(buyPrice);
    const parsedCurrentPrice = parsePositiveFloat(currentPrice);
    if (!parsedQuantity || !parsedBuyPrice || !parsedCurrentPrice) {
      return res.status(400).json({ error: 'Quantity and prices must be positive numbers.' });
    }

    const result = await portfolioCollection.updateOne(
      { _id: portfolioId, user_id: userId },
      {
        $set: {
          quantity: parsedQuantity,
          buy_price: parsedBuyPrice,
          current_price: parsedCurrentPrice
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Stock not found.' });
    }

    return res.json({ success: true });
  } catch (error) {
    return respondServerError(res, error, 'Failed to update stock.');
  }
});

app.delete('/api/portfolio/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = parseSessionUserId(req);
  const portfolioId = parseUserId(id);

  if (!userId || !portfolioId) {
    return res.status(400).json({ error: 'Invalid portfolio item.' });
  }

  try {
    const row = await portfolioCollection.findOne({ _id: portfolioId, user_id: userId });
    if (!row) {
      return res.status(404).json({ error: 'Stock not found.' });
    }

    await portfolioCollection.deleteOne({ _id: portfolioId, user_id: userId });
    await transactionsCollection.insertOne({
      user_id: userId,
      stock_symbol: row.stock_symbol || '',
      stock_name: row.stock_name,
      type: 'SELL',
      quantity: row.quantity,
      price: row.buy_price,
      date: new Date().toISOString()
    });

    return res.json({ success: true });
  } catch (error) {
    return respondServerError(res, error, 'Delete failed.');
  }
});

app.get('/api/transactions', requireAuth, async (req, res) => {
  const limit = parseBoundedPositiveInt(req.query.limit, 50, 200);
  const userId = ensureSessionUserId(req, res);
  if (!limit) {
    return res.status(400).json({ error: 'Limit must be a positive integer.' });
  }
  if (!userId) return;

  try {
    const rows = await transactionsCollection.find({ user_id: userId }).sort({ date: -1 }).limit(limit).toArray();
    return res.json({ transactions: rows.map(mapTransaction) });
  } catch (error) {
    return respondServerError(res, error, 'Unable to load transaction history.');
  }
});

app.get('/api/status', (req, res) => {
  res.json({ authenticated: Boolean(req.session.userId) });
});

app.get('/api/health', (req, res) => {
  const smtpConfigured = Boolean(mailTransport);
  const dbReady = Boolean(usersCollection && portfolioCollection && transactionsCollection);
  res.json({
    status: dbReady ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbReady ? 'connected' : 'disconnected',
      email: smtpConfigured ? 'configured' : allowDevOtpFallback ? 'dev-fallback' : 'not-configured'
    }
  });
});

app.get('/api/stocks', requireAuth, (req, res) => {
  const query = String(req.query.query || '').trim().toLowerCase();
  if (!query) {
    return res.json({ stocks: stockCatalog.slice(0, 3) });
  }

  const stocks = stockCatalog
    .filter((stock) => {
      const symbol = stock.symbol.toLowerCase();
      const name = stock.name.toLowerCase();
      return symbol.includes(query) || name.includes(query);
    })
    .sort((a, b) => {
      const aSymbol = a.symbol.toLowerCase();
      const aName = a.name.toLowerCase();
      const bSymbol = b.symbol.toLowerCase();
      const bName = b.name.toLowerCase();

      const aStartsWith = aSymbol.startsWith(query) || aName.startsWith(query);
      const bStartsWith = bSymbol.startsWith(query) || bName.startsWith(query);

      if (aStartsWith !== bStartsWith) {
        return aStartsWith ? -1 : 1;
      }

      const aSymbolIndex = aSymbol.indexOf(query);
      const bSymbolIndex = bSymbol.indexOf(query);
      if (aSymbolIndex !== bSymbolIndex) {
        return aSymbolIndex - bSymbolIndex;
      }

      const aNameIndex = aName.indexOf(query);
      const bNameIndex = bName.indexOf(query);
      if (aNameIndex !== bNameIndex) {
        return aNameIndex - bNameIndex;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, 3);

  return res.json({ stocks });
});

app.get('/api/stocks/:symbol', requireAuth, (req, res) => {
  const symbol = String(req.params.symbol || '').trim().toUpperCase();
  const stock = stockCatalog.find((item) => item.symbol === symbol);

  if (!stock) {
    return res.status(404).json({ error: 'Stock not found.' });
  }

  return res.json({ stock });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();

    const db = client.db(dbName);
    usersCollection = db.collection('users');
    portfolioCollection = db.collection('portfolio');
    transactionsCollection = db.collection('transactions');

    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex(
      { social_provider: 1, social_provider_id: 1 },
      { unique: true, sparse: true }
    );
    await portfolioCollection.createIndex({ user_id: 1, stock_name: 1 });
    await portfolioCollection.createIndex({ user_id: 1, created_at: -1 });
    await transactionsCollection.createIndex({ user_id: 1, date: -1 });
    await transactionsCollection.createIndex({ user_id: 1, stock_symbol: 1, date: -1 });

    sessionMiddleware = session({
      store: MongoStore.create({
        mongoUrl: mongoUri,
        dbName,
        collectionName: 'sessions'
      }),
      secret: process.env.SESSION_SECRET || 'stock_portfolio_secret',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        httpOnly: true,
        secure: isProduction
      }
    });

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      console.log(`MongoDB connected at ${mongoUri}`);
      if (mailTransport) {
        console.log('SMTP email service is configured.');
      } else if (allowDevOtpFallback) {
        console.warn('SMTP is not configured. DEV_OTP_FALLBACK is enabled, so OTPs will be printed in the server console.');
      } else {
        console.warn('SMTP is not configured. Password reset emails will fail until .env contains valid SMTP settings.');
      }
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

startServer();
