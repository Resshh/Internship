const express = require("express");
const router = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/auth");

const {
  listTemplates,
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
} = require("../controller/templateController");

// Reads: any logged-in user (FR-01). Writes: admins only (FR-02).
router.get("/", requireAuth, listTemplates);
router.post("/preview", requireAuth, previewTemplate);
router.get("/:id", requireAuth, getTemplate);
router.post("/", requireAdmin, createTemplate);
router.put("/:id", requireAdmin, updateTemplate);
router.delete("/:id", requireAdmin, deleteTemplate);

module.exports = router;
