// backend/routes/examinationRoutes.js
// Phase 2 – Examination routes (CRUD lite)

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requireExaminationScope, createRequireExaminationCreateScope } = require('../middleware/scopeMiddleware');

const {
  listExaminations,
  getExaminationById,
  createExamination,
  listExaminationsByWarga,
} = require('../controllers/examinationController');

// 1. GET /api/examinations – list (kader & puskesmas)
router.get('/', requireAuth, requireRole(['kader', 'puskesmas']), listExaminations);

// 2. GET /api/examinations/:id – single (scoped)
router.get('/:id', requireAuth, requireExaminationScope, getExaminationById);

// 3. POST /api/examinations – create (kader only, with create‑scope middleware)
router.post(
  '/',
  requireAuth,
  requireRole(['kader']),
  createRequireExaminationCreateScope(),
  createExamination
);

// -------------------------------------------------------------------
// Endpoint for warga examination history (nested under warga router)
// The route should be mounted as:
//   router.get('/:id/examinations', requireAuth, requireWargaScope, listExaminationsByWarga);
// It is **not** exported here to avoid duplicate URL definitions.
// -------------------------------------------------------------------

module.exports = router;
