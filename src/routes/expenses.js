const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ExpenseController = require('../controllers/expenseController');

// Apply authentication to all routes
router.use(authenticate);

// =============================================================================
// EXPENSE REQUEST MANAGEMENT
// =============================================================================

// Aliases to match frontend expectations
// GET /api/expenses → list expense requests
router.get('/',
  authenticate,
  ExpenseController.getExpenseRequests
);

// POST /api/expenses → create expense request
router.post('/',
  authenticate,
  requireRole(['finance', 'principal', 'school_director', 'hr']),
  ExpenseController.createExpenseRequest
);

// Get expense requests
router.get('/requests', 
  authenticate, 
  ExpenseController.getExpenseRequests
);

// Create expense request
router.post('/requests', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director', 'hr']), 
  ExpenseController.createExpenseRequest
);

// Update expense request
router.put('/requests/:requestId', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director', 'hr']), 
  ExpenseController.updateExpenseRequest
);

// Submit expense request for approval
router.post('/requests/:requestId/submit', 
  authenticate, 
  ExpenseController.submitExpenseRequest
);

// =============================================================================
// EXPENSE APPROVAL WORKFLOW
// =============================================================================

// Get pending expense approvals
router.get('/pending-approval', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  ExpenseController.getPendingApprovals
);

// Approve expense request
router.put('/:requestId/approve', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  ExpenseController.approveExpenseRequest
);

// Reject expense request
router.put('/:requestId/reject', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  ExpenseController.rejectExpenseRequest
);

// Bulk approve expense requests
router.post('/bulk-approve', 
  authenticate, 
  requireRole(['principal', 'school_director']), 
  ExpenseController.bulkApproveExpenseRequests
);

// =============================================================================
// BUDGET TRACKING & ANALYTICS
// =============================================================================

// Get budget tracking data
router.get('/budget-tracking', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  ExpenseController.getBudgetTracking
);

// Get spending patterns analytics
router.get('/analytics/spending-patterns', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  ExpenseController.getSpendingPatterns
);

// Get budget variance analysis
router.get('/analytics/variance-analysis', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  ExpenseController.getVarianceAnalysis
);

// Get expense summary report
router.get('/reports/summary', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  ExpenseController.getExpenseSummary
);

// =============================================================================
// EXPENSE CATEGORIES
// =============================================================================

// Get expense categories
router.get('/categories', 
  authenticate, 
  ExpenseController.getExpenseCategories
);

// Create expense category
router.post('/categories', 
  authenticate, 
  requireRole(['finance', 'principal', 'school_director']), 
  ExpenseController.createExpenseCategory
);

module.exports = router;