const express = require('express');
const router = express.Router();
const multiSchoolDirectorController = require('../../controllers/multiSchoolDirectorController');
const { authenticate, requireUserType, requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Multi-School Director Routes
 * All routes require director-level authentication
 */

// Authentication middleware for all director routes
router.use(authenticate);
router.use(requireRole(['school_director', 'super_admin', 'edufam_admin']));

// ====================================
// SCHOOL PORTFOLIO MANAGEMENT
// ====================================

/**
 * Get director's school portfolio
 * GET /api/v1/director/schools/portfolio
 */
router.get('/schools/portfolio', multiSchoolDirectorController.getPortfolio);

/**
 * Get recent schools
 * GET /api/v1/director/schools/recent
 */
router.get('/schools/recent', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], validate, multiSchoolDirectorController.getRecentSchools);

// ====================================
// SCHOOL CONTEXT SWITCHING
// ====================================

/**
 * Switch school context
 * POST /api/v1/director/switch-school
 */
router.post('/switch-school', [
  body('schoolId').isUUID().withMessage('Valid school ID is required'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason must be a string with max 500 characters')
], validate, multiSchoolDirectorController.switchSchool);

/**
 * Get current context
 * GET /api/v1/director/context/current
 */
router.get('/context/current', multiSchoolDirectorController.getCurrentContext);

/**
 * Get specific school context
 * GET /api/v1/director/schools/:id/context
 */
router.get('/schools/:id/context', [
  param('id').isUUID().withMessage('Valid school ID is required')
], validate, multiSchoolDirectorController.getSchoolContext);

/**
 * Validate access to a school
 * GET /api/v1/director/schools/:schoolId/validate-access
 */
router.get('/schools/:schoolId/validate-access', [
  param('schoolId').isUUID().withMessage('Valid school ID is required'),
  query('accessLevel').optional().isIn(['read_only', 'academic_only', 'financial_only', 'full']).withMessage('Invalid access level')
], validate, multiSchoolDirectorController.validateAccess);

// ====================================
// SCHOOL ACCESS MANAGEMENT
// ====================================

/**
 * Grant director access to a school (Super Admin / School Owner only)
 * POST /api/v1/director/schools/grant-access
 */
router.post('/schools/grant-access', [
  requireRole(['super_admin', 'edufam_admin']), // Only platform admins can grant access
  body('directorId').isUUID().withMessage('Valid director ID is required'),
  body('schoolId').isUUID().withMessage('Valid school ID is required'),
  body('accessLevel').isIn(['read_only', 'academic_only', 'financial_only', 'full']).withMessage('Invalid access level'),
  body('expiresAt').optional().isISO8601().withMessage('Expiration date must be in ISO 8601 format'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason must be a string with max 500 characters')
], validate, multiSchoolDirectorController.grantSchoolAccess);

/**
 * Revoke director access to a school (Super Admin / School Owner only)
 * DELETE /api/v1/director/schools/:schoolId/access/:directorId
 */
router.delete('/schools/:schoolId/access/:directorId', [
  requireRole(['super_admin', 'edufam_admin']), // Only platform admins can revoke access
  param('schoolId').isUUID().withMessage('Valid school ID is required'),
  param('directorId').isUUID().withMessage('Valid director ID is required')
], validate, multiSchoolDirectorController.revokeSchoolAccess);

// ====================================
// FAVORITE SCHOOLS MANAGEMENT
// ====================================

/**
 * Add school to favorites
 * POST /api/v1/director/schools/favorite
 */
router.post('/schools/favorite', [
  body('schoolId').isUUID().withMessage('Valid school ID is required'),
  body('displayOrder').optional().isInt({ min: 1 }).withMessage('Display order must be a positive integer')
], validate, multiSchoolDirectorController.addFavoriteSchool);

/**
 * Remove school from favorites
 * DELETE /api/v1/director/schools/:schoolId/favorite
 */
router.delete('/schools/:schoolId/favorite', [
  param('schoolId').isUUID().withMessage('Valid school ID is required')
], validate, multiSchoolDirectorController.removeFavoriteSchool);

// ====================================
// CROSS-SCHOOL ANALYTICS
// ====================================

/**
 * Get portfolio analytics
 * GET /api/v1/director/analytics/portfolio
 */
router.get('/analytics/portfolio', [
  query('schoolIds').optional().isString().withMessage('School IDs must be comma-separated string'),
  query('forceRefresh').optional().isBoolean().withMessage('Force refresh must be boolean'),
  query('cacheMinutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Cache minutes must be between 1 and 1440')
], validate, multiSchoolDirectorController.getPortfolioAnalytics);

/**
 * Get school performance comparison
 * GET /api/v1/director/analytics/school-comparison
 */
router.get('/analytics/school-comparison', [
  query('schoolIds').optional().isString().withMessage('School IDs must be comma-separated string'),
  query('metrics').optional().isString().withMessage('Metrics must be comma-separated string'),
  query('period').optional().isIn(['last_month', 'last_3_months', 'last_6_months', 'last_12_months', 'current_year']).withMessage('Invalid period')
], validate, multiSchoolDirectorController.getSchoolComparison);

/**
 * Get consolidated financial reports
 * GET /api/v1/director/analytics/consolidated-reports
 */
router.get('/analytics/consolidated-reports', [
  query('schoolIds').optional().isString().withMessage('School IDs must be comma-separated string'),
  query('reportType').optional().isIn(['financial', 'academic', 'operational']).withMessage('Invalid report type'),
  query('period').optional().isIn(['last_month', 'last_3_months', 'last_6_months', 'last_12_months', 'current_year']).withMessage('Invalid period')
], validate, multiSchoolDirectorController.getConsolidatedReports);

/**
 * Get performance trends
 * GET /api/v1/director/analytics/performance-trends
 */
router.get('/analytics/performance-trends', [
  query('schoolIds').optional().isString().withMessage('School IDs must be comma-separated string'),
  query('timeframe').optional().isIn(['last_3_months', 'last_6_months', 'last_12_months', 'last_24_months']).withMessage('Invalid timeframe'),
  query('metrics').optional().isString().withMessage('Metrics must be comma-separated string')
], validate, multiSchoolDirectorController.getPerformanceTrends);

/**
 * Create custom analytics report
 * POST /api/v1/director/analytics/custom-report
 */
router.post('/analytics/custom-report', [
  body('reportConfig').isObject().withMessage('Report configuration is required'),
  body('schoolIds').optional().isArray().withMessage('School IDs must be an array'),
  body('parameters').optional().isObject().withMessage('Parameters must be an object')
], validate, multiSchoolDirectorController.createCustomReport);

// ====================================
// AUDIT AND HISTORY
// ====================================

/**
 * Get school switch history
 * GET /api/v1/director/history/switches
 */
router.get('/history/switches', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, multiSchoolDirectorController.getSwitchHistory);

// ====================================
// HEALTH CHECK AND STATUS
// ====================================

/**
 * Health check for multi-school director functionality
 * GET /api/v1/director/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Multi-School Director Service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: [
        'school_context_switching',
        'cross_school_analytics',
        'portfolio_management',
        'access_control',
        'audit_trail'
      ]
    },
    message: 'Multi-school director service is operational'
  });
});

module.exports = router;