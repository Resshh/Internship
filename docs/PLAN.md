# Team Plan — Notification Engine (FSD-B06-T01)

Owner: Reshma Ann Thomas (Team Lead). Update this file when plans change.

## 1. The whole system in one picture

An admin sets up a **job** once. After that the server does this by itself, every time the job's
schedule fires (or when someone clicks **Run now**):

```
scheduler fires ─► runQuery(queryId) ─► rule filter ─► for each matching row:
 (node-cron)       (fakeConnector now,   (DaysOverdue      find recipient ─► fill template ─►
                    Batch 2 later)        > 7)              dedupe check ─► send (retry ×3) ─► log
```

| Step | What happens | Our file | SRS |
|---|---|---|---|
| 1 | Scheduler starts enabled jobs at their time | `engine/scheduler.js` | FR-07, FR-08 |
| 2 | Get data: `runQuery(queryId, params)` | `engine/fakeConnector.js` (done) | BR-12 |
| 3 | Keep only rows that match the rule | `engine/rules.js` | FR-06 |
| 4 | Find the recipient: an email column, or a named list + CC/BCC | `engine/runner.js` | FR-09 |
| 5 | Fill `{{placeholders}}` in the subject and body | `engine/template.js` | FR-11, FR-12 |
| 6 | Skip it if this reminder was already sent | `engine/runner.js` + `sent_history` | FR-15 |
| 7 | Send it; on failure retry up to 3 times. Test mode sends everything to TEST_EMAIL | `engine/mailer.js` | FR-14, FR-16 |
| 8 | Save one `job_runs` record per run and one `delivery_logs` record per email | `engine/runner.js` | FR-17 |

**Two kinds of job** (`mode` on the job):
- **message**: one email per matching row (payment reminder, PO follow-up, low stock).
- **report**: one email to a named list, with a CSV/Excel file attached (daily sales, weekly receivables).

## 2. Concepts you must be able to explain

- **Common data format**: every data source returns `{ columns: [...], rows: [[...]], meta }`.
  We never care whether the data came from SQL Server, HANA or SAP. Example: `mock-data/overdue-invoices.json`.
- **runQuery / fakeConnector**: the *only* way the engine gets data. Today it reads our mock JSON.
  At integration we change one `require` line to Batch 2's connector (NFR-07).
  A job stores only `queryId`, never SQL or passwords.
- **Row object**: inside the engine we turn each row array into an object
  `{ InvoiceNo: 'INV-101', CustomerName: 'ABC Traders', ... }`. Rules and templates both work on this object.
- **JWT login**: the login API checks the password against the stored bcrypt hash. It then returns a signed token
  holding `{ id, name, role }`. The browser sends the token on every request, and `requireAdmin` reads the role
  from it. The server enforces roles; hiding a button in React is not security (FR-02).
- **Cron**: the 5-field schedule format `min hour day-of-month month day-of-week`.
  `0 19 * * *` = every day 7 PM. `0 9 * * 1` = Mondays 9 AM. `*/15 * * * *` = every 15 min.
  The job form stores friendly fields (frequency, time, days), and `toCron()` converts them.
  node-cron takes a `timezone` option (we default to Asia/Kolkata, NFR-10).
- **Dedupe key**: `jobName:recordId:date`, e.g. `payment-reminder:INV-101:2026-11-02`.
  `sent_history.dedupeKey` has a **unique index**, so the *database* refuses a second insert.
  This holds even if two runs overlap. Run the job twice on one day: the second run sends 0 and counts skipped duplicates.
- **Test mode**: `TEST_MODE=true` in `.env`. The mailer replaces every To/CC/BCC with `TEST_EMAIL`.
  This happens in one place (the mailer), so no screen or job can bypass it (BR-07).
- **Ethereal**: a fake SMTP inbox. Emails "send" for real but land in a web inbox, not with real people.
- **Retry**: a failed send is tried again, up to 3 retries. Each failure is logged, and one bad email never stops the rest of the run (BR-09).

## 3. Engine contracts (agree these so people can work in parallel)

Nobody waits on anybody else if everyone codes to these signatures:

```js
// engine/rules.js            (Pavin)
toObjects({ columns, rows })        // -> [{ InvoiceNo: 'INV-101', ... }, ...]
matches(row, conditions)            // -> true/false; conditions = job.rule; [] matches everything
// engine/template.js         (Pranav)
render(text, row)                   // -> { text, missing: ['Amount'] }  never throws (FR-12)
// engine/mailer.js           (Pavin)
sendMail({ to, cc, bcc, subject, html, attachments })  // applies TEST_MODE; throws on SMTP error
// engine/scheduler.js        (Reshma)
toCron(schedule)                    // -> '0 19 * * *'
startScheduler(); reloadJob(job)    // start all enabled jobs; re-register one after edit/enable/disable
// engine/runner.js           (Pavin + Reshma)
runJob(jobId, { manual, testRun })  // -> the saved JobRun; testRun = limit rows, send nothing (FR-13)
```

## 4. TODAY — Mon 2 Nov (Sprint 1, Day 1) — 4 people

Everyone first: pull `main`, follow the README setup, log in via Postman as `admin@test.com / Test@123`.
**Done today = branch pushed + PR opened + JIRA card in *In Review*.**

### T1 · Reshma — Jobs API (FR-03, FR-04, FR-05, BR-03)
- Merge the foundation PR, set up Sprint 1 in JIRA, and create these cards.
- `server/routes/jobs.js`:
  - `GET /api/jobs` (any logged-in user): list jobs with the query name (`populate('queryId')`).
  - `GET /api/jobs/:id`, `POST /api/jobs`, `PUT /api/jobs/:id` (**admin**).
  - `PATCH /api/jobs/:id/enabled` `{ enabled }` (**admin**). Refuse to enable a job that is missing a query, schedule, recipients or template (BR-03); return 400 with a clear message.
- `GET /api/queries` (any logged-in user) for the job form dropdown. It reads our DB only and never calls a source.
- Mount it in `index.js`.
- **Done when**: in Postman, an admin creates a job and sees it in the list, and `user@test.com` gets 403 on POST.

### T2 · Pavin — Mailer + test mode (FR-14), then rules (FR-06)
- Create an Ethereal account and put its SMTP details in your `.env`.
- `server/engine/mailer.js`: one nodemailer transport from `.env`, plus `sendMail()` as in section 3.
  If `TEST_MODE=true`, set `to = TEST_EMAIL` and drop `cc`/`bcc`.
- Prove it: `node -e "require('dotenv').config(); require('./engine/mailer').sendMail({to:'abc@test.com',subject:'Hi',html:'Test'}).then(console.log)"`. The mail shows up in the Ethereal inbox addressed to TEST_EMAIL.
- Then `server/engine/rules.js`: `toObjects()` and `matches()` with operators `> >= < <= = !=`.
- `server/test/rules.test.js`: against `overdue-invoices.json` with `DaysOverdue > 7`, expect INV-101, INV-103 and INV-105 (not INV-104, because exactly 7 is not more than 7).
- **Done when**: you show the Ethereal screenshot and `npm test` passes.

### T3 · Pranav — Templates (FR-11, FR-12) + confirm data questions
- `server/engine/template.js`: `render(text, row)` using Handlebars.
  Collect placeholders that have no value into `missing` and leave them empty. Never crash.
- `server/test/template.test.js`: a normal fill; a missing `{{Foo}}` lands in `missing`; an empty template.
- `server/routes/templates.js`: list/get for any logged-in user; create/update/delete for **admin**;
  `POST /api/templates/preview { subject, body, row }` returns the rendered subject and body plus `missing`.
- Confirm with the mentor / Batch 2 (see section 8) and update the SRS.
- **Done when**: `npm test` passes and a Postman preview of the payment reminder template shows real values.

### T4 · Abhin — Login screen + app header (FR-01, FR-02, FR-14 badge)
- `client/src/pages/Login.jsx`: email and password fields, call `api('/auth/login', {method:'POST', body})`,
  save `token` and `user` in localStorage, then go to `/`. On failure show the server's error ("Invalid email or password").
- `client/src/App.jsx`: no token → redirect to `/login` and don't show the side menu on the login page.
  The header shows the user's name and role, a **Log out** button (clears localStorage), and a **TEST MODE: ON** badge
  read from `GET /api/health`.
- **Done when**: admin and user can both log in and out, and a wrong password shows the error.

**If Sivanandhini is in today**: write the Test Plan (D04) test cases straight from SRS section 10's table, plus
`routes/recipientLists.js` (CRUD; admin-only writes; reject invalid emails, FR-10).

## 5. Sprint plan

Dates assume Week 1 = 26–30 Oct. Adjust if the mentor's calendar differs.

### Sprint 1 · 2–6 Nov · Goal: "Run now" sends a payment reminder end to end and it's logged
| Day | Reshma | Pavin | Pranav | Abhin | Sivanandhini |
|---|---|---|---|---|---|
| Mon | Jobs API | Mailer + rules | Template engine + API | Login + header | Test Plan, recipient lists API |
| Tue | `toCron()` + tests | `runner.js` v1: fetch → rule → render → send → log | Templates screen + preview | Job dashboard screen | Recipient lists screen |
| Wed | Scheduler: start/reload, skip disabled | Dedupe via `sent_history` | Seed: 5 templates + 4 lists | Job setup screen (basics, rule) | Run history API (list + details) |
| Thu | `POST /jobs/:id/run` (Run now) + Test run | Retry ×3 + failure logging | Job setup: template section + Preview | Job setup: schedule + recipients | Run history screen |
| Fri | Review 2 demo, sprint notes (D06) | Fix bugs from demo | Fix bugs | Fix bugs | Test cases for Sprint 1 |

### Sprint 2 · 9–13 Nov · Goal: all 21 FRs done. Gate 2 = feature freeze on Friday
- Report mode: attach `attachmentPath` (use `mock-data/sample-report.csv` until Batch 2's buildReport arrives), send to the list (Pavin, FR-19).
- Set up all 5 workflows as seeded jobs and show them working (Pranav + Reshma, FR-20, FR-21).
- Recipients from a list with CC/BCC in the runner (Pavin, FR-09).
- Dashboard filters, last run status, Run now tag in history (Abhin, Sivanandhini).
- Validation and clear error messages on every form (everyone, NFR-03).
- Unit tests for toCron, dedupe and test mode (D07, everyone writes tests for their own module).
- **Batch 2 integration**: swap the connector import and fix the mismatches together.

### Week 4 · 16–20 Nov · Test, deliver, present
Run every test case (D08), log bugs in JIRA (D09), build the RTM (D10) and Test Summary (D11), get UAT signed (D12), write the User Manual (D13, Abhin), then the final report, demo video and viva (D14).

## 6. Stand-up checklist (what to ask, how to verify)

For each person: *what's done (show the PR / JIRA card), what's next, any blocker?* Then verify:

| Task | Ask them to show |
|---|---|
| Any API | A Postman request, then the same request as `user@test.com` → 403 |
| Rules / template / toCron | `npm test` output |
| Mailer | The email in the Ethereal inbox, addressed to TEST_EMAIL |
| Dedupe | Run now twice: second run says sent 0, skipped N |
| Retry | Set `SMTP_PORT=1` in .env, Run now: retryCount 3, error logged, run marked failed |
| Screens | Click it live, including what happens with an empty or invalid input |

Red flags: commits without a JIRA key; work on `main`; real email addresses; `.env` in a PR;
`console.log` of passwords or full rows; a PR that touches someone else's file without asking.

## 7. Decisions already made (and why)

- **One `models/index.js`** holds all collections. It is the database contract on one screen, which makes it easy to review in a PR.
- **Node's built-in test runner** (`node --test`), so there's no Jest setup. Each module gets `test/<module>.test.js`.
- **The Vite proxy** sends `/api` to port 5000, so no CORS package is needed.
- **node-cron, not BullMQ**: no Redis to install, and it is enough for our job counts.
- **Test mode lives in `.env`** (SRS 2.4), not a settings screen.
- **Wireframes are a guide, not a spec.** Improve the layout where it helps; keep the fields and behaviour from the SRS.

## 8. Open questions — Pranav to close with mentor / Batch 2 this week

1. SRS 1.2 says "fake connectors … belong to Batch 2", but the Batch 1 guide says we write `fakeConnector.js` first. We have written it. Fix the SRS wording.
2. **Low stock**: the rule compares a column to a *value* (FR-06), but "quantity below reorder level" compares two columns.
   Our mock data has a `Shortfall` column (ReorderLevel − Quantity), so the rule is `Shortfall > 0`. Ask Batch 2 to return it from their query.
3. **PO follow-up**: the same idea. The mock data has `DaysLate`, so the rule is `DaysLate > 0`.
4. What is the `recordId` in the dedupe key for each workflow? Proposed: InvoiceNo, PONo, ItemCode, and `report` for report jobs.
5. A row with an empty email (INV-105 in the mock data) is logged as failed with "No email address" and doesn't crash the run. Confirm this behaviour.
