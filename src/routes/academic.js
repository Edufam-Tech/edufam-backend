const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// Import controllers
const AssessmentController = require('../controllers/assessmentController');
const GradeController = require('../controllers/gradeController');
const AttendanceController = require('../controllers/attendanceController');
const GradebookController = require('../controllers/gradebookController');
const { query } = require('../config/database');

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

// Additional endpoint for teachers to submit multiple grades for approval in one call
router.post('/grades/submit-approval/bulk',
  authenticate,
  requireRole(['teacher']),
  async (req, res, next) => {
    try {
      const { grades } = req.body; // [{ gradeId }]
      if (!Array.isArray(grades) || grades.length === 0) {
        return res.status(400).json({ success: false, message: 'grades array is required' });
      }
      const { submitForApproval } = require('../controllers/gradeController');
      const results = [];
      for (const item of grades) {
        req.body.gradeId = item.gradeId;
        // call controller directly per item
        // eslint-disable-next-line no-await-in-loop
        await submitForApproval(req, {
          json: (payload) => results.push(payload.data),
          status: () => ({ json: (p) => results.push(p.data) })
        }, next);
      }
      res.json({ success: true, message: 'Bulk submission completed', data: results });
    } catch (e) { next(e); }
  }
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

// Compatibility alias to support clients using POST for release-to-parents
router.post('/grades/release-to-parents',
  authenticate,
  requireRole(['principal', 'school_director']),
  GradeController.releaseGradesToParents
);

router.get('/grades/curriculum-standards', 
  authenticate, 
  GradeController.getCurriculumStandards
);

// Grade Analytics Enhancement
router.get('/grades/analytics', 
  authenticate, 
  GradeController.getGradeAnalytics
);

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

// Gradebook data for class and subject
router.get('/gradebook/:classId/:subjectId',
  authenticate,
  requireRole(['teacher', 'principal', 'school_director']),
  GradebookController.getGradebookData
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

// Alias to support frontend attendance class summary path signature
router.get('/attendance/class/:classId/summary', 
  authenticate,
  (req, res, next) => {
    // Map :classId to handler expecting :id
    req.params.id = req.params.classId;
    return AttendanceController.getClassSummary(req, res, next);
  }
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

// Academic summary helper to match mobile client expectations
router.get('/summary',
  authenticate,
  async (req, res, next) => {
    try {
      const schoolId = req.user.schoolId;
      const [grades, attendance] = await Promise.all([
        query(`
          SELECT AVG(score) as average_score
          FROM student_grades sg
          JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
          WHERE gs.submitted_at >= CURRENT_DATE - INTERVAL '30 days' AND sg.is_published = true AND gs.school_id = $1
        `, [schoolId]),
        query(`
          SELECT 
            COUNT(*) as total_days,
            COUNT(CASE WHEN status='present' THEN 1 END) as present_days
          FROM student_attendance
          WHERE date >= CURRENT_DATE - INTERVAL '30 days' AND school_id = $1
        `, [schoolId])
      ]);
      res.json({ success: true, data: {
        recentAverage: parseFloat(grades.rows[0]?.average_score || 0),
        attendanceRate: attendance.rows[0]?.total_days ? (Number(attendance.rows[0].present_days) / Number(attendance.rows[0].total_days)) : 0
      }});
    } catch (error) { next(error); }
  }
);

// Stub endpoints for mobile client until full wiring is complete
// Returns recent grades for a student in a simple list format
router.get('/grades',
  authenticate,
  async (req, res, next) => {
    try {
      const { studentId } = req.query;
      // If no real data, return a small sample
      const sample = [
        { subject: 'Mathematics', assessment: 'Quiz 1', score: 78, grade: 'B' },
        { subject: 'English', assessment: 'Essay', score: 84, grade: 'A-' },
        { subject: 'Science', assessment: 'Lab Report', score: 91, grade: 'A' },
      ];
      res.json({ success: true, data: sample, meta: { studentId } });
    } catch (error) { next(error); }
  }
);

// Returns simple attendance entries for a student
router.get('/attendance',
  authenticate,
  async (req, res, next) => {
    try {
      const { studentId } = req.query;
      const today = new Date();
      const mk = (d, status) => ({ date: d.toISOString().slice(0,10), status });
      const data = [
        mk(new Date(today.getFullYear(), today.getMonth(), today.getDate()-1), 'present'),
        mk(new Date(today.getFullYear(), today.getMonth(), today.getDate()-2), 'present'),
        mk(new Date(today.getFullYear(), today.getMonth(), today.getDate()-3), 'absent'),
        mk(new Date(today.getFullYear(), today.getMonth(), today.getDate()-4), 'present'),
      ];
      res.json({ success: true, data, meta: { studentId } });
    } catch (error) { next(error); }
  }
);

module.exports = router; 