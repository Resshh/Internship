
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Jobs() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [selectedJob, setSelectedJob] = useState(null)

  // Real records will be loaded from Pranav's Jobs API.
  const jobs = []

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      `${job.name} ${job.source || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || job.status === statusFilter

    const matchesMode =
      modeFilter === 'all' || job.mode === modeFilter

    return matchesSearch && matchesStatus && matchesMode
  })

  function handleRunNow(job) {
    // Connect to the agreed run endpoint after API integration.
    console.info('Run now requested for:', job.name)
  }

  function handleToggleJob(job) {
    // Connect to the agreed enable/disable endpoint after API integration.
    console.info('Toggle requested for:', job.name)
  }

  function handleEdit(job) {
    // Open the existing job configuration.
    console.info('Edit requested for:', job.name)
  }

  function handleDeleteConfirm() {
    // Connect to the agreed DELETE endpoint after API integration.
    console.info('Delete requested for:', selectedJob?.name)
    setSelectedJob(null)
  }

  return (
    <section className="jobs-page">

      {/* Page heading */}
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

      {/* Search and filters */}
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
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Status: All</option>
            <option value="Active">Active</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>

        <div className="jobs-filter">
          <label htmlFor="mode-filter">Mode</label>
          <select
            id="mode-filter"
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value)}
          >
            <option value="all">Mode: All</option>
            <option value="Message">Message</option>
            <option value="Report">Report</option>
          </select>
        </div>

      </div>

      {/* Jobs table */}
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
              <th>Enabled</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan="8" className="jobs-table-empty">
                  {search || statusFilter !== 'all' || modeFilter !== 'all'
                    ? 'No jobs match your search or selected filters.'
                    : 'No notification jobs have been created yet.'}
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job._id}>
                  <td>{job.name}</td>
                  <td>{job.source || '—'}</td>
                  <td>{job.mode}</td>
                  <td>{job.schedule || '—'}</td>
                  <td>{job.lastRun || '—'}</td>

                  <td>
                    <span className={`job-status ${job.status?.toLowerCase()}`}>
                      {job.status}
                    </span>
                  </td>

                  <td>
                    {job.enabled ? 'Enabled' : 'Disabled'}
                  </td>

                  <td>
                    {isAdmin && (
                      <div className="job-actions">

                        <button
                          type="button"
                          className="action-button"
                          onClick={() => handleRunNow(job)}
                        >
                          Run now
                        </button>

                        <button
                          type="button"
                          className="action-button"
                          onClick={() => handleEdit(job)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="action-button"
                          onClick={() => handleToggleJob(job)}
                        >
                          {job.enabled ? 'Disable' : 'Enable'}
                        </button>

                        <button
                          type="button"
                          className="action-button delete-action"
                          onClick={() => setSelectedJob(job)}
                        >
                          Delete
                        </button>

                      </div>
                    )}
                  </td>
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

      {/* Delete confirmation dialog */}
      {selectedJob && (
        <div className="dialog-overlay">
          <section
            className="confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete notification job?</h2>

            <p>
              Are you sure you want to delete
              <strong> {selectedJob.name}</strong>?
              This action cannot be undone.
            </p>

            <div className="dialog-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setSelectedJob(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="confirm-delete-button"
                onClick={handleDeleteConfirm}
              >
                Delete Job
              </button>
            </div>
          </section>
        </div>
      )}

    </section>
  )
}
