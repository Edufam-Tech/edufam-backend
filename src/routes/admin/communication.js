const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/auth');
const AdminCommunicationController = require('../../controllers/admin/communicationController');

// Super Admin can broadcast announcements to any school
router.post(
  '/announcements',
  requireRole(['super_admin']),
  AdminCommunicationController.createAnnouncementForSchool
);

// View announcements for a given school
router.get(
  '/announcements',
  requireRole(['super_admin', 'regional_admin', 'support_admin']),
  AdminCommunicationController.getAnnouncementsForSchool
);

module.exports = router;


