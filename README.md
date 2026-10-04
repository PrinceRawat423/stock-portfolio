# Stock Portfolio Management System

A full-stack portfolio tracker that helps users securely manage holdings, record buy/sell activity, and understand portfolio performance through actionable analytics.

Built as a placement-ready project with a clean client experience, session-based authentication, documented APIs, automated tests, and CI.

**Quick links:** [Features](#features) · [Tech stack](#tech-stack) · [Screenshots](#screenshots) · [Live demo](#live-demo) · [Setup](#setup)

## Problem

Individual investors often manage holdings, transactions, and performance figures across spreadsheets and disconnected tools. This project brings those essentials into one secure workspace, making it easier to record positions and understand portfolio health at a glance.

## Features

- Secure account workflow: registration, login/logout, profile updates, password changes, and OTP-based password reset.
- Complete portfolio lifecycle: create, edit, and remove holdings while preserving buy/sell transaction history.
- Decision-oriented analytics: allocation, sector allocation, daily P/L, diversification score, and best/worst performers.
- Live-quote integration with Alpha Vantage, server-side caching, clear fallbacks, and rate-limit-aware error handling.
- Production-minded foundation: Helmet, rate limiting, HTTP-only session cookies, Mongo-backed sessions, OpenAPI docs, Jest, and GitHub Actions.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express |
| Data | MongoDB, MongoDB session store |
| Authentication | express-session, bcrypt, OAuth provider hooks |
| Email | Nodemailer for OTP delivery |
| Market data | Alpha Vantage (server-side, cached) |
| API documentation | OpenAPI 3, Swagger UI |
| Testing | Jest, Supertest |
| CI | GitHub Actions |

## Screenshots

> Add two locally captured, redacted product screenshots before a placement submission. Use real portfolio data only if it is safe to share; never capture API keys, email addresses, session cookies, or private holdings.

| Screen | What to capture |
| --- | --- |
| Dashboard | Portfolio summary, allocation, and performance cards after signing in. |
| Portfolio | Holdings table, search/filter controls, and the add/edit position flow. |

Save images under `docs/images/` and embed them here:

```md
![Dashboard](docs/images/dashboard.png)
![Portfolio management](docs/images/portfolio.png)
```

## Live demo

There is no public deployment URL configured yet. Run the project locally using the setup steps below, or add your Render/Railway deployment URL here before sharing it with recruiters.

## Architecture

```text
Browser (HTML/CSS/JavaScript)
          |
          v
Express application ----> Swagger UI / OpenAPI contract
    |       |       \
    |       |        +----> Alpha Vantage (cached quotes)
    |       +------------> SMTP provider (password-reset OTP)
    v
MongoDB (users, portfolios, transactions, sessions)
```

The application keeps browser concerns in `public/`, exposes grouped HTTP endpoints through Express, and persists users, holdings, transactions, and sessions in MongoDB. Market-data and email providers are configured only through environment variables.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/register` | Create an account |
| `POST` | `/api/login` | Start an authenticated session |
| `POST` | `/api/logout` | End the current session |
| `GET`, `PUT` | `/api/profile` | Read or update the signed-in profile |
| `GET`, `POST` | `/api/portfolio` | List or add portfolio holdings |
| `PUT`, `DELETE` | `/api/portfolio/:id` | Update or remove a holding |
| `GET` | `/api/transactions` | Retrieve transaction history |
| `GET` | `/api/stocks` | Search the local stock catalog |
| `GET` | `/api/market/quote/:symbol` | Get a cached live quote when configured |
| `GET` | `/api/health` | Check database and email-service status |

Explore the complete request/response contract in the [OpenAPI specification](docs/openapi.yaml), or start the app and open [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

## Setup

### Prerequisites

- Node.js 18 or later
- MongoDB running locally or a MongoDB connection string

### Installation

1. Clone the repository and enter the project directory.

   ```bash
   git clone https://github.com/PrinceRawat423/stock-portfolio.git
   cd stock-portfolio
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. Create a local environment file.

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux, use `cp .env.example .env`.

4. Update `.env` with your local MongoDB connection and a strong, unique `SESSION_SECRET`.

   - Set SMTP values to send real password-reset emails.
   - For local OTP testing only, set `DEV_OTP_FALLBACK=true`; the OTP is written to the server console.
   - Add `ALPHA_VANTAGE_API_KEY` to enable market quotes.

5. Start the application.

   ```bash
   npm start
   ```

6. Visit [http://localhost:3000](http://localhost:3000).

## Demo access

No shared credentials are committed to this repository. Create a local account through the registration page, or provision a separate throwaway demo account in your deployed environment. This prevents exposing personal data and makes the project safe to fork.

## Testing and quality

Run the automated suite with:

```bash
npm test
```

The test suite covers portfolio-analytics calculations. GitHub Actions installs dependencies and runs tests for pushes and pull requests to `main`.

## Security and configuration

- `.env` and `.env.live-prices` are ignored by Git; `.env.example` contains placeholders only.
- Do not commit API keys, OAuth client secrets, SMTP passwords, MongoDB credentials, or demo-user credentials.
- Configure secrets in the deployment platform's encrypted environment-variable settings.
- Use a strong `SESSION_SECRET` in every non-local environment. Session cookies are HTTP-only and become secure when `NODE_ENV=production`.
- Alpha Vantage free-tier quotes may be delayed or end-of-day data and are cached for five minutes; they are not guaranteed real-time prices.

## Project structure

```text
public/                    Frontend pages, styles, and browser logic
server/app.js              Express app, middleware, routes, provider integrations
server/controllers/        Request handlers and analytics responsibilities
server/routes/             Grouped API route definitions
server/services/           Reusable business logic
data/stocks.json           Local stock catalog for suggestions and validation
docs/openapi.yaml           OpenAPI 3 contract
tests/                     Jest unit and API tests
.github/workflows/ci.yml   Continuous-integration workflow
```

## Deployment

Deploy to Render, Railway, or another Node.js host using `npm start`. Set `NODE_ENV=production` and configure `MONGO_URI`, `MONGO_DB_NAME`, `SESSION_SECRET`, SMTP values, OAuth credentials (if used), and `ALPHA_VANTAGE_API_KEY` in the host's secret manager. Do not add `.env` files or credentials to the repository.
