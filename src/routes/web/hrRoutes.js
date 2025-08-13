const express = require('express');
const router = express.Router();

const { schoolAuth, requireRole } = require('../../middleware/auth');
const hrController = require('../../controllers/web/hrController');

router.use(schoolAuth);
router.use(requireRole(['hr']));

router.get('/dashboard', hrController.getDashboard);
router.get('/staff/overview', hrController.getStaffOverview);
router.get('/recruitment/pending', hrController.getPendingRecruitment);
router.post('/recruitment/:id/approve', hrController.approveRecruitment);
router.post('/recruitment/:id/reject', hrController.rejectRecruitment);

module.exports = router;


