// Uses the shared `templates` collection (name, subject, body) from the Common Guide
const { Template, Job } = require("../models");
const { render } = require("../engine/template");

const DUPLICATE_NAME = 11000; // MongoDB duplicate key error (name is unique)

// Create template
exports.createTemplate = async (req, res) => {
  try {
    const { name, subject, body } = req.body;

    if (!name?.trim() || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const template = await Template.create({
      name: name.trim(),
      subject: subject.trim(),
      body,
    });

    res.status(201).json({
      message: "Template created successfully",
      template,
    });
  } catch (error) {
    if (error.code === DUPLICATE_NAME) {
      return res.status(409).json({ message: "A template with this name already exists" });
    }
    res.status(500).json({
      message: "Error creating template",
      error: error.message,
    });
  }
};

// Get template
exports.getTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        message: "Template not found",
      });
    }

    res.status(200).json({
      message: "Template retrieved successfully",
      template,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving template",
      error: error.message,
    });
  }
};

// Update template
exports.updateTemplate = async (req, res) => {
  try {
    const { name, subject, body } = req.body;

    if (
      typeof name !== "string" ||
      typeof subject !== "string" ||
      typeof body !== "string" ||
      !name.trim() ||
      !subject.trim() ||
      !body.trim()
    ) {
      return res.status(400).json({
        message: "Template name, subject, and body are required",
      });
    }

    const template = await Template.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        subject,
        body,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!template) {
      return res.status(404).json({
        message: "Template not found",
      });
    }

    res.status(200).json({
      message: "Template updated successfully",
      template,
    });
  } catch (error) {
    if (error.code === DUPLICATE_NAME) {
      return res.status(409).json({ message: "A template with this name already exists" });
    }
    res.status(500).json({
      message: "Error updating template",
      error: error.message,
    });
  }
};

// Preview template: POST /api/templates/preview { subject, body, row } (FR-12)
exports.previewTemplate = async (req, res) => {
  const { subject, body, row } = req.body || {};

  if (typeof subject !== "string" || typeof body !== "string") {
    return res.status(400).json({ message: "Subject and body are required" });
  }

  const filledSubject = render(subject, row || {});
  const filledBody = render(body, row || {});

  res.status(200).json({
    preview: { subject: filledSubject.text, body: filledBody.text },
    missing: [...new Set([...filledSubject.missing, ...filledBody.missing])],
  });
};

// Delete template. Refused while a job still uses it.
exports.deleteTemplate = async (req, res) => {
  try {
    const inUse = await Job.findOne({ templateId: req.params.id }, "name");
    if (inUse) {
      return res.status(409).json({ message: `Template is used by job "${inUse.name}"` });
    }
    const template = await Template.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    res.status(200).json({ message: "Template deleted" });
  } catch (error) {
    res.status(error.name === "CastError" ? 400 : 500).json({ message: "Error deleting template" });
  }
};

// List templates (used by the template dropdown)
exports.listTemplates = async (req, res) => {
  try {
    const templates = await Template.find().sort({ updatedAt: -1 });
    res.status(200).json({ templates });
  } catch (error) {
    res.status(500).json({
      message: "Error loading templates",
      error: error.message,
    });
  }
};
