const express = require('express');
const router = express.Router();

const { schoolAuth, requireRole } = require('../../middleware/auth');

// Placeholder controller object with minimal handlers to avoid 404s
const principalController = require('../../controllers/web/principalController');

router.use(schoolAuth);
router.use(requireRole(['principal']));

router.get('/dashboard', principalController.getDashboard);
router.get('/grades/pending', principalController.getPendingGrades);
router.get('/grading-sheet/:classId', principalController.getClassGradingSheet);
router.post('/grades/:submissionId/approve', principalController.approveGrade);
router.post('/grades/:submissionId/reject', principalController.rejectGrade);
router.get('/attendance/overview', principalController.getAttendanceOverview);
router.get('/announcements', principalController.getAnnouncements);

module.exports = router;


