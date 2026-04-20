# Deployment Guide

## 1. Termux (Local POS Server)
- Install Node.js: `pkg install nodejs-lts`
- Install Postgres: `pkg install postgresql`
- Run DB: `pg_ctl -D $PREFIX/var/lib/postgresql start`
- Setup Project:
  ```bash
  cd backend && npm install
  npx prisma migrate dev --name init
  npm start
  ```

## 2. VPS (Production)
- Use Docker for the database.
- Use Nginx to serve the frontend build (`npm run build`).
- Set up a reverse proxy for the `/api` route.

## 3. Render / Heroku
- Connect your GitHub repo.
- Set environment variables in the dashboard.
- Provision a Managed PostgreSQL instance.
