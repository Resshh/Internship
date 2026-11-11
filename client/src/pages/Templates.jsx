
import { useState, useRef, useEffect } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

// Placeholders for report jobs (filled by the runner, not by query columns)
const reportPlaceholders = ["JobName", "Date", "RowCount"];

function TemplateEditor({ onSave }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [templateName, setTemplateName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Sample data: columns become placeholders, a chosen row fills the preview (FR-12)
  const [queries, setQueries] = useState([]);
  const [queryId, setQueryId] = useState("");
  const [sample, setSample] = useState({ columns: [], rows: [] });
  const [rowIndex, setRowIndex] = useState(0);
  const [preview, setPreview] = useState({ subject: "", body: "", missing: [] });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedTemplateId, setSavedTemplateId] = useState("");

  // ADDED: Template selection states
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isLoading, setIsLoading] = useState(true); // true: templates load on open

  const textareaRef = useRef(null);

  const displayedPlaceholders = [...sample.columns, ...reportPlaceholders];

  useEffect(() => {
    api("/queries")
      .then((data) => {
        setQueries(data.queries || []);
        if (data.queries?.length) setQueryId(data.queries[0]._id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!queryId) return;
    api(`/queries/${queryId}/sample`)
      .then((data) => {
        setSample({ columns: data.columns || [], rows: data.rows || [] });
        setRowIndex(0);
      })
      .catch(() => setSample({ columns: [], rows: [] }));
  }, [queryId]);

  // Server fills the placeholders, so the preview matches the real email exactly.
  useEffect(() => {
    const row = {
      JobName: templateName || "Job",
      Date: new Date().toLocaleDateString("en-CA"),
      RowCount: sample.rows.length,
      ...sample.rows[rowIndex],
    };
    const timer = setTimeout(() => {
      api("/templates/preview", { method: "POST", body: { subject, body, row } })
        .then((data) => setPreview({ ...data.preview, missing: data.missing || [] }))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [subject, body, rowIndex, sample, templateName]);

  // ADDED: Fetch saved templates
  // setState only inside callbacks, so it is safe to call from useEffect
  function fetchTemplates() {
    return api("/templates")
      .then((data) => setTemplates(data.templates || []))
      .catch((error) => console.error("Error loading templates:", error))
      .finally(() => setIsLoading(false));
  }

  // ADDED: Load templates when page opens
  useEffect(() => {
    fetchTemplates();
  }, []);

  // ADDED: Select an existing template
  function handleSelectTemplate(event) {
    const id = event.target.value;
    setSelectedTemplateId(id);
    setMessage("");

    const selectedTemplate = templates.find(
      (template) => template._id === id
    );

    if (selectedTemplate) {
      setTemplateName(selectedTemplate.name);
      setSubject(selectedTemplate.subject);
      setBody(selectedTemplate.body);
      setSavedTemplateId(selectedTemplate._id);
      setMessage("Template loaded successfully!");
    }
  }

  // ADDED: Create a new blank template
  function handleNewTemplate() {
    setSelectedTemplateId("");
    setTemplateName("");
    setSubject("");
    setBody("");
    setSavedTemplateId("");
    setMessage("");
  }

  // Insert placeholder at cursor position
  function insertPlaceholder(placeholder, start, end) {
    const textToInsert = `{{${placeholder}}}`;

    const updatedBody =
      body.slice(0, start) +
      textToInsert +
      body.slice(end);

    setBody(updatedBody);

    const newCursorPosition = start + textToInsert.length;

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();

        textareaRef.current.setSelectionRange(
          newCursorPosition,
          newCursorPosition
        );
      }
    });
  }

  // Click placeholder
  function handlePlaceholderClick(placeholder) {
    const textarea = textareaRef.current;

    const start = textarea
      ? textarea.selectionStart
      : body.length;

    const end = textarea
      ? textarea.selectionEnd
      : body.length;

    insertPlaceholder(placeholder, start, end);
  }

  // Start dragging
  function handleDragStart(event, placeholder) {
    event.dataTransfer.setData("text/plain", placeholder);
    event.dataTransfer.effectAllowed = "copy";
  }

  // Drag over body
  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }

  // Drag leave
  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragOver(false);
    }
  }

  // Calculate drop position
  function getDropPosition(event, textarea) {
    const rect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    context.font = style.font;

    const lineHeight = parseFloat(style.lineHeight);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingTop = parseFloat(style.paddingTop);

    const lines = body.split("\n");

    const mouseY =
      event.clientY -
      rect.top -
      paddingTop +
      textarea.scrollTop;

    const lineIndex = Math.max(
      0,
      Math.min(
        lines.length - 1,
        Math.floor(mouseY / lineHeight)
      )
    );

    const line = lines[lineIndex];

    const targetX =
      event.clientX -
      rect.left -
      paddingLeft +
      textarea.scrollLeft;

    let characterPosition = 0;
    let currentWidth = 0;

    for (let i = 0; i < line.length; i++) {
      const characterWidth = context.measureText(line[i]).width;

      if (currentWidth + characterWidth / 2 > targetX) {
        break;
      }

      currentWidth += characterWidth;
      characterPosition++;
    }

    return (
      lines
        .slice(0, lineIndex)
        .reduce(
          (total, currentLine) =>
            total + currentLine.length + 1,
          0
        ) + characterPosition
    );
  }

  // Drop placeholder
  function handleDrop(event) {
    event.preventDefault();
    setIsDragOver(false);

    const placeholder = event.dataTransfer.getData("text/plain");

    if (!displayedPlaceholders.includes(placeholder)) {
      return;
    }

    const textarea = textareaRef.current;

    if (!textarea) return;

    const dropPosition = getDropPosition(event, textarea);

    insertPlaceholder(
      placeholder,
      dropPosition,
      dropPosition
    );
  }

  // SAVE TEMPLATE TO BACKEND
  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await api(`/templates/${savedTemplateId}`, { method: "DELETE" });
      handleNewTemplate();
      setMessage("Template deleted.");
      fetchTemplates();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleSave() {
    if (
      !templateName.trim() ||
      !subject.trim() ||
      !body.trim()
    ) {
      setMessage("Please fill in all fields.");
      return;
    }

    try {
      setIsSaving(true);
      setMessage("");

      const updatedTemplate = {
        name: templateName.trim(),
        subject,
        body,
      };

      // Selected template: update it. Otherwise create a new one.
      const data = await api(savedTemplateId ? `/templates/${savedTemplateId}` : "/templates", {
        method: savedTemplateId ? "PUT" : "POST",
        body: updatedTemplate,
      });

      setMessage("Template saved successfully!");
      setSavedTemplateId(data.template._id);
      setSelectedTemplateId(data.template._id);

      if (onSave) {
        onSave(data.template);
      }

      // ADDED: Refresh saved templates after saving
      fetchTemplates();

    } catch (error) {
      console.error("Save error:", error);
      setMessage(error.message || "Backend connection failed.");
    } finally {
      setIsSaving(false);
    }
  }


  return (
    <div className="template-page">

      <main className="template-container">

        {/* Heading, Select Template, New and Save */}
        <div className="template-heading">
          <h1>Edit template</h1>

          <div className="template-actions">

            {/* ADDED: Select Template */}
            <select
              className="template-select"
              value={selectedTemplateId}
              onChange={handleSelectTemplate}
              disabled={isLoading}
            >
              <option value="">
                {isLoading ? "Loading..." : "Select Template"}
              </option>

              {templates.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name}
                </option>
              ))}
            </select>

            {isAdmin && (
              <>
                <button
                  type="button"
                  className="new-template-button"
                  onClick={handleNewTemplate}
                >
                  + New
                </button>

                {savedTemplateId && (
                  <button
                    type="button"
                    className="new-template-button"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </button>
                )}

                <button
                  className="save-button"
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </>
            )}

          </div>
        </div>

        {/* Save status */}
        {message && (
          <div
            style={{
              marginBottom: "15px",
              color: savedTemplateId ? "#397044" : "#A04435",
              fontWeight: "600",
            }}
          >
            {message}
          </div>
        )}

        {savedTemplateId && (
          <p style={{ fontSize: "13px", color: "#80664E" }}>
            Template ID: {savedTemplateId}
          </p>
        )}

        {/* Editor and placeholders */}
        <section className="editor-layout">

          {/* Left side */}
          <div className="editor-left">

            <div className="form-group">
              <label htmlFor="templateName">
                Template name
              </label>

              <input
                id="templateName"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="emailSubject">
                Subject
              </label>

              <input
                id="emailSubject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
              />
            </div>

            <div className="form-group body-group">
              <label htmlFor="emailBody">
                Body
              </label>

              <textarea
                ref={textareaRef}
                id="emailBody"
                className={isDragOver ? "drag-over" : ""}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                placeholder="Write your email body here..."
              />
            </div>

          </div>

          {/* Right side */}
          <aside className="placeholder-panel">

            <h2>PLACEHOLDERS</h2>

            <p>Drag and drop into the Body</p>

            <div className="placeholder-list">
              {displayedPlaceholders.map((placeholder) => (
                <button
                  key={placeholder}
                  type="button"
                  draggable="true"
                  className="placeholder-item"
                  onClick={() => handlePlaceholderClick(placeholder)}
                  onDragStart={(event) =>
                    handleDragStart(event, placeholder)
                  }
                  title="Drag this placeholder into the Body"
                >
                  {`{{${placeholder}}}`}
                </button>
              ))}
            </div>

          </aside>

        </section>

        {/* Preview */}
        <section className="preview-panel">

          <div className="preview-heading">
            <h2>PREVIEW</h2>
            <select
              className="template-select"
              aria-label="Sample data"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
            >
              {queries.map((q) => (
                <option key={q._id} value={q._id}>{q.name}</option>
              ))}
            </select>
            <select
              className="template-select"
              aria-label="Sample row"
              value={rowIndex}
              onChange={(e) => setRowIndex(Number(e.target.value))}
            >
              {sample.rows.map((row, i) => (
                <option key={i} value={i}>Row {i + 1}: {String(Object.values(row)[0])}</option>
              ))}
            </select>
          </div>

          <div className="preview-content">

            <div className="preview-subject">
              <strong>Subject:</strong>
              <p>{preview.subject}</p>
            </div>

            <div className="preview-body">
              <strong>Body:</strong>
              <pre>{preview.body}</pre>
            </div>

            {preview.missing.map((name) => (
              <p key={name} className="notice notice-error">
                Placeholder {`{{${name}}}`} has no value
              </p>
            ))}

            <p className="preview-note">
              Filled with the selected sample row. Report jobs also get {"{{JobName}}"}, {"{{Date}}"} and {"{{RowCount}}"}.
            </p>

          </div>
        </section>

      </main>

      {confirmDelete && (
        <div className="dialog-overlay">
          <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="template-delete-title">
            <h2 id="template-delete-title">Delete template?</h2>
            <p>Delete <strong>{templateName}</strong>? This cannot be undone.</p>
            <div className="dialog-actions">
              <button type="button" className="cancel-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" className="confirm-delete-button" onClick={handleDelete}>Delete</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default TemplateEditor;
