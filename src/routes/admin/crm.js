const express = require('express');
const router = express.Router();
const crmController = require('../../controllers/crmController');
const { authenticate, requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const { body, query, param } = require('express-validator');

router.use(authenticate);

// Create lead
router.post('/leads', [
  requireRole(['super_admin', 'edufam_admin', 'sales_marketing']),
  body('name').isString().trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('phone').optional().isString().trim(),
  body('source').optional().isString().trim(),
  body('status').optional().isIn(['new','contacted','qualified','won','lost']).withMessage('Invalid status'),
], validate, crmController.createLead);

// Get leads
router.get('/leads', [
  requireRole(['super_admin', 'edufam_admin', 'sales_marketing']),
  query('status').optional().isIn(['new','contacted','qualified','won','lost']).withMessage('Invalid status'),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('page').optional().isInt({ min: 1 }),
], validate, crmController.getLeads);

// Update lead status
router.put('/leads/:leadId/status', [
  requireRole(['super_admin', 'edufam_admin', 'sales_marketing']),
  param('leadId').isUUID().withMessage('Valid lead id required'),
  body('status').isIn(['new','contacted','qualified','won','lost']).withMessage('Invalid status')
], validate, crmController.updateLeadStatus);

// CRM analytics
router.get('/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'sales_marketing'])
], crmController.getAnalytics);

module.exports = router;


