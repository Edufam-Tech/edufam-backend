const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// Import controllers
const AssessmentController = require('../controllers/assessmentController');
const GradeController = require('../controllers/gradeController');
const AttendanceController = require('../controllers/attendanceController');

// Assessment Routes
router.post('/assessments', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AssessmentController.createAssessment
);

router.get('/assessments', 
  authenticate, 
  AssessmentController.getAssessments
);

router.get('/assessments/:id', 
  authenticate, 
  AssessmentController.getAssessment
);

router.put('/assessments/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AssessmentController.updateAssessment
);

router.delete('/assessments/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AssessmentController.deleteAssessment
);

router.patch('/assessments/:id/status', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AssessmentController.changeStatus
);

router.get('/assessments/:id/statistics', 
  authenticate, 
  AssessmentController.getAssessmentStatistics
);

router.get('/classes/:classId/assessments', 
  authenticate, 
  AssessmentController.getClassAssessments
);

router.get('/assessments/date-range', 
  authenticate, 
  AssessmentController.getAssessmentsByDateRange
);

router.post('/assessments/bulk', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AssessmentController.bulkCreateAssessments
);

router.get('/assessments/dashboard', 
  authenticate, 
  AssessmentController.getAssessmentDashboard
);

router.get('/assessments/export', 
  authenticate, 
  AssessmentController.exportAssessments
);

router.post('/assessments/validate', 
  authenticate, 
  AssessmentController.validateAssessment
);

// Grade Routes
router.post('/grades/entry', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  GradeController.enterGrade
);

router.get('/grades/:assessmentId', 
  authenticate, 
  GradeController.getGrades
);

router.put('/grades/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  GradeController.updateGrade
);

router.post('/grades/bulk-entry', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  GradeController.bulkEnterGrades
);

router.post('/grades/submit-approval', 
  authenticate, 
  requireRole(['teacher']), 
  GradeController.submitForApproval
);

router.get('/grades/pending-approval', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  GradeController.getPendingApproval
);

router.post('/grades/approve', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  GradeController.approveGrades
);

router.post('/grades/reject', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  GradeController.rejectGrades
);

router.get('/grades/approval-history', 
  authenticate, 
  GradeController.getApprovalHistory
);

router.get('/students/:studentId/grades', 
  authenticate, 
  GradeController.getStudentGrades
);

router.get('/grades/statistics/:studentId', 
  authenticate, 
  GradeController.getStudentStatistics
);

// Enhanced Grade Management Routes
router.put('/grades/:gradeId/override', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  GradeController.overrideGrade
);

router.post('/grades/bulk-approve', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  GradeController.bulkApproveGrades
);

router.put('/grades/release-to-parents', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  GradeController.releaseGradesToParents
);

router.get('/grades/curriculum-standards', 
  authenticate, 
  GradeController.getCurriculumStandards
);

// Grade Analytics Enhancement
router.get('/grades/analytics/performance', 
  authenticate, 
  GradeController.getPerformanceAnalytics
);

router.get('/grades/analytics/trends', 
  authenticate, 
  GradeController.getGradeTrends
);

router.get('/grades/analytics/curriculum-comparison', 
  authenticate, 
  GradeController.getCurriculumComparison
);

// Attendance Routes
router.post('/attendance/mark', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.markAttendance
);

router.get('/attendance/:date/:classId', 
  authenticate, 
  AttendanceController.getAttendance
);

router.put('/attendance/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.updateAttendance
);

router.post('/attendance/bulk-mark', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.bulkMarkAttendance
);

router.get('/attendance/student/:id', 
  authenticate, 
  AttendanceController.getStudentHistory
);

router.get('/attendance/class/:id/summary', 
  authenticate, 
  AttendanceController.getClassSummary
);

router.get('/attendance/reports', 
  authenticate, 
  AttendanceController.getAttendanceReports
);

router.post('/attendance/notify-absent', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.notifyAbsentStudents
);

router.get('/attendance/registers', 
  authenticate, 
  AttendanceController.getAttendanceRegisters
);

router.post('/attendance/registers', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.createAttendanceRegister
);

router.get('/attendance/reasons', 
  authenticate, 
  AttendanceController.getAttendanceReasons
);

router.post('/attendance/reasons', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  AttendanceController.createAttendanceReason
);

router.get('/attendance/settings', 
  authenticate, 
  AttendanceController.getAttendanceSettings
);

router.put('/attendance/settings', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  AttendanceController.updateAttendanceSettings
);

// Staff Attendance Routes
router.get('/attendance/staff', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director']), 
  AttendanceController.getStaffAttendance
);

router.post('/attendance/staff/clock-in', 
  authenticate, 
  AttendanceController.clockInStaff
);

router.post('/attendance/staff/clock-out', 
  authenticate, 
  AttendanceController.clockOutStaff
);

router.get('/attendance/staff/:staffId/history', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director']), 
  AttendanceController.getStaffAttendanceHistory
);

// Attendance Analytics Enhancement
router.get('/attendance/analytics/patterns', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director']), 
  AttendanceController.getAttendancePatterns
);

router.get('/attendance/analytics/chronic-absenteeism', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director']), 
  AttendanceController.getChronicAbsenteeism
);

router.get('/attendance/analytics/staff-punctuality', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director']), 
  AttendanceController.getStaffPunctuality
);

// Grading Scales Routes
router.get('/grading-scales/:curriculumType', 
  authenticate, 
  GradeController.getGradingScales
);

router.put('/grading-scales/:id', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  GradeController.updateGradingScales
);

router.post('/grade-boundaries', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  GradeController.setGradeBoundaries
);

// Academic Analytics Routes
router.get('/academic/analytics', 
  authenticate, 
  GradeController.getAcademicAnalytics
);

router.get('/academic/performance-trends', 
  authenticate, 
  GradeController.getPerformanceTrends
);

router.get('/academic/class-performance', 
  authenticate, 
  GradeController.getClassPerformance
);

router.get('/academic/student-progress', 
  authenticate, 
  GradeController.getStudentProgress
);

// Make-up Classes Routes
router.post('/make-up-classes', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.createMakeUpClass
);

router.get('/make-up-classes', 
  authenticate, 
  AttendanceController.getMakeUpClasses
);

router.put('/make-up-classes/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.updateMakeUpClass
);

router.delete('/make-up-classes/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.deleteMakeUpClass
);

// Remedial Sessions Routes
router.post('/remedial-sessions', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.createRemedialSession
);

router.get('/remedial-sessions', 
  authenticate, 
  AttendanceController.getRemedialSessions
);

router.put('/remedial-sessions/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.updateRemedialSession
);

router.delete('/remedial-sessions/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director']), 
  AttendanceController.deleteRemedialSession
);

// Grade Categories Routes
router.get('/grade-categories', 
  authenticate, 
  AssessmentController.getGradeCategories
);

router.post('/grade-categories', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  AssessmentController.createGradeCategory
);

router.put('/grade-categories/:id', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  AssessmentController.updateGradeCategory
);

router.delete('/grade-categories/:id', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  AssessmentController.deleteGradeCategory
);

// Export and Report Routes
router.get('/reports/grade-report/:studentId', 
  authenticate, 
  GradeController.generateGradeReport
);

router.get('/reports/attendance-report/:studentId', 
  authenticate, 
  AttendanceController.generateAttendanceReport
);

router.get('/reports/class-performance-report/:classId', 
  authenticate, 
  GradeController.generateClassPerformanceReport
);

router.get('/reports/academic-summary/:academicYearId', 
  authenticate, 
  GradeController.generateAcademicSummary
);

module.exports = router; 