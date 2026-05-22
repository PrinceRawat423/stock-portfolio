# Stock Portfolio Management System

A full-stack web app for managing stock portfolios, including user authentication, profile management, portfolio CRUD, transaction history, search, and profit/loss tracking.

## Features
- User signup, login, logout
- Edit profile and change password
- Add, update, delete stock positions
- Record buy/sell transactions with date history
- Portfolio dashboard with investment summary and individual performance
- Search and filter stocks by name and profit/loss

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
   - For real OTP emails, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`.
   - For local testing without email, set `DEV_OTP_FALLBACK=true`. The OTP will be printed in the server console.
   - For Gmail, use an App Password instead of your normal Gmail password.
4. Start the server:
   ```bash
   npm start
   ```
5. Open a browser and go to `http://localhost:3000`

## Project Structure
- `server.js` - Express backend, auth/session APIs, portfolio APIs, and MongoDB integration
- `public/` - frontend pages and client app logic
- `data/stocks.json` - local stock catalog used for suggestion and symbol validation

## Notes
- The app uses MongoDB for users, sessions, portfolio, and transactions.
- Use `GET /api/health` to quickly verify backend status (database/email service state).
- Current prices are entered manually, but the UI and backend can be extended for live price API integration.
- Password reset OTP email requires valid SMTP credentials unless `DEV_OTP_FALLBACK=true`.
