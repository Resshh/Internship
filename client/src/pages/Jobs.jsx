// Screen 2 - Job dashboard (FR-03, FR-04)
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api.js'

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—')

export default function Jobs() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [selectedJob, setSelectedJob] = useState(null)

  function loadJobs() {
    return api('/jobs')
      .then((data) => setJobs(data.jobs || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadJobs()
  }, [])

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = `${job.name} ${job.queryName || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'Active') === job.enabled
    const matchesMode = modeFilter === 'all' || job.mode === modeFilter
    return matchesSearch && matchesStatus && matchesMode
  })

  // Runs an action for one job, shows its result, then refreshes the table.
  async function act(job, action, success) {
    setBusyId(job._id)
    setError('')
    setMessage('')
    try {
      const data = await action()
      setMessage(success(data))
      await loadJobs()
    } catch (err) {
      setError(`${job.name}: ${err.message}`)
    } finally {
      setBusyId(null)
    }
  }

  const handleRunNow = (job) =>
    act(job, () => api(`/jobs/${job._id}/run`, { method: 'POST' }), ({ run }) =>
      `${job.name}: ${run.status} — sent ${run.emailsSent}, skipped ${run.skippedDuplicates}, failed ${run.failed}` +
      (run.error ? ` (${run.error})` : ''))

  const handleToggleJob = (job) =>
    act(job, () => api(`/jobs/${job._id}/enabled`, { method: 'PATCH', body: { enabled: !job.enabled } }),
      () => `${job.name} ${job.enabled ? 'disabled' : 'enabled'}`)

  function handleDeleteConfirm() {
    const job = selectedJob
    setSelectedJob(null)
    act(job, () => api(`/jobs/${job._id}`, { method: 'DELETE' }), () => `${job.name} deleted`)
  }

  return (
    <section className="jobs-page">
      <div className="jobs-page-heading">
        <div>
          <h1>Jobs</h1>
          <p>View and manage notification jobs.</p>
        </div>

        {isAdmin && (
          <Link to="/jobs/new" className="primary-button">
            <span aria-hidden="true">+</span>
            New job
          </Link>
        )}
      </div>

      {message && <p className="notice notice-success" role="status">{message}</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <div className="jobs-toolbar">
        <div className="jobs-search">
          <label htmlFor="job-search">Search jobs</label>
          <input
            id="job-search"
            type="search"
            placeholder="Search by job name or source..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="jobs-filter">
          <label htmlFor="status-filter">Status</label>
          <select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Status: All</option>
            <option value="Active">Active</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>

        <div className="jobs-filter">
          <label htmlFor="mode-filter">Mode</label>
          <select id="mode-filter" value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
            <option value="all">Mode: All</option>
            <option value="message">Message</option>
            <option value="report">Report</option>
          </select>
        </div>
      </div>

      <div className="jobs-table-container">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Job name</th>
              <th>Source / Query</th>
              <th>Mode</th>
              <th>Schedule</th>
              <th>Last run</th>
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="jobs-table-empty">Loading jobs...</td></tr>
            ) : filteredJobs.length === 0 ? (
              <tr>
                <td colSpan="7" className="jobs-table-empty">
                  {search || statusFilter !== 'all' || modeFilter !== 'all'
                    ? 'No jobs match your search or selected filters.'
                    : 'No notification jobs have been created yet.'}
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job._id}>
                  <td>{job.name}</td>
                  <td>{job.queryName ? `${job.connection} / ${job.queryName}` : '—'}</td>
                  <td className="capitalize">{job.mode}</td>
                  <td>{job.scheduleText || '—'}</td>
                  <td>
                    {job.lastRun ? (
                      <>
                        {formatDate(job.lastRun.startTime)}{' '}
                        <span className={`run-status ${job.lastRun.status}`}>{job.lastRun.status}</span>
                      </>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`job-status ${job.enabled ? 'active' : 'disabled'}`}>
                      {job.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>

                  {isAdmin && (
                    <td>
                      <div className="job-actions">
                        <button type="button" className="action-button" disabled={busyId === job._id}
                          onClick={() => handleRunNow(job)}>
                          {busyId === job._id ? 'Working...' : 'Run now'}
                        </button>
                        <button type="button" className="action-button" onClick={() => navigate(`/jobs/${job._id}`)}>
                          Edit
                        </button>
                        <button type="button" className="action-button" disabled={busyId === job._id}
                          onClick={() => handleToggleJob(job)}>
                          {job.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" className="action-button delete-action" onClick={() => setSelectedJob(job)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <p className="jobs-readonly-note">
          You are viewing jobs in read-only mode.
          Administrative actions are available only to administrators.
        </p>
      )}

      {selectedJob && (
        <div className="dialog-overlay">
          <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">Delete notification job?</h2>
            <p>
              Are you sure you want to delete
              <strong> {selectedJob.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="dialog-actions">
              <button type="button" className="cancel-button" onClick={() => setSelectedJob(null)}>Cancel</button>
              <button type="button" className="confirm-delete-button" onClick={handleDeleteConfirm}>Delete Job</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
