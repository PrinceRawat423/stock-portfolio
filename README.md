# Stock Portfolio Management System

[Live Demo](#deployment) · [API Documentation](http://localhost:3000/api/docs) · [OpenAPI specification](docs/openapi.yaml)

A full-stack web app for managing stock portfolios, including user authentication, profile management, portfolio CRUD, transaction history, search, and profit/loss tracking.

## Features
- User signup, login, logout
- Edit profile and change password
- Add, update, delete stock positions
- Record buy/sell transactions with date history
- Portfolio dashboard with investment summary and individual performance
- Search and filter stocks by name and profit/loss
- Allocation, sector allocation, daily P/L, diversification score, and top/weakest performers
- Interactive API documentation at `/api/docs`

## Tech Stack

Node.js, Express, MongoDB, Express Session, bcrypt, Nodemailer, Alpha Vantage, Jest, and GitHub Actions.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local env file:
   ```bash
   copy .env.example .env
   ```
3. Update `.env`:
   - For real OTP emails, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` (for example, `Stock Portfolio <your_email@gmail.com>`).
   - For local testing without email, set `DEV_OTP_FALLBACK=true`. The OTP will be printed in the server console.
   - For Gmail, use an App Password instead of your normal Gmail password.
4. Start the server:
   ```bash
   npm start
   ```
5. Open a browser and go to `http://localhost:3000`

## Project Structure
- `server.js` - application bootstrap and Express wiring; route migration is intentionally incremental to preserve the session/OAuth contract
- `server/controllers/` - request handlers, including analytics and system/market endpoints
- `server/routes/` - grouped API route definitions
- `server/middleware/` - reusable authentication middleware
- `server/config/` - deployment configuration guidance
- `server/services/portfolio-analytics.js` - reusable, tested portfolio analytics service
- `docs/openapi.yaml` - OpenAPI 3 contract, rendered at `/api/docs`
- `tests/` - Jest unit/API test suite
- `.github/workflows/ci.yml` - install and test checks on pushes and pull requests
- `public/` - frontend pages and client app logic
- `data/stocks.json` - local stock catalog used for suggestion and symbol validation

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/register`, `/api/login`, `/api/logout` | Session authentication |
| GET/POST | `/api/portfolio` | List or add holdings |
| PUT/DELETE | `/api/portfolio/:id` | Update or remove a holding |
| GET | `/api/portfolio/analytics` | Allocation and performance analytics |
| GET | `/api/transactions` | Transaction history |
| GET | `/api/health` | Database/email service status |

See the [OpenAPI specification](docs/openapi.yaml) or run the app and open `/api/docs` for request details.

## Architecture

```text
Browser → Express routes → services/controllers → MongoDB
                         ↘ Alpha Vantage (cached market quotes)
```

The next migration step is to move the remaining route handlers from `server.js` into `server/routes` and `server/controllers`; the analytics service already follows this boundary. This staged approach avoids breaking session-based client APIs.

## Testing and CI

```bash
npm test
```

Tests cover analytics calculations and are run automatically by GitHub Actions for pushes and pull requests to `main`. The next test expansion is Supertest coverage for authentication and CRUD using an isolated MongoDB database.

## Deployment

Deploy to Render, Railway, or a similar Node.js host with `npm start`. Set `NODE_ENV=production`, `MONGO_URI`, `SESSION_SECRET`, SMTP credentials, and any OAuth/Alpha Vantage credentials in the host's encrypted environment settings. Replace the Live Demo placeholder at the top with the deployed URL—do not commit demo credentials or `.env` files.

## Notes
- The app uses MongoDB for users, sessions, portfolio, and transactions.
- Use `GET /api/health` to quickly verify backend status (database/email service state).
- Current prices are fetched server-side from Alpha Vantage when a stock is selected. The catalog price is used only as a fallback if the provider is unavailable or rate-limited.
- Add `ALPHA_VANTAGE_API_KEY` to `.env` (or the locally ignored `.env.live-prices`) to enable market quotes. Indian catalog symbols use Alpha Vantage's BSE symbol convention (for example, `RELIANCE.BSE`). Free Alpha Vantage quotes may be end-of-day or delayed; do not present them as guaranteed real-time data.
- Password reset OTP email requires valid SMTP credentials unless `DEV_OTP_FALLBACK=true`.
- Alpha Vantage free-tier quotes may be delayed/end-of-day and are cached for five minutes. They are not guaranteed real-time market data.
