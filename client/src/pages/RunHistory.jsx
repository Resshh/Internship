// Screen 6 - Run History and Delivery Logs (FR-17, FR-18)
import { useEffect, useState } from 'react'
import { api } from '../api.js'

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—')

export default function RunHistory() {
  const [jobs, setJobs] = useState([])
  const [runs, setRuns] = useState([])
  const [filters, setFilters] = useState({ job: '', status: '', from: '', to: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openRun, setOpenRun] = useState(null)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    api('/jobs').then((data) => setJobs(data.jobs || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v))
    let active = true
    api(`/runs?${params}`)
      .then((data) => active && (setRuns(data.runs || []), setError('')))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [filters])

  async function showLogs(run) {
    if (openRun?._id === run._id) return setOpenRun(null)
    setOpenRun(run)
    setLogs([])
    try {
      setLogs((await api(`/runs/${run._id}/logs`)).logs || [])
    } catch (err) {
      setError(err.message)
    }
  }

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))

  return (
    <section className="jobs-page">
      <div className="jobs-page-heading">
        <div>
          <h1>Run history</h1>
          <p>Every run and every email it sent. Click a run to see its delivery log.</p>
        </div>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <div className="jobs-toolbar">
        <div className="jobs-filter">
          <label htmlFor="run-job">Job</label>
          <select id="run-job" value={filters.job} onChange={setFilter('job')}>
            <option value="">All jobs</option>
            {jobs.map((j) => <option key={j._id} value={j._id}>{j.name}</option>)}
          </select>
        </div>
        <div className="jobs-filter">
          <label htmlFor="run-status">Result</label>
          <select id="run-status" value={filters.status} onChange={setFilter('status')}>
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
        </div>
        <div className="jobs-filter">
          <label htmlFor="run-from">From</label>
          <input id="run-from" type="date" value={filters.from} onChange={setFilter('from')} />
        </div>
        <div className="jobs-filter">
          <label htmlFor="run-to">To</label>
          <input id="run-to" type="date" value={filters.to} onChange={setFilter('to')} />
        </div>
      </div>

      <div className="jobs-table-container">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Job</th>
              <th>Fetched</th>
              <th>Matched</th>
              <th>Sent</th>
              <th>Skipped</th>
              <th>Failed</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="jobs-table-empty">Loading runs...</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan="9" className="jobs-table-empty">No runs match these filters.</td></tr>
            ) : runs.map((run) => (
              <RunRow key={run._id} run={run} open={openRun?._id === run._id} logs={logs} onClick={() => showLogs(run)} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RunRow({ run, open, logs, onClick }) {
  return (
    <>
      <tr className="clickable-row" onClick={onClick} aria-expanded={open}>
        <td>{formatDate(run.startTime)}</td>
        <td>{formatDate(run.endTime)}</td>
        <td>{run.jobName}{run.manual && <span className="tag">Run now</span>}</td>
        <td>{run.rowsFetched}</td>
        <td>{run.rowsMatched}</td>
        <td>{run.emailsSent}</td>
        <td>{run.skippedDuplicates}</td>
        <td>{run.failed}</td>
        <td><span className={`run-status ${run.status}`}>{run.status}</span></td>
      </tr>
      {open && (
        <tr className="log-row">
          <td colSpan="9">
            {run.error && <p className="notice notice-error">Run error: {run.error}</p>}
            {logs.length === 0 ? <p>No emails in this run.</p> : (
              <table className="log-table">
                <thead>
                  <tr><th>Recipient</th><th>Subject</th><th>Status</th><th>Retries</th><th>Error</th></tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td>{log.recipient || '—'}</td>
                      <td>{log.subject}</td>
                      <td><span className={`run-status ${log.status}`}>{log.status}</span></td>
                      <td>{log.retryCount}</td>
                      <td>{log.errorMessage || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
