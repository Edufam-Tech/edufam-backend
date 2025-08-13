const express = require('express');
const router = express.Router();

const directorController = require('../../controllers/web/directorController');
const { schoolAuth, requireRole } = require('../../middleware/auth');

// Apply authentication and role authorization for all routes in this router
router.use(schoolAuth);
router.use(requireRole(['school_director']));

/**
 * School Director Web Dashboard Routes
 * All routes here will be mounted under /api/v1/web/director
 */

// Dashboard Overview (wrap to preserve controller context)
router.get('/dashboard', (req, res) => directorController.getDashboard(req, res));
router.get('/dashboard/:schoolId', (req, res) => directorController.getSchoolSpecificDashboard(req, res));

// Multi-School Management
router.get('/schools', (req, res) => directorController.getDirectorSchools(req, res));
router.get('/schools/:schoolId/overview', (req, res) => directorController.getSchoolOverview(req, res));
router.get('/schools/:schoolId/switch', (req, res) => directorController.switchSchoolContext(req, res));

// Portfolio Analytics
router.get('/portfolio/overview', (req, res) => directorController.getPortfolioOverview(req, res));
router.get('/portfolio/comparison', (req, res) => directorController.getSchoolFinancialComparison(req, res));
router.get('/portfolio/analytics', (req, res) => directorController.getPortfolioAnalytics(req, res));

// Approval Management (Cross-School)
router.get('/approvals/pending', (req, res) => directorController.getPendingApprovals(req, res));
router.get('/approvals/pending/:schoolId', (req, res) => directorController.getSchoolPendingApprovals(req, res));
router.get('/approvals/history', (req, res) => directorController.getApprovalHistory(req, res));

// Expense Approvals
router.get('/approvals/expenses', (req, res) => directorController.getPendingExpenseApprovals(req, res));
router.post('/approvals/expenses/:expenseId/approve', (req, res) => directorController.approveExpense(req, res));
router.post('/approvals/expenses/:expenseId/reject', (req, res) => directorController.rejectExpense(req, res));

// Recruitment Approvals
router.get('/approvals/recruitment', (req, res) => directorController.getPendingRecruitmentApprovals(req, res));
router.post('/approvals/recruitment/:recruitmentId/approve', (req, res) => directorController.approveRecruitment(req, res));
router.post('/approvals/recruitment/:recruitmentId/reject', (req, res) => directorController.rejectRecruitment(req, res));

// Fee Assignment Approvals
router.get('/approvals/fee-assignments', (req, res) => directorController.getPendingFeeAssignmentApprovals(req, res));
router.post('/approvals/fee-assignments/:assignmentId/approve', (req, res) => directorController.approveFeeAssignment(req, res));
router.post('/approvals/fee-assignments/:assignmentId/reject', (req, res) => directorController.rejectFeeAssignment(req, res));

// Policy Approvals (stubs for now)
router.get('/approvals/policies', (req, res) => directorController.getPendingPolicyApprovals(req, res));
router.post('/approvals/policies/:policyId/approve', (req, res) => directorController.approvePolicy(req, res));
router.post('/approvals/policies/:policyId/reject', (req, res) => directorController.rejectPolicy(req, res));

// Financial Overview (Multi-School)
router.get('/financial/overview', (req, res) => directorController.getFinancialOverview(req, res));
router.get('/financial/revenue-trends', (req, res) => directorController.getRevenueTrends(req, res));
router.get('/financial/school-comparison', (req, res) => directorController.getSchoolFinancialComparison(req, res));

// Staff Analytics (Multi-School)
router.get('/staff/overview', (req, res) => directorController.getStaffOverview(req, res));
router.get('/staff/performance', (req, res) => directorController.getStaffPerformanceAnalytics(req, res));
router.get('/staff/distribution', (req, res) => directorController.getStaffDistribution(req, res));

// Strategic Planning (stubs)
router.get('/planning/goals', (req, res) => directorController.getStrategicGoals(req, res));
router.get('/planning/performance', (req, res) => directorController.getPerformanceMetrics(req, res));
router.get('/planning/forecasts', (req, res) => directorController.getForecasts(req, res));

// School Settings (Current Selected School)
router.get('/settings/school/:schoolId', (req, res) => directorController.getSchoolSettings(req, res));
router.put('/settings/school/:schoolId', (req, res) => directorController.updateSchoolSettings(req, res));

// Notifications
router.get('/notifications', (req, res) => directorController.getNotifications(req, res));
router.put('/notifications/:notificationId/read', (req, res) => directorController.markNotificationAsRead(req, res));

module.exports = router;


