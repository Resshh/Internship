import { useEffect, useState } from 'react'
import { api } from '../api.js'

const emptyList = { name: '', emails: [], cc: [], bcc: [] }

export default function Recipients() {
  const [lists, setLists] = useState([])
  const [drafts, setDrafts] = useState({})
  const [entries, setEntries] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadLists() {
    setError('')
    setLoading(true)

    try {
      const data = await api('/recipient-lists')
      if (!Array.isArray(data.lists)) {
        throw new Error('The recipient-list API response must contain a lists array.')
      }

      setLists(data.lists)
      setDrafts(Object.fromEntries(data.lists.map((list) => [list._id, {
        name: list.name,
        emails: list.emails || [],
        cc: list.cc || [],
        bcc: list.bcc || [],
      }])))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLists()
  }, [])

  function updateDraft(id, field, value) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }))
  }

  function updateEntry(id, field, value) {
    setEntries((current) => ({
      ...current,
      [id]: { email: '', type: 'emails', ...current[id], [field]: value },
    }))
  }

  async function createList() {
    const name = window.prompt('Enter a name for the new recipient list:')
    if (name === null) return

    if (!name.trim()) {
      setError('List name is required.')
      return
    }

    setError('')
    setMessage('')

    try {
      const data = await api('/recipient-lists', {
        method: 'POST',
        body: { ...emptyList, name: name.trim() },
      })

      await loadLists()
      const newList = data.list
      if (newList?._id) setExpandedId(newList._id)
      setMessage('Recipient list created.')
    } catch (err) {
      setError(err.message)
    }
  }

  function addAddress(event, id) {
    event.preventDefault()
    const entry = entries[id] || { email: '', type: 'emails' }
    const email = entry.email.trim()

    if (!email) return

    const draft = drafts[id]
    updateDraft(id, entry.type, [...draft[entry.type], email])
    updateEntry(id, 'email', '')
  }

  function removeAddress(id, field, index) {
    const values = drafts[id][field].filter((_, itemIndex) => itemIndex !== index)
    updateDraft(id, field, values)
  }

  function changeAddressType(id, oldField, index, newField) {
    const email = drafts[id][oldField][index]
    const updatedOld = drafts[id][oldField].filter((_, itemIndex) => itemIndex !== index)

    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [oldField]: updatedOld,
        [newField]: [...current[id][newField], email],
      },
    }))
  }

  async function saveList(id) {
    setError('')
    setMessage('')

    try {
      await api(`/recipient-lists/${id}`, {
        method: 'PUT',
        body: drafts[id],
      })
      await loadLists()
      setMessage('Changes saved.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteList(list) {
    if (!window.confirm(`Delete "${list.name}"? This cannot be undone.`)) return

    setError('')
    setMessage('')

    try {
      await api(`/recipient-lists/${list._id}`, { method: 'DELETE' })
      await loadLists()
      setMessage('Recipient list deleted.')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p>Loading recipient lists...</p>

  return (
    <section className="recipients-page">
      <div className="recipients-heading">
        <h2>Recipient lists</h2>
        <button type="button" onClick={createList}>+ New list</button>
      </div>

      {error && <p className="recipients-message recipients-error" role="alert">{error}</p>}
      {message && <p className="recipients-message recipients-success" role="status">{message}</p>}

      {lists.length === 0 ? (
        <p>No recipient lists yet. Select “New list” to create one.</p>
      ) : (
        <div className="recipients-table-wrap">
          <table className="recipients-table">
            <thead>
              <tr>
                <th aria-label="Expand list"></th>
                <th>List name</th>
                <th>To</th>
                <th>CC</th>
                <th>BCC</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => {
                const draft = drafts[list._id]
                const expanded = expandedId === list._id

                return (
                  <FragmentRow
                    key={list._id}
                    list={list}
                    draft={draft}
                    expanded={expanded}
                    entry={entries[list._id] || { email: '', type: 'emails' }}
                    onToggle={() => setExpandedId(expanded ? null : list._id)}
                    onDelete={() => deleteList(list)}
                    onNameChange={(value) => updateDraft(list._id, 'name', value)}
                    onEntryChange={(field, value) => updateEntry(list._id, field, value)}
                    onAdd={(event) => addAddress(event, list._id)}
                    onRemove={(field, index) => removeAddress(list._id, field, index)}
                    onTypeChange={(oldField, index, newField) =>
                      changeAddressType(list._id, oldField, index, newField)}
                    onSave={() => saveList(list._id)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function FragmentRow({
  list,
  draft,
  expanded,
  entry,
  onToggle,
  onDelete,
  onNameChange,
  onEntryChange,
  onAdd,
  onRemove,
  onTypeChange,
  onSave,
}) {
  return (
    <>
      <tr>
        <td>
          <button
            className="recipients-expand"
            type="button"
            aria-label={expanded ? 'Collapse list' : 'Expand list'}
            onClick={onToggle}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </td>
        <td>{list.name}</td>
        <td>{list.emails?.length || 0}</td>
        <td>{list.cc?.length || 0}</td>
        <td>{list.bcc?.length || 0}</td>
        <td>
          <button className="recipients-secondary" type="button" onClick={onDelete}>
            Delete
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan="6">
            <div className="recipients-details">
              <form className="recipients-add-form" onSubmit={onAdd}>
                <input
                  aria-label={`Email address for ${list.name}`}
                  type="email"
                  required
                  placeholder="Add email address..."
                  value={entry.email}
                  onChange={(event) => onEntryChange('email', event.target.value)}
                />
                <select
                  aria-label="Recipient type"
                  value={entry.type}
                  onChange={(event) => onEntryChange('type', event.target.value)}
                >
                  <option value="emails">To</option>
                  <option value="cc">CC</option>
                  <option value="bcc">BCC</option>
                </select>
                <button type="submit">Add</button>
              </form>

              <table className="recipients-address-table">
                <thead>
                  <tr><th>Email</th><th>Type</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {[
                    ['emails', 'To'],
                    ['cc', 'CC'],
                    ['bcc', 'BCC'],
                  ].flatMap(([field, label]) =>
                    (draft[field] || []).map((email, index) => (
                      <tr key={`${field}-${index}-${email}`}>
                        <td>{email}</td>
                        <td>
                          <select
                            aria-label={`Type for ${email}`}
                            value={field}
                            onChange={(event) => onTypeChange(field, index, event.target.value)}
                          >
                            <option value="emails">To</option>
                            <option value="cc">CC</option>
                            <option value="bcc">BCC</option>
                          </select>
                        </td>
                        <td>
                          <button
                            className="recipients-secondary"
                            type="button"
                            onClick={() => onRemove(field, index)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>

              <button type="button" onClick={onSave}>Save changes</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}