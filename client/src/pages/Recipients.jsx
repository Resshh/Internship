import { useEffect, useState } from 'react'
import { api } from '../api.js'
import './Recipients.css'

const emptyForm = {
  name: '',
  emails: [],
  cc: [],
  bcc: [],
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Recipients() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [emailInputs, setEmailInputs] = useState({
    emails: '',
    cc: '',
    bcc: '',
  })

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  // setState only inside callbacks, so it is safe to call from useEffect
  function loadLists() {
    return api('/recipient-lists')
      .then((data) => {
        if (!Array.isArray(data.lists)) {
          throw new Error('Invalid recipient-list response.')
        }
        setLists(data.lists)
      })
      .catch((err) => setError(err.message || 'Unable to load recipient lists.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLists()
  }, [])

  function openCreateForm() {
    setEditingId(null)
    setForm({
      ...emptyForm,
      emails: [],
      cc: [],
      bcc: [],
    })
    setEmailInputs({ emails: '', cc: '', bcc: '' })
    setError('')
    setMessage('')
    setFormOpen(true)
  }

  function openEditForm(list) {
    setEditingId(list._id)

    setForm({
      name: list.name || '',
      emails: [...(list.emails || [])],
      cc: [...(list.cc || [])],
      bcc: [...(list.bcc || [])],
    })

    setEmailInputs({ emails: '', cc: '', bcc: '' })
    setError('')
    setMessage('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setEmailInputs({ emails: '', cc: '', bcc: '' })
  }

  function updateName(value) {
    setForm((current) => ({
      ...current,
      name: value,
    }))
  }

  function updateEmailInput(field, value) {
    setEmailInputs((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function addEmail(field) {
    const value = emailInputs[field].trim()

    if (!value) return

    const addresses = value
      .split(/[,\n;]+/)
      .map((email) => email.trim())
      .filter(Boolean)

    const invalid = addresses.find((email) => !emailPattern.test(email))

    if (invalid) {
      setError(`"${invalid}" is not a valid email address.`)
      return
    }

    const existing = [
      ...form.emails,
      ...form.cc,
      ...form.bcc,
    ].map((email) => email.toLowerCase())

    const duplicate = addresses.find((email) =>
      existing.includes(email.toLowerCase())
    )

    if (duplicate) {
      setError(`"${duplicate}" has already been added.`)
      return
    }

    setError('')

    setForm((current) => ({
      ...current,
      [field]: [...current[field], ...addresses],
    }))

    setEmailInputs((current) => ({
      ...current,
      [field]: '',
    }))
  }

  function removeEmail(field, index) {
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((_, i) => i !== index),
    }))
  }

  function handleEmailKeyDown(event, field) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addEmail(field)
    }
  }

  async function saveList(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    // Include any email still present in the input fields.
    const updatedForm = { ...form }

    for (const field of ['emails', 'cc', 'bcc']) {
      const value = emailInputs[field].trim()

      if (value) {
        const addresses = value
          .split(/[,\n;]+/)
          .map((email) => email.trim())
          .filter(Boolean)

        const invalid = addresses.find(
          (email) => !emailPattern.test(email)
        )

        if (invalid) {
          setError(`"${invalid}" is not a valid email address.`)
          return
        }

        updatedForm[field] = [...updatedForm[field], ...addresses]
      }
    }

    const allEmails = [
      ...updatedForm.emails,
      ...updatedForm.cc,
      ...updatedForm.bcc,
    ].map((email) => email.toLowerCase())

    if (new Set(allEmails).size !== allEmails.length) {
      setError('An email address cannot appear more than once in the list.')
      return
    }

    if (!updatedForm.name.trim()) {
      setError('Recipient list name is required.')
      return
    }

    if (updatedForm.emails.length === 0) {
      setError('Please add at least one To email address.')
      return
    }

    for (const email of allEmails) {
      if (!emailPattern.test(email)) {
        setError(`Invalid email address: ${email}`)
        return
      }
    }

    const duplicateName = lists.find(
      (list) =>
        list.name.trim().toLowerCase() === updatedForm.name.trim().toLowerCase() &&
        list._id !== editingId
    )

    if (duplicateName) {
      setError('A recipient list with this name already exists.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        name: updatedForm.name.trim(),
        emails: updatedForm.emails,
        cc: updatedForm.cc,
        bcc: updatedForm.bcc,
      }

      if (editingId) {
        await api(`/recipient-lists/${editingId}`, {
          method: 'PUT',
          body: payload,
        })

        setMessage('Recipient list updated successfully.')
      } else {
        await api('/recipient-lists', {
          method: 'POST',
          body: payload,
        })

        setMessage('Recipient list created successfully.')
      }

      closeForm()
      await loadLists()
    } catch (err) {
      setError(err.message || 'Unable to save recipient list.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setError('')
    setMessage('')

    try {
      await api(`/recipient-lists/${deleteTarget._id}`, {
        method: 'DELETE',
      })

      setDeleteTarget(null)
      await loadLists()
      setMessage('Recipient list deleted successfully.')
    } catch (err) {
      setError(err.message || 'Unable to delete recipient list.')
      setDeleteTarget(null)
    }
  }

  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <section className="recipients-page">

      <div className="recipients-heading">
        <div>
          <p className="recipients-eyebrow">EMAIL AUTOMATION</p>
          <h2>Recipient Lists</h2>
          <p className="recipients-subtitle">
            Manage email recipients and distribution lists.
          </p>
        </div>

        <button
          type="button"
          className="recipients-primary-btn"
          onClick={openCreateForm}
        >
          <span>+</span> New List
        </button>
      </div>

      {message && (
        <div className="recipients-message recipients-success" role="status">
          <span>✓</span> {message}
          <button type="button" onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {error && !formOpen && (
        <div className="recipients-message recipients-error" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="recipients-toolbar">
        <div>
          <h3>All Recipient Lists</h3>
          <p>{lists.length} {lists.length === 1 ? 'list' : 'lists'} available</p>
        </div>

        <div className="recipients-search">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Search recipient lists..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search recipient lists"
          />
        </div>
      </div>

      {loading ? (
        <div className="recipients-empty">
          Loading recipient lists...
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="recipients-empty">
          <div className="recipients-empty-icon">✉</div>
          <h3>{search ? 'No matching lists found' : 'No recipient lists yet'}</h3>
          <p>
            {search
              ? 'Try searching with a different list name.'
              : 'Create your first recipient list to get started.'}
          </p>
          {!search && (
            <button
              type="button"
              className="recipients-primary-btn"
              onClick={openCreateForm}
            >
              + Create Recipient List
            </button>
          )}
        </div>
      ) : (
        <div className="recipients-table-card">
          <div className="recipients-table-wrap">
            <table className="recipients-table">
              <thead>
                <tr>
                  <th>LIST NAME</th>
                  <th>TO EMAILS</th>
                  <th>CC EMAILS</th>
                  <th>BCC EMAILS</th>
                  <th className="recipients-actions-heading">ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredLists.map((list) => (
                  <tr key={list._id}>
                    <td>
                      <div className="recipients-list-name">
                        <span className="recipients-list-icon">✉</span>
                        <strong>{list.name}</strong>
                      </div>
                    </td>

                    <td>
                      <EmailSummary emails={list.emails || []} />
                    </td>

                    <td>
                      <EmailSummary emails={list.cc || []} />
                    </td>

                    <td>
                      <EmailSummary emails={list.bcc || []} />
                    </td>

                    <td>
                      <div className="recipients-actions">
                        <button
                          type="button"
                          className="recipients-edit-btn"
                          onClick={() => openEditForm(list)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="recipients-delete-btn"
                          onClick={() => setDeleteTarget(list)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && (
        <div
          className="recipients-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm()
          }}
        >
          <div
            className="recipients-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipient-form-title"
          >
            <div className="recipients-modal-header">
              <div>
                <p className="recipients-eyebrow">
                  RECIPIENT MANAGEMENT
                </p>
                <h3 id="recipient-form-title">
                  {editingId ? 'Edit Recipient List' : 'Create Recipient List'}
                </h3>
                <p>
                  Add the email addresses that should receive notifications.
                </p>
              </div>

              <button
                type="button"
                className="recipients-close-btn"
                onClick={closeForm}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="recipients-message recipients-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={saveList}>
              <div className="recipients-form-body">
                <label className="recipients-field">
                  <span>List Name <b>*</b></span>
                  <input
                    type="text"
                    placeholder="e.g. Finance Team"
                    value={form.name}
                    onChange={(event) => updateName(event.target.value)}
                    required
                    maxLength={100}
                  />
                </label>

                <EmailField
                  label="To Email Addresses"
                  required
                  field="emails"
                  values={form.emails}
                  inputValue={emailInputs.emails}
                  onInputChange={updateEmailInput}
                  onAdd={addEmail}
                  onRemove={removeEmail}
                  onKeyDown={handleEmailKeyDown}
                />

                <EmailField
                  label="CC Email Addresses"
                  field="cc"
                  values={form.cc}
                  inputValue={emailInputs.cc}
                  onInputChange={updateEmailInput}
                  onAdd={addEmail}
                  onRemove={removeEmail}
                  onKeyDown={handleEmailKeyDown}
                />

                <EmailField
                  label="BCC Email Addresses"
                  field="bcc"
                  values={form.bcc}
                  inputValue={emailInputs.bcc}
                  onInputChange={updateEmailInput}
                  onAdd={addEmail}
                  onRemove={removeEmail}
                  onKeyDown={handleEmailKeyDown}
                />
              </div>

              <div className="recipients-modal-footer">
                <button
                  type="button"
                  className="recipients-cancel-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="recipients-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Create List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="recipients-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeleteTarget(null)
          }}
        >
          <div
            className="recipients-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="recipients-confirm-icon">!</div>

            <h3 id="delete-title">Delete Recipient List?</h3>

            <p>
              Are you sure you want to delete
              {' '}<strong>{deleteTarget.name}</strong>?
              This action cannot be undone.
            </p>

            <div className="recipients-modal-footer">
              <button
                type="button"
                className="recipients-cancel-btn"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="recipients-confirm-delete"
                onClick={confirmDelete}
              >
                Delete List
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}

function EmailSummary({ emails }) {
  if (!emails.length) {
    return <span className="recipients-no-email">—</span>
  }

  return (
    <div className="recipients-email-summary">
      {emails.length <= 2 ? (
        emails.map((email) => (
          <span className="recipients-email-chip" key={email}>
            {email}
          </span>
        ))
      ) : (
        <>
          <span className="recipients-email-chip">{emails[0]}</span>
          <span className="recipients-more-chip">
            +{emails.length - 1} more
          </span>
        </>
      )}
    </div>
  )
}

function EmailField({
  label,
  required = false,
  field,
  values,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  onKeyDown,
}) {
  return (
    <div className="recipients-field">
      <span>
        {label} {required && <b>*</b>}
        {!required && <small> (Optional)</small>}
      </span>

      <div className="recipients-email-input-row">
        <input
          type="text"
          placeholder="Enter email address..."
          value={inputValue}
          onChange={(event) => onInputChange(field, event.target.value)}
          onKeyDown={(event) => onKeyDown(event, field)}
          aria-label={label}
        />

        <button
          type="button"
          className="recipients-add-email-btn"
          onClick={() => onAdd(field)}
        >
          + Add
        </button>
      </div>

      <div className="recipients-email-chips">
        {values.map((email, index) => (
          <span className="recipients-form-chip" key={`${email}-${index}`}>
            {email}
            <button
              type="button"
              onClick={() => onRemove(field, index)}
              aria-label={`Remove ${email}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
