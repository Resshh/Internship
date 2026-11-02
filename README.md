# Notification Engine — FSD-B06-T01

Batch 1 of the ICTAK Notifications Project. Reads business data, checks a rule, and emails the right
people on a schedule — without duplicates — and logs every run.

```
client/        React (Vite) app: all screens, side menu
server/
  index.js     API entry point
  models/      All MongoDB collections (the shared database contract)
  routes/      One file per API resource
  middleware/  requireAuth / requireAdmin
  engine/      Scheduler, rules, templates, mailer, job runner, fakeConnector
  test/        Unit tests (node --test)
mock-data/     Fake data in the common format, one file per saved query
docs/          Team plan and wireframes
```

## Setup (first time)

Needs Node 20+ and MongoDB (local install, Docker, or a free MongoDB Atlas cluster).

```bash
# MongoDB via Docker, if you don't have it installed:
docker run -d --name mongo -p 27017:27017 mongo:7

cd server
cp .env.example .env      # then fill in SMTP_USER / SMTP_PASS from https://ethereal.email
npm install
npm run seed              # creates admin@test.com and user@test.com (password Test@123) + 5 queries
npm run dev               # API on http://localhost:5000

cd ../client
npm install
npm run dev               # app on http://localhost:5173
```

Run tests: `cd server && npm test`

## Team rules

- One branch per JIRA story: `FSD-12-login-screen`. Never commit straight to `main`.
- Every commit starts with the JIRA key: `FSD-12 Add login form validation`.
- Open a pull request; one teammate reviews before merge.
- `.env` is never committed. Only mock data and `@test.com` addresses. `TEST_MODE=true` always.
- The engine gets data **only** through `runQuery(queryId, params)`. Don't change the data format
  without telling Batch 2.

See [docs/PLAN.md](docs/PLAN.md) for the task plan.
