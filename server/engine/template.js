// Fills {{placeholders}} in a subject or body with values from one row (FR-11, FR-12).
// render(text, row) -> { text, missing }. Never throws: a bad or missing placeholder is left empty.
const Handlebars = require('handlebars');

// Top-level {{Name}} placeholders used in the text.
function placeholders(text) {
  return [...new Set([...String(text).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
}

function render(text, row = {}) {
  const source = text == null ? '' : String(text);
  const missing = placeholders(source).filter((name) => row[name] === undefined || row[name] === null || row[name] === '');
  try {
    // noEscape: values are plain text in our emails; strict off so missing keys become ''.
    return { text: Handlebars.compile(source, { noEscape: true })(row), missing };
  } catch {
    // Broken syntax like "{{#if" - send the text unfilled rather than crash the run.
    return { text: source, missing };
  }
}

module.exports = { render, placeholders };
