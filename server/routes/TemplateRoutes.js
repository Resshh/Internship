const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");

const {
  listTemplates,
  createTemplate,
  getTemplate,
  updateTemplate,
  previewTemplate,
} = require("../controller/templateController");

// All template routes need a logged-in user (FR-01)
router.use(requireAuth);

router.get("/", listTemplates);
router.post("/", createTemplate);
router.get("/:id", getTemplate);
router.put("/:id", updateTemplate);
router.post("/:id/preview", previewTemplate);

module.exports = router;
