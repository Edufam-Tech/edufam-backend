const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const SupportController = require('../../controllers/admin/supportController');

// Admin Support Tickets Routes
router.use(authenticate);

// List tickets
router.get('/tickets', requireRole(['super_admin', 'support_hr', 'edufam_admin']), SupportController.listTickets);

// Get ticket by id
router.get('/tickets/:id', requireRole(['super_admin', 'support_hr', 'edufam_admin']), SupportController.getTicket);

// Create ticket
router.post('/tickets', requireRole(['super_admin', 'support_hr', 'edufam_admin']), SupportController.createTicket);

// Update status
router.put('/tickets/:id/status', requireRole(['super_admin', 'support_hr', 'edufam_admin']), SupportController.updateStatus);

// Assign ticket
router.put('/tickets/:id/assign', requireRole(['super_admin', 'support_hr', 'edufam_admin']), SupportController.assignTicket);

module.exports = router;


