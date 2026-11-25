// backend/routes/wargaRoutes.js
// Routes for Warga resource – Phase 1
// Middleware chain: requireAuth -> requireRole (kader for write, puskesmas/kader for read) -> (optional) requireWargaScope -> controller

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requireWargaScope } = require('../middleware/scopeMiddleware');

const {
  listWarga,
  getWargaById,
  createWarga,
  updateWarga,
  deleteWarga,
} = require('../controllers/wargaController');

// Import examination history handler
const { listExaminationsByWarga } = require('../controllers/examinationController');


// List warga – accessible by kader and puskesmas
router.get('/', requireAuth, requireRole(['kader', 'puskesmas']), listWarga);

// Examination history for a warga (nested route)
router.get('/:id/examinations',
  requireAuth,
  requireRole(['warga', 'kader', 'puskesmas']),
  requireWargaScope,
  listExaminationsByWarga);

// Get single warga – any authenticated role, but scope validation ensures ownership
router.get('/:id', requireAuth, requireRole(['warga', 'kader', 'puskesmas']), requireWargaScope, getWargaById);

// Create warga – only kader may create
router.post('/', requireAuth, requireRole('kader'), createWarga);

// Update warga – only kader, with scope check
router.put('/:id', requireAuth, requireRole('kader'), requireWargaScope, updateWarga);

// Delete warga – only kader, with scope check
router.delete('/:id', requireAuth, requireRole('kader'), requireWargaScope, deleteWarga);

module.exports = router;
