const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// Import controllers
const HRController = require('../controllers/hrController');
const { SCHOOL_DASHBOARD_ROLES } = require('../auth/roleDefinitions');

// Employee Management Routes
router.post('/employees', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createEmployee
);

router.get('/employees', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getEmployees
);

router.get('/employees/:id', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getEmployee
);

router.put('/employees/:id', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.updateEmployee
);

// Enhanced Staff Management Routes
router.get('/staff/all-categories', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getAllStaffCategories
);

// Dashboard users among staff (teachers, hr, finance, principal, director)
router.get('/staff/dashboard-users',
  authenticate,
  requireRole(['hr', 'principal', 'school_director', 'admin']),
  HRController.getDashboardUsers
);

// Promote an existing staff member to a dashboard user role
router.post('/staff/:employeeId/create-user',
  authenticate,
  requireRole(['hr', 'principal', 'school_director', 'admin']),
  HRController.createDashboardUserForStaff
);

// Aliases to match frontend API map
router.get('/staff/teaching', authenticate, requireRole(['hr','principal','school_director','admin']), HRController.getEmployees);
router.get('/staff/administrative', authenticate, requireRole(['hr','principal','school_director','admin']), HRController.getEmployees);
router.get('/staff/support', authenticate, requireRole(['hr','principal','school_director','admin']), HRController.getEmployees);
router.get('/staff/specialized', authenticate, requireRole(['hr','principal','school_director','admin']), HRController.getEmployees);

router.post('/staff/teaching', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createTeachingStaff
);

router.post('/staff/administrative', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createAdministrativeStaff
);

router.post('/staff/support', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createSupportStaff
);

router.post('/staff/specialized', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createSpecializedStaff
);

router.get('/staff/non-dashboard-users', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getNonDashboardUsers
);

router.post('/staff/non-dashboard-users', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createNonDashboardUser
);

router.put('/staff/:staffId/category', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.updateStaffCategory
);

router.get('/staff/organizational-chart', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getOrganizationalChart
);

router.get('/staff/directory', 
  authenticate, 
  HRController.getStaffDirectory
);

router.post('/staff/bulk-import', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.bulkImportStaff
);

// Parents management
router.get('/parents',
  authenticate,
  requireRole(['hr', 'principal', 'school_director', 'admin']),
  HRController.getParents
);

router.post('/parents',
  authenticate,
  requireRole(['hr', 'principal', 'school_director', 'admin']),
  HRController.createParent
);

router.put('/parents/:parentId',
  authenticate,
  requireRole(['hr', 'principal', 'school_director', 'admin']),
  HRController.updateParent
);

router.post('/parents/:parentId/link-student',
  authenticate,
  requireRole(['hr', 'principal', 'school_director', 'admin']),
  HRController.linkParentStudent
);

router.delete('/parents/:parentId/unlink-student/:studentId',
  authenticate,
  requireRole(['hr', 'principal', 'school_director', 'admin']),
  HRController.unlinkParentStudent
);

// Contract Management
router.get('/staff/contracts', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getStaffContracts
);

router.post('/staff/:staffId/contracts', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createStaffContract
);

router.put('/staff/contracts/:contractId/renew', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.renewStaffContract
);

// Recruitment Module with Approval Workflow
router.get('/recruitment/requests', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getRecruitmentRequests
);

router.post('/recruitment/requests', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createRecruitmentRequest
);

router.put('/recruitment/requests/:requestId/approve', 
  authenticate, 
  requireRole(['school_director']), 
  HRController.approveRecruitmentRequest
);

router.put('/recruitment/requests/:requestId/reject', 
  authenticate, 
  requireRole(['school_director']), 
  HRController.rejectRecruitmentRequest
);

router.get('/recruitment/job-postings', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getJobPostings
);

router.post('/recruitment/job-postings', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createJobPosting
);

router.get('/recruitment/applications', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getJobApplications
);

router.post('/recruitment/applications/shortlist', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.shortlistApplications
);

router.get('/recruitment/interviews', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getInterviews
);

router.post('/recruitment/interviews/schedule', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.scheduleInterview
);

router.post('/recruitment/offers/generate', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.generateJobOffer
);

router.get('/recruitment/onboarding', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getOnboardingTasks
);

router.post('/recruitment/onboarding/complete', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.completeOnboarding
);

// Payroll Management Routes
router.post('/payroll', 
  authenticate, 
  requireRole(['hr', 'finance', 'principal', 'school_director', 'admin']), 
  HRController.createPayroll
);

router.get('/payroll', 
  authenticate, 
  requireRole(['hr', 'finance', 'principal', 'school_director', 'admin']), 
  HRController.getPayrollRecords
);

router.put('/payroll/:id', 
  authenticate, 
  requireRole(['hr', 'finance', 'principal', 'school_director', 'admin']), 
  HRController.updatePayroll
);

router.get('/payroll/:payrollId/payslip', 
  authenticate, 
  HRController.generatePayslip
);

// Leave Management Routes
router.post('/leave/apply', 
  authenticate, 
  HRController.submitLeaveApplication
);

router.get('/leave/applications', 
  authenticate, 
  HRController.getLeaveApplications
);

router.put('/leave/applications/:id/process', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.processLeaveApplication
);

// Enhanced Leave Management
router.get('/leave/types', 
  authenticate, 
  HRController.getLeaveTypes
);

router.post('/leave/types', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createLeaveType
);

router.get('/leave/balances/:employeeId', 
  authenticate, 
  HRController.getLeaveBalances
);

router.get('/leave/calendar', 
  authenticate, 
  HRController.getLeaveCalendar
);

router.get('/leave/substitute-teachers', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getSubstituteTeachers
);

router.post('/leave/substitute-teachers/assign', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.assignSubstituteTeacher
);

router.get('/leave/analytics/patterns', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getLeavePatterns
);

router.post('/leave/bulk-approve', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.bulkApproveLeave
);

router.get('/leave/reports/department', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getDepartmentLeaveReport
);

// Performance Management Routes
router.post('/performance/reviews', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.createPerformanceReview
);

router.get('/performance/reviews', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getPerformanceReviews
);

router.put('/performance/reviews/:id', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.updatePerformanceReview
);

// Analytics and Reports Routes
router.get('/dashboard', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getHRDashboard
);

router.get('/analytics', 
  authenticate, 
  requireRole(['hr', 'principal', 'school_director', 'admin']), 
  HRController.getHRAnalytics
);

module.exports = router;