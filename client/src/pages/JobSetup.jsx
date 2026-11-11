// Screen 3 - Job Setup (FR-04 to FR-09, FR-13)
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api.js'

const OPERATORS = ['>', '>=', '<', '<=', '=', '!=']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'UTC']

const emptyJob = {
  name: '',
  mode: 'message',
  queryId: '',
  rule: [],
  schedule: { frequency: 'daily', everyMinutes: 15, time: '09:00', days: [1], dayOfMonth: 1, timezone: 'Asia/Kolkata' },
  recipients: { from: 'column', column: '', listId: '', cc: [], bcc: [] },
  templateId: '',
}

// Same wording as the server's describe() in engine/scheduler.js
function scheduleSummary(s) {
  const tz = s.timezone === 'Asia/Kolkata' ? 'IST' : s.timezone
  if (s.frequency === 'minutes') return s.everyMinutes ? `Runs every ${s.everyMinutes} minutes` : ''
  if (!s.time) return ''
  if (s.frequency === 'daily') return `Runs every day at ${s.time} ${tz}`
  if (s.frequency === 'weekly') {
    return s.days?.length ? `Runs every ${[...s.days].sort().map((d) => DAYS[d]).join(', ')} at ${s.time} ${tz}` : ''
  }
  return s.dayOfMonth ? `Runs on day ${s.dayOfMonth} of every month at ${s.time} ${tz}` : ''
}

const toList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean)

export default function JobSetup() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [job, setJob] = useState(emptyJob)
  const [ccText, setCcText] = useState('')
  const [bccText, setBccText] = useState('')
  const [queries, setQueries] = useState([])
  const [templates, setTemplates] = useState([])
  const [lists, setLists] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState([])
  const [message, setMessage] = useState('')
  const [testResult, setTestResult] = useState(null)

  // Dropdown data, plus the job itself when editing.
  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      api('/queries'),
      api('/templates'),
      api('/recipient-lists'),
      id ? api(`/jobs/${id}`) : null,
    ])
      .then(([q, t, l, j]) => {
        setQueries(q.queries || [])
        setTemplates(t.templates || [])
        setLists(l.lists || [])
        if (j) {
          const loaded = j.job
          setJob({
            ...emptyJob,
            ...loaded,
            schedule: { ...emptyJob.schedule, ...loaded.schedule },
            recipients: { ...emptyJob.recipients, ...loaded.recipients, listId: loaded.recipients?.listId || '' },
            templateId: loaded.templateId || '',
          })
          setCcText((loaded.recipients?.cc || []).join(', '))
          setBccText((loaded.recipients?.bcc || []).join(', '))
        }
      })
      .catch((err) => setErrors([err.message]))
      .finally(() => setLoading(false))
  }, [id, isAdmin])

  // Columns of the chosen query feed the rule and email-column dropdowns.
  useEffect(() => {
    if (!job.queryId) return
    let active = true
    api(`/queries/${job.queryId}/sample`)
      .then((data) => active && setColumns(data.columns || []))
      .catch(() => active && setColumns([]))
    return () => {
      active = false
    }
  }, [job.queryId])

  if (!isAdmin) {
    return <p className="notice notice-error" role="alert">Admins only. You don't have permission to set up jobs.</p>
  }
  if (loading) return <p>Loading job...</p>

  const set = (patch) => setJob((j) => ({ ...j, ...patch }))
  const setSchedule = (patch) => setJob((j) => ({ ...j, schedule: { ...j.schedule, ...patch } }))
  const setRecipients = (patch) => setJob((j) => ({ ...j, recipients: { ...j.recipients, ...patch } }))
  const setCondition = (index, patch) =>
    set({ rule: job.rule.map((c, i) => (i === index ? { ...c, ...patch } : c)) })

  const isReport = job.mode === 'report'
  const recipientsFrom = isReport ? 'list' : job.recipients.from

  function validate() {
    const problems = []
    const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
    if (!job.name.trim()) problems.push('Job name is required.')
    if (!job.queryId) problems.push('Choose a saved query.')
    if (job.rule.some((c) => !c.column || c.value === '' || c.value === undefined)) {
      problems.push('Every rule condition needs a column and a value.')
    }
    if (recipientsFrom === 'column' && !job.recipients.column) problems.push('Choose the column that holds the email address.')
    if (recipientsFrom === 'list' && !job.recipients.listId) problems.push('Choose a recipient list.')
    const badEmail = [...toList(ccText), ...toList(bccText)].find((e) => !emailOk(e))
    if (badEmail) problems.push(`Invalid CC/BCC email address: ${badEmail}`)
    if (!job.templateId) problems.push('Choose a template.')
    if (!scheduleSummary(job.schedule)) problems.push('Complete the schedule.')
    return problems
  }

  // Saves (create or update) and returns the saved job's id, or null on error.
  async function save() {
    const problems = validate()
    setErrors(problems)
    setMessage('')
    if (problems.length) return null

    const body = {
      name: job.name,
      mode: job.mode,
      queryId: job.queryId,
      rule: job.rule,
      schedule: job.schedule,
      recipients: { ...job.recipients, from: recipientsFrom, cc: toList(ccText), bcc: toList(bccText) },
      templateId: job.templateId,
    }
    setSaving(true)
    try {
      const data = await api(id ? `/jobs/${id}` : '/jobs', { method: id ? 'PUT' : 'POST', body })
      setMessage(id ? 'Job saved.' : 'Job created. Enable it from the Job dashboard to start the schedule.')
      if (!id) navigate(`/jobs/${data.job._id}`, { replace: true })
      return data.job._id
    } catch (err) {
      setErrors([err.message])
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleTestRun() {
    setTestResult(null)
    const savedId = await save()
    if (!savedId) return
    try {
      setTestResult(await api(`/jobs/${savedId}/test-run`, { method: 'POST' }))
    } catch (err) {
      setErrors([err.message])
    }
  }

  return (
    <section className="job-setup">
      <div className="jobs-page-heading">
        <div>
          <h1>{id ? 'Edit job' : 'New job'}</h1>
          <p>{scheduleSummary(job.schedule) || 'Set up what to check, who to email and when.'}</p>
        </div>
        <Link to="/" className="action-button">Back to jobs</Link>
      </div>

      {errors.length > 0 && (
        <div className="notice notice-error" role="alert">
          {errors.map((e) => <div key={e}>{e}</div>)}
        </div>
      )}
      {message && <p className="notice notice-success" role="status">{message}</p>}

      <fieldset className="setup-card">
        <legend>1. Basics</legend>
        <label>Job name
          <input value={job.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Payment Reminder" />
        </label>
        <label>Mode
          <select value={job.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="message">Message — one email per matching row</option>
            <option value="report">Report — one email with the data attached</option>
          </select>
        </label>
        <label>Saved query
          <select value={job.queryId} onChange={(e) => set({ queryId: e.target.value })}>
            <option value="">Choose a query...</option>
            {queries.map((q) => <option key={q._id} value={q._id}>{q.connection} / {q.name}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="setup-card">
        <legend>2. Rule (all conditions must match)</legend>
        {job.rule.length === 0 && <p className="hint">No conditions: every row matches.</p>}
        {job.rule.map((c, i) => (
          <div className="rule-row" key={i}>
            <select aria-label="Column" value={c.column} onChange={(e) => setCondition(i, { column: e.target.value })}>
              <option value="">Column...</option>
              {columns.map((col) => <option key={col}>{col}</option>)}
            </select>
            <select aria-label="Operator" value={c.op} onChange={(e) => setCondition(i, { op: e.target.value })}>
              {OPERATORS.map((op) => <option key={op}>{op}</option>)}
            </select>
            <input aria-label="Value" value={c.value ?? ''} onChange={(e) => setCondition(i, { value: e.target.value })} placeholder="Value" />
            <button type="button" className="action-button delete-action"
              onClick={() => set({ rule: job.rule.filter((_, n) => n !== i) })}>Remove</button>
          </div>
        ))}
        <button type="button" className="action-button" disabled={!job.queryId}
          onClick={() => set({ rule: [...job.rule, { column: '', op: '>', value: '' }] })}>
          + Add condition
        </button>
      </fieldset>

      <fieldset className="setup-card">
        <legend>3. Recipients</legend>
        {!isReport && (
          <div className="radio-row">
            <label><input type="radio" checked={recipientsFrom === 'column'} onChange={() => setRecipients({ from: 'column' })} /> Email column in the data</label>
            <label><input type="radio" checked={recipientsFrom === 'list'} onChange={() => setRecipients({ from: 'list' })} /> Named recipient list</label>
          </div>
        )}
        {recipientsFrom === 'column' ? (
          <label>Email column
            <select value={job.recipients.column || ''} onChange={(e) => setRecipients({ column: e.target.value })}>
              <option value="">Choose a column...</option>
              {columns.map((col) => <option key={col}>{col}</option>)}
            </select>
          </label>
        ) : (
          <label>Recipient list
            <select value={job.recipients.listId} onChange={(e) => setRecipients({ listId: e.target.value })}>
              <option value="">Choose a list...</option>
              {lists.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <label>CC (comma separated)
          <input value={ccText} onChange={(e) => setCcText(e.target.value)} placeholder="manager@test.com" />
        </label>
        <label>BCC (comma separated)
          <input value={bccText} onChange={(e) => setBccText(e.target.value)} />
        </label>
      </fieldset>

      <fieldset className="setup-card">
        <legend>4. Template</legend>
        <label>Email template
          <select value={job.templateId} onChange={(e) => set({ templateId: e.target.value })}>
            <option value="">Choose a template...</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </label>
        {isReport && <p className="hint">Report templates can use {'{{Date}}'}, {'{{RowCount}}'} and {'{{JobName}}'}. The data is attached as CSV.</p>}
        <Link to="/templates" className="hint">Create or edit templates</Link>
      </fieldset>

      <fieldset className="setup-card">
        <legend>5. Schedule</legend>
        <label>Frequency
          <select value={job.schedule.frequency} onChange={(e) => setSchedule({ frequency: e.target.value })}>
            <option value="minutes">Every X minutes</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        {job.schedule.frequency === 'minutes' ? (
          <label>Every (minutes)
            <input type="number" min="1" max="59" value={job.schedule.everyMinutes ?? ''}
              onChange={(e) => setSchedule({ everyMinutes: e.target.value === '' ? '' : Number(e.target.value) })} />
          </label>
        ) : (
          <label>Time
            <input type="time" value={job.schedule.time || ''} onChange={(e) => setSchedule({ time: e.target.value })} />
          </label>
        )}
        {job.schedule.frequency === 'weekly' && (
          <div className="radio-row" role="group" aria-label="Weekdays">
            {DAYS.map((d, i) => (
              <label key={d}>
                <input type="checkbox" checked={job.schedule.days?.includes(i) || false}
                  onChange={(e) => setSchedule({
                    days: e.target.checked ? [...(job.schedule.days || []), i] : job.schedule.days.filter((x) => x !== i),
                  })} /> {d}
              </label>
            ))}
          </div>
        )}
        {job.schedule.frequency === 'monthly' && (
          <label>Day of month
            <input type="number" min="1" max="31" value={job.schedule.dayOfMonth ?? ''}
              onChange={(e) => setSchedule({ dayOfMonth: e.target.value === '' ? '' : Number(e.target.value) })} />
          </label>
        )}
        <label>Timezone
          <select value={job.schedule.timezone} onChange={(e) => setSchedule({ timezone: e.target.value })}>
            {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
          </select>
        </label>
        <p className="hint"><strong>{scheduleSummary(job.schedule) || 'Schedule incomplete'}</strong></p>
      </fieldset>

      <div className="setup-actions">
        <button type="button" className="primary-button" disabled={saving} onClick={save}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="action-button" disabled={saving} onClick={handleTestRun}>
          Test run &amp; preview email
        </button>
      </div>

      {testResult && (
        <div className="setup-card test-result">
          <h3>Test run (first 5 rows, nothing sent)</h3>
          <p>
            Fetched <strong>{testResult.rowsFetched}</strong> · Matched <strong>{testResult.rowsMatched}</strong> ·
            Emails to send <strong>{testResult.emailsToSend}</strong>
            {testResult.noEmailAddress > 0 && <> · No email address <strong>{testResult.noEmailAddress}</strong></>}
          </p>
          {testResult.preview ? (
            <div className="email-preview">
              <p><strong>To:</strong> {testResult.preview.to.join(', ') || '(no address)'}</p>
              {testResult.preview.cc?.length > 0 && <p><strong>CC:</strong> {testResult.preview.cc.join(', ')}</p>}
              <p><strong>Subject:</strong> {testResult.preview.subject}</p>
              {testResult.preview.attachment && <p><strong>Attachment:</strong> {testResult.preview.attachment}</p>}
              <pre>{testResult.preview.body}</pre>
              {testResult.preview.missing.map((m) => (
                <p key={m} className="notice notice-error">Placeholder {`{{${m}}}`} has no value</p>
              ))}
            </div>
          ) : <p>No rows match the rule, so no email would be sent.</p>}
        </div>
      )}
    </section>
  )
}
