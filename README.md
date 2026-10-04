# Stock Portfolio Management System

A full-stack application for tracking investments, recording transactions, and understanding portfolio performance from one secure dashboard.

[Live Demo](#live-demo) · [GitHub Repository](https://github.com/PrinceRawat423/stock-portfolio) · [API Documentation](docs/openapi.yaml)

## Live Demo

No public deployment URL is configured yet. Run the application locally with the [installation steps](#installation), then replace this section with your Render or Railway URL before sharing the project with recruiters.

## GitHub Repository

Repository: [PrinceRawat423/stock-portfolio](https://github.com/PrinceRawat423/stock-portfolio)

## Screenshots

Add redacted screenshots here before submission. Use a throwaway account and sample holdings only; do not expose email addresses, API keys, sessions, or personal financial data.

| Screen | Recommended file | What it should show |
| --- | --- | --- |
| Dashboard | `docs/images/dashboard.png` | Portfolio summary, allocation, and insight cards |
| Portfolio | `docs/images/portfolio.png` | Holdings table, search/filter, and actions |
| Transactions | `docs/images/transactions.png` | Buy/sell history and date records |
| Analytics | `docs/images/analytics.png` | Allocation, diversification, and performer insights |

```md
![Dashboard](docs/images/dashboard.png)
![Portfolio](docs/images/portfolio.png)
![Transactions](docs/images/transactions.png)
![Analytics](docs/images/analytics.png)
```

## About the Project

Individual investors often manage holdings and transaction records across spreadsheets or multiple tools. Stock Portfolio Management System consolidates those workflows into a focused workspace: users can maintain stock positions, see current values and profit/loss, review trade history, and use analytics to understand concentration and performance.

## Key Features

- Secure registration, login/logout, profile update, password change, and OTP-based password reset.
- Portfolio CRUD: add, edit, and delete validated stock positions.
- Automatic BUY/SELL transaction records when positions are added or removed.
- Portfolio search and profit/loss filtering.
- Portfolio intelligence: allocation, sector allocation, daily P/L, diversification score, and top/weakest performer insights.
- Alpha Vantage market quotes with server-side caching and rate-limit-aware fallbacks.
- Interactive API documentation at `/api/docs`.
- Light/dark theme, responsive layout, keyboard focus states, and reduced-motion support.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB |
| Authentication | express-session, bcrypt, MongoDB session store |
| Email | Nodemailer |
| Market data | Alpha Vantage |
| API documentation | OpenAPI 3 and Swagger UI |
| Testing | Jest and Supertest |
| CI | GitHub Actions |

## System Architecture

```text
Browser
   ↓
Express routes
   ↓
Controllers
   ↓
Services
   ↓
MongoDB

        ↘ Alpha Vantage API (cached market quotes)
        ↘ SMTP provider (password-reset OTP)
```

The browser communicates with a session-authenticated Express API. Controllers coordinate application work, reusable services calculate portfolio analytics, and MongoDB persists users, holdings, transactions, and sessions. Third-party integrations stay on the server and are configured through environment variables.

## Database Design

| Collection | Purpose | Key fields |
| --- | --- | --- |
| `users` | Account and authentication data | `name`, `email`, `password_hash`, `created_at` |
| `portfolio` | Current user holdings | `user_id`, `stock_symbol`, `stock_name`, `quantity`, `buy_price`, `current_price` |
| `transactions` | Immutable buy/sell history | `user_id`, `stock_symbol`, `type`, `quantity`, `price`, `date` |
| `sessions` | Server-side session data | Managed by `connect-mongo` |

Indexes support unique user emails, user-scoped holdings, and date-ordered transaction history.

## API Documentation

Interactive Swagger documentation is available at `/api/docs` when the application is running locally. Recruiters can review the portable API contract directly in [docs/openapi.yaml](docs/openapi.yaml).

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/register` | Create an account and start a session |
| `POST` | `/api/login` | Authenticate a user |
| `POST` | `/api/logout` | End the active session |
| `GET`, `PUT` | `/api/profile` | View or update profile information |
| `GET`, `POST` | `/api/portfolio` | List or add holdings |
| `PUT`, `DELETE` | `/api/portfolio/:id` | Update or remove a holding |
| `GET` | `/api/portfolio/analytics` | Return allocation and performance analytics |
| `GET` | `/api/transactions` | Return transaction history |
| `GET` | `/api/health` | Check database and email-service status |

## Authentication

Passwords are hashed with bcrypt. Express sessions are stored in MongoDB and use HTTP-only cookies; cookies are marked secure when `NODE_ENV=production`. OAuth entry points for Google, Facebook, and Apple are available when their environment variables are configured.

## Testing

Run the automated suite:

```bash
npm test
```

Current Jest/Supertest coverage verifies portfolio analytics, health behavior, and unauthorized access to protected stock endpoints. GitHub Actions runs the suite for pushes and pull requests to `main`.

## Installation

### Prerequisites

- Node.js 18 or later
- MongoDB running locally or a MongoDB connection string

1. Clone the repository.

   ```bash
   git clone https://github.com/PrinceRawat423/stock-portfolio.git
   cd stock-portfolio
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. Create your local environment file.

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux, use `cp .env.example .env`.

4. Start the application.

   ```bash
   npm start
   ```

5. Visit [http://localhost:3000](http://localhost:3000).

## Environment Variables

Use `.env.example` as the template. Never commit `.env` or provider credentials.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB_NAME` | Yes | Database name |
| `SESSION_SECRET` | Yes | Long, unique session-signing secret |
| `PORT` | No | HTTP port; defaults to `3000` |
| `SMTP_*`, `MAIL_FROM` | For email OTP | SMTP configuration |
| `DEV_OTP_FALLBACK` | Local only | Writes reset OTPs to the server console |
| `ALPHA_VANTAGE_API_KEY` | For live quotes | Market-data provider key |
| `GOOGLE_*`, `FACEBOOK_*`, `APPLE_*` | For OAuth | Social sign-in credentials |

Alpha Vantage free-tier quotes can be delayed or end-of-day data and are cached for five minutes; do not present them as guaranteed real-time prices.

## Future Improvements

- Add isolated MongoDB integration tests for registration, login/logout, and portfolio CRUD flows.
- Add a deployed demo environment with a non-sensitive demo account.
- Add CSV import/export for portfolio data.
- Add richer historical price charts and alerting.
- Add role-based administration and account audit events.

## Project Structure

- `public/` — frontend pages, styles, and browser logic
- `server/app.js` — Express bootstrap and API composition
- `server/controllers/` — request handlers and analytics responsibilities
- `server/routes/` — grouped API route definitions
- `server/services/` — reusable business logic
- `data/stocks.json` — local stock catalog for validation
- `docs/openapi.yaml` — OpenAPI 3 contract
- `tests/` — Jest and Supertest suite
- `.github/workflows/ci.yml` — continuous-integration workflow
