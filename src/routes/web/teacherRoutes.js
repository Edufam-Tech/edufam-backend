const express = require('express');
const router = express.Router();

const { schoolAuth, requireRole } = require('../../middleware/auth');
const teacherController = require('../../controllers/web/teacherController');

router.use(schoolAuth);
router.use(requireRole(['teacher', 'head_teacher']));

router.get('/dashboard', teacherController.getDashboard);
router.get('/classes', teacherController.getMyClasses);
router.get('/classes/:classId/subjects', teacherController.getClassSubjects);
router.get('/gradebook/:classId/:subjectId', teacherController.getClassGradebook);
router.get('/grading-sheet/:classId', teacherController.getClassGradingSheet);
router.post('/gradebook/:classId/save', teacherController.saveGrades);
router.post('/gradebook/:classId/submit', teacherController.submitGrades);
router.get('/attendance/:classId/summary', teacherController.getAttendanceSummary);

module.exports = router;


