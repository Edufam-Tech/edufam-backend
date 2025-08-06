const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const PayrollController = require('../controllers/payrollController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType(['school_user', 'admin_user']));

// =============================================================================
// SALARY STRUCTURE MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/payroll/salary-structures
 * @desc    Get salary structures
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.get('/salary-structures',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  query('position').optional().isString().withMessage('Position must be string'),
  query('grade').optional().isString().withMessage('Grade must be string'),
  query('active').optional().isBoolean().withMessage('Active must be boolean'),
  validate,
  PayrollController.getSalaryStructures
);

/**
 * @route   POST /api/payroll/salary-structures
 * @desc    Create salary structure
 * @access  Private (HR, Principal, School Director)
 */
router.post('/salary-structures',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  body('positionTitle').notEmpty().withMessage('Position title is required'),
  body('grade').notEmpty().withMessage('Grade is required'),
  body('basicSalary').isFloat({ min: 0 }).withMessage('Basic salary must be positive'),
  body('allowances').optional().isObject().withMessage('Allowances must be object'),
  body('allowances.houseAllowance').optional().isFloat({ min: 0 }).withMessage('House allowance must be positive'),
  body('allowances.transportAllowance').optional().isFloat({ min: 0 }).withMessage('Transport allowance must be positive'),
  body('allowances.medicalAllowance').optional().isFloat({ min: 0 }).withMessage('Medical allowance must be positive'),
  body('allowances.communicationAllowance').optional().isFloat({ min: 0 }).withMessage('Communication allowance must be positive'),
  body('deductions').optional().isObject().withMessage('Deductions must be object'),
  body('deductions.nhif').optional().isFloat({ min: 0 }).withMessage('NHIF must be positive'),
  body('deductions.nssf').optional().isFloat({ min: 0 }).withMessage('NSSF must be positive'),
  body('deductions.paye').optional().isFloat({ min: 0 }).withMessage('PAYE must be positive'),
  body('currencyCode').optional().isIn(['KES', 'USD', 'EUR']).withMessage('Invalid currency code'),
  body('effectiveDate').isISO8601().withMessage('Effective date is required'),
  validate,
  PayrollController.createSalaryStructure
);

/**
 * @route   PUT /api/payroll/salary-structures/:structureId
 * @desc    Update salary structure
 * @access  Private (HR, Principal, School Director)
 */
router.put('/salary-structures/:structureId',
  requireRole(['hr', 'principal', 'school_director', 'super_admin']),
  param('structureId').isUUID().withMessage('Structure ID must be valid UUID'),
  body('basicSalary').optional().isFloat({ min: 0 }).withMessage('Basic salary must be positive'),
  body('allowances').optional().isObject().withMessage('Allowances must be object'),
  body('deductions').optional().isObject().withMessage('Deductions must be object'),
  validate,
  PayrollController.updateSalaryStructure
);

// =============================================================================
// PAYROLL CALCULATIONS
// =============================================================================

/**
 * @route   GET /api/payroll/calculations/:employeeId
 * @desc    Get payroll calculations for employee
 * @access  Private (HR, Finance, Principal, School Director, Self)
 */
router.get('/calculations/:employeeId',
  param('employeeId').isUUID().withMessage('Employee ID must be valid UUID'),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  validate,
  PayrollController.getPayrollCalculations
);

/**
 * @route   POST /api/payroll/calculations/:employeeId/recalculate
 * @desc    Recalculate payroll for employee
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.post('/calculations/:employeeId/recalculate',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  param('employeeId').isUUID().withMessage('Employee ID must be valid UUID'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month is required and must be between 1 and 12'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Year is required and must be between 2020 and 2030'),
  body('adjustments').optional().isObject().withMessage('Adjustments must be object'),
  body('reason').optional().isString().withMessage('Reason must be string'),
  validate,
  PayrollController.recalculatePayroll
);

// =============================================================================
// MONTHLY PAYROLL PROCESSING
// =============================================================================

/**
 * @route   POST /api/payroll/process-monthly
 * @desc    Process monthly payroll for all employees
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.post('/process-monthly',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month is required and must be between 1 and 12'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Year is required and must be between 2020 and 2030'),
  body('employeeIds').optional().isArray().withMessage('Employee IDs must be array'),
  body('excludeEmployeeIds').optional().isArray().withMessage('Exclude employee IDs must be array'),
  body('includeAllowances').optional().isBoolean().withMessage('Include allowances must be boolean'),
  body('includeDeductions').optional().isBoolean().withMessage('Include deductions must be boolean'),
  validate,
  PayrollController.processMonthlyPayroll
);

/**
 * @route   GET /api/payroll/processing-status/:batchId
 * @desc    Get payroll processing status
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.get('/processing-status/:batchId',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  param('batchId').isUUID().withMessage('Batch ID must be valid UUID'),
  validate,
  PayrollController.getProcessingStatus
);

// =============================================================================
// PAYSLIPS
// =============================================================================

/**
 * @route   GET /api/payroll/payslips/:employeeId
 * @desc    Get payslips for employee
 * @access  Private (HR, Finance, Principal, School Director, Self)
 */
router.get('/payslips/:employeeId',
  param('employeeId').isUUID().withMessage('Employee ID must be valid UUID'),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  query('limit').optional().isInt({ min: 1, max: 12 }).withMessage('Limit must be between 1 and 12'),
  validate,
  PayrollController.getPayslips
);

/**
 * @route   GET /api/payroll/payslips/:employeeId/:payslipId/download
 * @desc    Download payslip PDF
 * @access  Private (HR, Finance, Principal, School Director, Self)
 */
router.get('/payslips/:employeeId/:payslipId/download',
  param('employeeId').isUUID().withMessage('Employee ID must be valid UUID'),
  param('payslipId').isUUID().withMessage('Payslip ID must be valid UUID'),
  validate,
  PayrollController.downloadPayslip
);

/**
 * @route   POST /api/payroll/payslips/generate-bulk
 * @desc    Generate payslips in bulk
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.post('/payslips/generate-bulk',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month is required and must be between 1 and 12'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Year is required and must be between 2020 and 2030'),
  body('employeeIds').optional().isArray().withMessage('Employee IDs must be array'),
  body('deliveryMethod').isIn(['download', 'email', 'both']).withMessage('Invalid delivery method'),
  body('emailTemplate').optional().isString().withMessage('Email template must be string'),
  validate,
  PayrollController.generateBulkPayslips
);

/**
 * @route   POST /api/payroll/payslips/:payslipId/email
 * @desc    Email payslip to employee
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.post('/payslips/:payslipId/email',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  param('payslipId').isUUID().withMessage('Payslip ID must be valid UUID'),
  body('emailTemplate').optional().isString().withMessage('Email template must be string'),
  body('customMessage').optional().isString().withMessage('Custom message must be string'),
  validate,
  PayrollController.emailPayslip
);

// =============================================================================
// TAX CALCULATIONS
// =============================================================================

/**
 * @route   GET /api/payroll/tax-calculations
 * @desc    Get tax calculations for employees
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.get('/tax-calculations',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  query('employeeId').optional().isUUID().withMessage('Employee ID must be valid UUID'),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  query('taxType').optional().isIn(['paye', 'nhif', 'nssf', 'all']).withMessage('Invalid tax type'),
  validate,
  PayrollController.getTaxCalculations
);

/**
 * @route   POST /api/payroll/tax-calculations/update-rates
 * @desc    Update tax rates
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.post('/tax-calculations/update-rates',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  body('taxType').isIn(['paye', 'nhif', 'nssf']).withMessage('Invalid tax type'),
  body('rates').isObject().withMessage('Rates object is required'),
  body('effectiveDate').isISO8601().withMessage('Effective date is required'),
  validate,
  PayrollController.updateTaxRates
);

// =============================================================================
// DEDUCTIONS MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/payroll/deductions
 * @desc    Get deductions
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.get('/deductions',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  query('employeeId').optional().isUUID().withMessage('Employee ID must be valid UUID'),
  query('deductionType').optional().isIn(['statutory', 'loan', 'advance', 'insurance', 'other']).withMessage('Invalid deduction type'),
  query('active').optional().isBoolean().withMessage('Active must be boolean'),
  validate,
  PayrollController.getDeductions
);

/**
 * @route   POST /api/payroll/deductions
 * @desc    Create deduction
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.post('/deductions',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  body('employeeId').isUUID().withMessage('Employee ID is required and must be valid UUID'),
  body('deductionType').isIn(['statutory', 'loan', 'advance', 'insurance', 'other']).withMessage('Invalid deduction type'),
  body('name').notEmpty().withMessage('Deduction name is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('frequency').isIn(['once', 'monthly', 'annual']).withMessage('Invalid frequency'),
  body('startDate').isISO8601().withMessage('Start date is required'),
  body('endDate').optional().isISO8601().withMessage('End date must be valid'),
  body('maxAmount').optional().isFloat({ min: 0 }).withMessage('Max amount must be positive'),
  body('description').optional().isString().withMessage('Description must be string'),
  validate,
  PayrollController.createDeduction
);

/**
 * @route   PUT /api/payroll/deductions/:deductionId
 * @desc    Update deduction
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.put('/deductions/:deductionId',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  param('deductionId').isUUID().withMessage('Deduction ID must be valid UUID'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('endDate').optional().isISO8601().withMessage('End date must be valid'),
  body('isActive').optional().isBoolean().withMessage('Is active must be boolean'),
  validate,
  PayrollController.updateDeduction
);

// =============================================================================
// BANK TRANSFERS
// =============================================================================

/**
 * @route   GET /api/payroll/bank-transfers
 * @desc    Get bank transfer records
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.get('/bank-transfers',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']).withMessage('Invalid status'),
  validate,
  PayrollController.getBankTransfers
);

/**
 * @route   POST /api/payroll/bank-transfers/initiate
 * @desc    Initiate bank transfers for payroll
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.post('/bank-transfers/initiate',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  body('payrollBatchId').isUUID().withMessage('Payroll batch ID is required and must be valid UUID'),
  body('transferDate').optional().isISO8601().withMessage('Transfer date must be valid'),
  body('employeeIds').optional().isArray().withMessage('Employee IDs must be array'),
  body('bankId').optional().isUUID().withMessage('Bank ID must be valid UUID'),
  validate,
  PayrollController.initiateBankTransfers
);

/**
 * @route   PUT /api/payroll/bank-transfers/:transferId/confirm
 * @desc    Confirm bank transfer
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.put('/bank-transfers/:transferId/confirm',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  param('transferId').isUUID().withMessage('Transfer ID must be valid UUID'),
  body('confirmationCode').notEmpty().withMessage('Confirmation code is required'),
  body('actualAmount').optional().isFloat({ min: 0 }).withMessage('Actual amount must be positive'),
  validate,
  PayrollController.confirmBankTransfer
);

// =============================================================================
// PAYROLL ANALYTICS & REPORTS
// =============================================================================

/**
 * @route   GET /api/payroll/analytics/summary
 * @desc    Get payroll analytics summary
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.get('/analytics/summary',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  query('startMonth').optional().isInt({ min: 1, max: 12 }).withMessage('Start month must be between 1 and 12'),
  query('endMonth').optional().isInt({ min: 1, max: 12 }).withMessage('End month must be between 1 and 12'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  validate,
  PayrollController.getPayrollAnalytics
);

/**
 * @route   GET /api/payroll/reports/monthly-summary
 * @desc    Get monthly payroll summary report
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.get('/reports/monthly-summary',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  query('month').isInt({ min: 1, max: 12 }).withMessage('Month is required and must be between 1 and 12'),
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Year is required and must be between 2020 and 2030'),
  query('format').optional().isIn(['json', 'pdf', 'excel']).withMessage('Invalid format'),
  validate,
  PayrollController.getMonthlySummaryReport
);

/**
 * @route   GET /api/payroll/reports/tax-summary
 * @desc    Get tax summary report
 * @access  Private (HR, Finance, Principal, School Director)
 */
router.get('/reports/tax-summary',
  requireRole(['hr', 'finance', 'principal', 'school_director', 'super_admin']),
  query('month').isInt({ min: 1, max: 12 }).withMessage('Month is required and must be between 1 and 12'),
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Year is required and must be between 2020 and 2030'),
  query('taxType').optional().isIn(['paye', 'nhif', 'nssf', 'all']).withMessage('Invalid tax type'),
  query('format').optional().isIn(['json', 'pdf', 'excel']).withMessage('Invalid format'),
  validate,
  PayrollController.getTaxSummaryReport
);

module.exports = router;