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
// engine/rules.js            (Pavin, T03)
toObjects({ columns, rows })        // -> [{ InvoiceNo: 'INV-101', ... }, ...]
matches(row, conditions)            // -> true/false; conditions = job.rule; [] matches everything
// engine/template.js         (Pranav, T04)
render(text, row)                   // -> { text, missing: ['Amount'] }  never throws (FR-12)
// engine/mailer.js           (Pavin, T02)
sendMail({ to, cc, bcc, subject, html, attachments })  // applies TEST_MODE; throws on SMTP error
// engine/scheduler.js        (Pranav, T17 + T19)
toCron(schedule)                    // -> '0 19 * * *'
startScheduler(); reloadJob(job)    // start all enabled jobs; re-register one after edit/enable/disable
// engine/runner.js           (Pavin, T11 + T15 + T16 + T22)
runJob(jobId, { manual, testRun })  // -> the saved JobRun; testRun = limit rows, send nothing (FR-13)
```

API routes, one file per owner: `routes/jobs.js` (Pranav), `routes/templates.js` (Pranav),
`routes/recipientLists.js` (Sivanandhini), `routes/runs.js` (Sivanandhini). Each owner adds one `app.use` line in `index.js`.

## 4. Team and roles

| Person | Owns | Also |
|---|---|---|
| Reshma (Lead) | PR review and merge, JIRA board, stand-ups, Batch 2 contact | Sprint notes (D06), JIRA backlog doc (D05) |
| Pavin (Developer) | The engine: mailer, rules, runner, dedupe, retry, reports, Batch 2 integration | Bug fixing lead |
| Pranav (BA) | Templates (engine, API, screen), Jobs API, scheduler, seeded workflows | Open questions (section 9), demo video, final report |
| Abhin (Docs) | Login, header, Job dashboard, Job setup screen | User manual (D13) |
| Sivanandhini (Test) | Recipient lists (API and screen), Run history (API and screen) | Test plan, test cases, bugs, RTM, test summary |

### Your job as PR reviewer: check every PR for these
1. **Title and branch** carry the JIRA key (`FSD-12 ...`). The PR touches only that task's files.
2. **Admin routes** use `requireAdmin`. Read-only routes use `requireAuth`. Try one as `user@test.com`: you should get 403.
3. **No secrets or real data**: no `.env`, no passwords, no real email addresses, no `console.log` of whole rows.
4. **Engine reads data only through `runQuery`**. Nothing else imports `mock-data/` directly.
5. **Tests**: engine modules include a `test/*.test.js`, and `npm test` passes on your machine.
6. **It runs**: pull the branch, start it, and click through the "Done when" from the JIRA card.
7. **Small and readable**: ask for changes if you can't explain the code back to its author.

Merge with **Squash and merge**, then tell the team in WhatsApp to pull `main`.

## 5. Timeline: 1.5 weeks (8 working days)

| Days | Phase |
|---|---|
| Day 1–5 (2–6 Nov) | Build. By Friday, "Run now" sends a payment reminder end to end, with dedupe and retry. Review demo on Friday. |
| Day 6 (Mon 9 Nov) | Last features: reports, the 5 workflows, Batch 2 swap. **Feature freeze at end of day.** |
| Day 7 (Tue 10 Nov) | Test everything, log bugs, fix bugs. |
| Day 8 (Wed 11 Nov) | Documents, demo video, UAT, final review. |

Dependency order: T08 (Jobs API) before T09 and T13 can save; T11 (runner) before T15, T16, T20 and T22;
T17 (toCron) before T19. Screens can be built against the API shape in their JIRA card while the API is still being written.

## 6. Daily tasks (copy into JIRA, or import `JIRA_Backlog_Import.csv`)

Everyone, Day 1 morning: pull `main`, follow the README setup, and log in via Postman as `admin@test.com / Test@123`.
A card is done only when its PR is merged and the "Done when" works on `main`.

### Day 1 · Mon 2 Nov

| Ref | Who | Task | Pts | Req | Done when |
|---|---|---|---|---|---|
| T01 | Abhin | Login screen, auth state and app header | 3 | FR-01, FR-02, FR-14 | Login.jsx calls POST /api/auth/login and saves token+user to localStorage; wrong password shows "Invalid email or password"; no token redirects to /login; header shows user name, role, Log out and a TEST MODE: ON badge from GET /api/health. |
| T02 | Pavin | Mailer with test mode (engine/mailer.js) | 2 | FR-14, BR-07 | sendMail({to,cc,bcc,subject,html,attachments}) sends via Ethereal SMTP from .env; when TEST_MODE=true, to=TEST_EMAIL and cc/bcc dropped; screenshot of the Ethereal inbox attached to the card. |
| T03 | Pavin | Rule engine (engine/rules.js) + unit tests | 2 | FR-06, BR-01 | toObjects(data) turns rows into objects; matches(row, conditions) supports > >= < <= = != joined with AND; empty rule matches all; test/rules.test.js: DaysOverdue > 7 on overdue-invoices.json returns INV-101, INV-103, INV-105. |
| T04 | Pranav | Template renderer (engine/template.js) + unit tests | 2 | FR-11, FR-12 | render(text,row) returns {text, missing}; uses Handlebars; a missing placeholder is left empty and listed in missing; never throws; test/template.test.js covers normal, missing value and empty template. |
| T05 | Pranav | Templates API with preview | 2 | FR-11, FR-12 | routes/templates.js: GET list/one for any logged-in user; POST/PUT/DELETE admin only (user gets 403); POST /api/templates/preview {subject, body, row} returns filled subject/body and the missing list. |
| T06 | Sivanandhini | Recipient lists API | 2 | FR-10 | routes/recipientLists.js: GET for any logged-in user; POST/PUT/DELETE admin only; each list has name, emails (To), cc, bcc; invalid email addresses rejected with 400 and a clear message; duplicate list name rejected. |
| T07 | Sivanandhini | Test Plan document (D04) | 2 | NFR-09 | D04 filled from the template; test cases listed for every row of Batch 1 guide section 10 and every FR; uploaded to Drive. |

### Day 2 · Tue 3 Nov

| Ref | Who | Task | Pts | Req | Done when |
|---|---|---|---|---|---|
| T08 | Pranav | Jobs API and saved-queries API | 3 | FR-03, FR-04, FR-05, BR-03 | routes/jobs.js: GET list (with query name) for any user; GET one, POST, PUT admin only; PATCH /:id/enabled refuses to enable a job missing query, schedule, recipients or template (400); GET /api/queries reads our DB only; user gets 403 on writes. |
| T09 | Abhin | Job dashboard screen | 3 | FR-03, FR-04 | Table: name, source/query, mode, schedule, last run, status; Enabled toggle and Run now/Edit for admins only; normal user sees a read-only table; search by name, filter by status and mode; + New job opens Job setup. |
| T10 | Sivanandhini | Recipient lists screen | 3 | FR-10 | Create a named list; add an address as To/CC/BCC; remove an address; invalid address shows an error; Save persists; delete list asks for confirmation. |
| T11 | Pavin | Job runner v1: fetch, filter, recipient, render, send, log | 5 | FR-09, FR-17, FR-20, BR-05, BR-11 | engine/runner.js runJob(jobId,{manual,testRun}): runQuery -> rule -> recipient from column or list (+cc/bcc) -> render -> sendMail -> DeliveryLog per email; JobRun saved with counts and status even when the run throws; 0 matches = 0 emails and run success; a row with no email is logged as failed "No email address". |

### Day 3 · Wed 4 Nov

| Ref | Who | Task | Pts | Req | Done when |
|---|---|---|---|---|---|
| T12 | Pranav | Template editor screen with preview | 3 | FR-11, FR-12 | Select/new/save/delete template; subject and body boxes; clickable placeholder list inserts {{Column}}; preview with a chosen sample row; warning "Placeholder {{X}} has no value" shown, no crash. |
| T13 | Abhin | Job setup screen: basics, rule, recipients, template | 5 | FR-04, FR-05, FR-06, FR-09, FR-11 | Name, mode, query dropdown from /api/queries; rule rows (column, operator, value, + Add condition); recipients radio (column/list) with CC/BCC; template dropdown; Save creates or updates the job; required fields validated with clear messages. |
| T14 | Sivanandhini | Run history API | 2 | FR-17, FR-18 | GET /api/runs with filters job, status, from, to (newest first, job name included); GET /api/runs/:id/logs returns delivery logs; any logged-in user can read. |

### Day 4 · Thu 5 Nov

| Ref | Who | Task | Pts | Req | Done when |
|---|---|---|---|---|---|
| T15 | Pavin | Duplicate control with sent_history | 3 | FR-15, BR-04, BR-06 | Dedupe key jobName:recordId:YYYY-MM-DD; insert into sent_history before sending (unique index blocks duplicates); a duplicate is counted in skippedDuplicates and logged as skipped, not as a failure; run twice on the same day: second run sends 0. |
| T16 | Pavin | Retry failed emails and log failures | 2 | FR-16, BR-09, NFR-04 | A failed send is retried up to 3 times; retryCount and a safe errorMessage are stored; one failing email does not stop the others; run marked failed when any email fails; the sent_history entry is removed for a failed email so the next run can try again. |
| T17 | Pranav | Schedule to cron converter (toCron) + unit tests | 2 | FR-07, NFR-10 | toCron(schedule) for minutes (*/X), daily, weekly (days list) and monthly (date); human summary text e.g. "every Thursday at 10:00 IST"; tests for all 4 frequencies and invalid input. |
| T18 | Sivanandhini | Run history screen | 3 | FR-18 | Filters job/result/dates; table start, end, job (with "(Run now)" tag), fetched, matched, sent, skipped, failed, result; clicking a run shows recipient, subject, status, retries, error. |

### Day 5 · Fri 6 Nov

| Ref | Who | Task | Pts | Req | Done when |
|---|---|---|---|---|---|
| T19 | Pranav | Scheduler: run enabled jobs automatically | 3 | FR-08, BR-02 | engine/scheduler.js: on server start registers every enabled job with node-cron in its timezone; reloadJob(job) is called after create/edit/enable/disable; a disabled job never runs; demo: an every-1-minute job runs by itself. |
| T20 | Pavin | Run now and Test run endpoints | 2 | FR-04, FR-13 | POST /api/jobs/:id/run (admin) runs immediately with manual=true; POST /api/jobs/:id/test-run (admin) fetches max 5 rows, returns rowsFetched, rowsMatched, emailsToSend and a filled preview of the first email, sends nothing and writes no sent_history. |
| T21 | Abhin | Job setup screen: schedule, Test run and Preview | 3 | FR-07, FR-13 | Frequency dropdown with minutes box / time / weekday checkboxes / day of month; timezone (default Asia/Kolkata); summary line; Test run shows the counts panel; Preview email shows the filled subject/body. |

### Day 6 · Mon 9 Nov

| Ref | Who | Task | Pts | Req | Done when |
|---|---|---|---|---|---|
| T22 | Pavin | Report jobs: one email with attachment to a list | 3 | FR-19, FR-21, BR-11 | mode=report sends one email to the named list with attachmentPath attached (mock-data/sample-report.csv until Batch 2 buildReport is ready); dedupe key jobName:report:date; logged like message jobs. |
| T23 | Pranav | Seed the 5 demo workflows | 2 | FR-20, FR-21 | seed.js adds templates, 4 lists (Finance Team, Sales Management, Purchase Team, Store Managers) and 5 jobs: payment reminder (DaysOverdue > 7), PO follow-up (DaysLate > 0), low stock (Shortfall > 0), daily sales 7 PM, weekly receivables Monday; each runs successfully with Run now. |
| T24 | Sivanandhini | Test case document (D08) and unit test report (D07) | 3 | NFR-09 | Step-by-step test cases with expected results for all FRs and the 8 guide test cases; D07 lists every npm test case with its result. |
| T25 | Abhin | Hide admin-only menu items and buttons for normal users | 1 | FR-02, BR-08 | A normal user sees no New job, Edit, Enable, Run now, Save or Delete anywhere; opening an admin URL shows "Admins only" (the server already returns 403). |
| T26 | Pavin | Integrate Batch 2 connector (if ready) - FEATURE FREEZE end of day | 2 | NFR-07 | Change the one require line to Batch 2 runQuery; all 5 workflows still run; issues logged as JIRA bugs. If Batch 2 is not ready, note it in sprint notes and keep fakeConnector. |

### Day 7 · Tue 10 Nov

| Ref | Who | Task | Pts | Req | Done when |
|---|---|---|---|---|---|
| T27 | Sivanandhini | Execute all test cases and log bugs | 3 | NFR-09 | Every D08 test run with Pass/Fail; each Fail raised as a JIRA Bug with a screenshot and assigned to the module owner; retested after the fix. |
| T28 | Pavin | Fix bugs (all developers) | 3 | - | All Critical and High bugs closed by end of Day 7. Pranav and Abhin fix bugs in their own modules too. |
| T29 | Abhin | User manual and release notes (D13) | 3 | - | Screenshots of every screen; setup steps; how to create each of the 5 workflows; release notes v1.0. |

### Day 8 · Wed 11 Nov

| Ref | Who | Task | Pts | Req | Done when |
|---|---|---|---|---|---|
| T30 | Sivanandhini | RTM and Test Summary Report (D10, D11) | 2 | - | Every FR-01 to FR-21 mapped to a test case and result; summary of planned/run/passed/failed tests and bugs by severity. |
| T31 | Pranav | Demo video, final report (D14) and UAT walkthrough (D12) | 3 | - | Recorded demo of the 5 workflows, dedupe, retry, test mode and role block; final report sections filled; UAT form ready for the Domain Team signature. |

**Points per person:** Abhin 18, Pavin 24, Pranav 20, Sivanandhini 20

## 7. Stand-up checklist (what to ask, how to verify)

For each person: *what's done (show the PR / JIRA card), what's next, any blocker?* Anyone behind their day's card gets help from the person who is ahead, decided at stand-up. Then verify:

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

## 8. Decisions already made (and why)

- **One `models/index.js`** holds all collections. It is the database contract on one screen, which makes it easy to review in a PR.
- **Node's built-in test runner** (`node --test`), so there's no Jest setup. Each module gets `test/<module>.test.js`.
- **The Vite proxy** sends `/api` to port 5000, so no CORS package is needed.
- **node-cron, not BullMQ**: no Redis to install, and it is enough for our job counts.
- **Test mode lives in `.env`** (SRS 2.4), not a settings screen.
- **Wireframes are a guide, not a spec.** Improve the layout where it helps; keep the fields and behaviour from the SRS.

## 9. Open questions — Pranav to close with mentor / Batch 2 this week

1. SRS 1.2 says "fake connectors … belong to Batch 2", but the Batch 1 guide says we write `fakeConnector.js` first. We have written it. Fix the SRS wording.
2. **Low stock**: the rule compares a column to a *value* (FR-06), but "quantity below reorder level" compares two columns.
   Our mock data has a `Shortfall` column (ReorderLevel − Quantity), so the rule is `Shortfall > 0`. Ask Batch 2 to return it from their query.
3. **PO follow-up**: the same idea. The mock data has `DaysLate`, so the rule is `DaysLate > 0`.
4. What is the `recordId` in the dedupe key for each workflow? Proposed: InvoiceNo, PONo, ItemCode, and `report` for report jobs.
5. A row with an empty email (INV-105 in the mock data) is logged as failed with "No email address" and doesn't crash the run. Confirm this behaviour.
