const express = require('express');
const router = express.Router();
const tripManagementController = require('../../controllers/tripManagementController');
const { authenticate, requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Admin Trip Management Routes
 * Company-managed academic trip programs and registration management
 */

// Authentication middleware for all trip routes
router.use(authenticate);

// ====================================
// TRIP PROGRAM MANAGEMENT (Admin Only)
// ====================================

/**
 * Create new trip program
 * POST /api/v1/admin/trips/programs
 */
router.post('/programs', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  body('programName').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Program name is required (1-200 characters)'),
  body('programType').isIn(['educational', 'cultural', 'adventure', 'leadership', 'skills_development', 'exchange']).withMessage('Valid program type is required'),
  body('targetCurriculum').optional().isArray().withMessage('Target curriculum must be an array'),
  body('learningObjectives').optional().isArray().withMessage('Learning objectives must be an array'),
  body('skillsDeveloped').optional().isArray().withMessage('Skills developed must be an array'),
  body('subjectAreas').optional().isArray().withMessage('Subject areas must be an array'),
  body('destinationCountry').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Destination country is required'),
  body('destinationCity').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Destination city is required'),
  body('destinations').optional().isArray().withMessage('Destinations must be an array'),
  body('durationDays').isInt({ min: 1, max: 365 }).withMessage('Duration must be between 1 and 365 days'),
  body('maxParticipants').isInt({ min: 1 }).withMessage('Max participants must be a positive integer'),
  body('minParticipants').optional().isInt({ min: 1 }).withMessage('Min participants must be a positive integer'),
  body('minAge').optional().isInt({ min: 5, max: 25 }).withMessage('Min age must be between 5 and 25'),
  body('maxAge').optional().isInt({ min: 5, max: 25 }).withMessage('Max age must be between 5 and 25'),
  body('targetGrades').optional().isArray().withMessage('Target grades must be an array'),
  body('baseCost').isFloat({ min: 0 }).withMessage('Base cost must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('costIncludes').optional().isArray().withMessage('Cost includes must be an array'),
  body('costExcludes').optional().isArray().withMessage('Cost excludes must be an array'),
  body('transportationMode').optional().isArray().withMessage('Transportation mode must be an array'),
  body('accommodationType').optional().isString().trim().withMessage('Accommodation type must be a string'),
  body('mealPlan').optional().isString().trim().withMessage('Meal plan must be a string'),
  body('safetyRating').optional().isIn(['low_risk', 'medium_risk', 'high_risk']).withMessage('Invalid safety rating'),
  body('insuranceRequired').optional().isBoolean().withMessage('Insurance required must be boolean'),
  body('passportRequired').optional().isBoolean().withMessage('Passport required must be boolean'),
  body('visaRequired').optional().isBoolean().withMessage('Visa required must be boolean'),
  body('tripLeaderId').optional().isUUID().withMessage('Trip leader ID must be valid UUID'),
  body('registrationOpens').optional().isISO8601().withMessage('Registration opens must be valid date'),
  body('registrationCloses').optional().isISO8601().withMessage('Registration closes must be valid date'),
  body('tripStartDate').optional().isISO8601().withMessage('Trip start date must be valid date'),
  body('tripEndDate').optional().isISO8601().withMessage('Trip end date must be valid date'),
  body('marketingDescription').optional().isString().trim().withMessage('Marketing description must be a string'),
  body('highlights').optional().isArray().withMessage('Highlights must be an array')
], validate, tripManagementController.createTripProgram);

/**
 * Get trip program details
 * GET /api/v1/admin/trips/programs/:programId
 */
router.get('/programs/:programId', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  param('programId').isUUID().withMessage('Valid program ID is required')
], validate, tripManagementController.getTripProgram);

/**
 * Update trip program
 * PUT /api/v1/admin/trips/programs/:programId
 */
router.put('/programs/:programId', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  param('programId').isUUID().withMessage('Valid program ID is required'),
  body('programName').optional().isString().trim().isLength({ min: 1, max: 200 }).withMessage('Program name must be 1-200 characters'),
  body('programType').optional().isIn(['educational', 'cultural', 'adventure', 'leadership', 'skills_development', 'exchange']).withMessage('Invalid program type'),
  body('destinationCountry').optional().isString().trim().withMessage('Destination country must be a string'),
  body('destinationCity').optional().isString().trim().withMessage('Destination city must be a string'),
  body('baseCost').optional().isFloat({ min: 0 }).withMessage('Base cost must be a positive number'),
  body('maxParticipants').optional().isInt({ min: 1 }).withMessage('Max participants must be a positive integer'),
  body('tripLeaderId').optional().isUUID().withMessage('Trip leader ID must be valid UUID'),
  body('programStatus').optional().isIn(['draft', 'published', 'open_registration', 'closed', 'completed', 'cancelled']).withMessage('Invalid program status'),
  body('registrationOpens').optional().isISO8601().withMessage('Registration opens must be valid date'),
  body('registrationCloses').optional().isISO8601().withMessage('Registration closes must be valid date'),
  body('tripStartDate').optional().isISO8601().withMessage('Trip start date must be valid date'),
  body('tripEndDate').optional().isISO8601().withMessage('Trip end date must be valid date'),
  body('marketingDescription').optional().isString().trim().withMessage('Marketing description must be a string')
], validate, tripManagementController.updateTripProgram);

/**
 * Get trip programs list
 * GET /api/v1/admin/trips/programs
 */
router.get('/programs', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  query('programType').optional().isIn(['educational', 'cultural', 'adventure', 'leadership', 'skills_development', 'exchange']).withMessage('Invalid program type'),
  query('destinationCountry').optional().isString().trim().withMessage('Destination country must be a string'),
  query('programStatus').optional().isIn(['draft', 'published', 'open_registration', 'closed', 'completed', 'cancelled']).withMessage('Invalid program status'),
  query('curriculum').optional().isString().trim().withMessage('Curriculum must be a string'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be valid date'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, tripManagementController.getTripPrograms);

/**
 * Publish trip program
 * PUT /api/v1/admin/trips/programs/:programId/publish
 */
router.put('/programs/:programId/publish', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  param('programId').isUUID().withMessage('Valid program ID is required')
], validate, tripManagementController.publishTripProgram);

/**
 * Open registration for trip program
 * PUT /api/v1/admin/trips/programs/:programId/open-registration
 */
router.put('/programs/:programId/open-registration', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  param('programId').isUUID().withMessage('Valid program ID is required')
], validate, tripManagementController.openRegistration);

/**
 * Close registration for trip program
 * PUT /api/v1/admin/trips/programs/:programId/close-registration
 */
router.put('/programs/:programId/close-registration', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  param('programId').isUUID().withMessage('Valid program ID is required')
], validate, tripManagementController.closeRegistration);

// ====================================
// REGISTRATION MANAGEMENT (Admin)
// ====================================

/**
 * Get trip registrations
 * GET /api/v1/admin/trips/programs/:programId/registrations
 */
router.get('/programs/:programId/registrations', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  param('programId').isUUID().withMessage('Valid program ID is required'),
  query('registrationStatus').optional().isIn(['pending', 'confirmed', 'waitlisted', 'cancelled', 'completed']).withMessage('Invalid registration status'),
  query('paymentStatus').optional().isIn(['pending', 'partial', 'completed', 'refunded']).withMessage('Invalid payment status'),
  query('schoolId').optional().isUUID().withMessage('School ID must be valid UUID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, tripManagementController.getTripRegistrations);

/**
 * Update registration status
 * PUT /api/v1/admin/trips/registrations/:registrationId/status
 */
router.put('/registrations/:registrationId/status', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  param('registrationId').isUUID().withMessage('Valid registration ID is required'),
  body('status').isIn(['pending', 'confirmed', 'waitlisted', 'cancelled']).withMessage('Valid status is required')
], validate, tripManagementController.updateRegistrationStatus);

// ====================================
// ANALYTICS AND REPORTS (Admin)
// ====================================

/**
 * Get trip program analytics
 * GET /api/v1/admin/trips/programs/:programId/analytics
 */
router.get('/programs/:programId/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  param('programId').isUUID().withMessage('Valid program ID is required')
], validate, tripManagementController.getTripAnalytics);

/**
 * Get trip management dashboard
 * GET /api/v1/admin/trips/dashboard
 */
router.get('/dashboard', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager'])
], tripManagementController.getTripDashboard);

/**
 * Get revenue analytics
 * GET /api/v1/admin/trips/analytics/revenue
 */
router.get('/analytics/revenue', [
  requireRole(['super_admin', 'edufam_admin', 'trip_manager']),
  query('period').optional().isIn(['week', 'month', 'year']).withMessage('Period must be week, month, or year')
], validate, tripManagementController.getRevenueAnalytics);

// ====================================
// SCHOOL-FACING ENDPOINTS
// ====================================

/**
 * Get available trip programs for schools
 * GET /api/v1/admin/trips/available
 */
router.get('/available', [
  query('curriculum').optional().isString().trim().withMessage('Curriculum must be a string'),
  query('programType').optional().isIn(['educational', 'cultural', 'adventure', 'leadership', 'skills_development', 'exchange']).withMessage('Invalid program type'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, tripManagementController.getAvailableTripsForSchools);

/**
 * Register student for trip
 * POST /api/v1/admin/trips/programs/:programId/register
 */
router.post('/programs/:programId/register', [
  requireRole(['principal', 'school_director', 'trip_coordinator', 'parent']),
  param('programId').isUUID().withMessage('Valid program ID is required'),
  body('studentId').isUUID().withMessage('Valid student ID is required'),
  body('schoolId').isUUID().withMessage('Valid school ID is required'),
  body('parentGuardianId').optional().isUUID().withMessage('Parent guardian ID must be valid UUID'),
  body('medicalConditions').optional().isString().trim().withMessage('Medical conditions must be a string'),
  body('dietaryRestrictions').optional().isString().trim().withMessage('Dietary restrictions must be a string'),
  body('specialNeeds').optional().isString().trim().withMessage('Special needs must be a string'),
  body('passportNumber').optional().isString().trim().withMessage('Passport number must be a string'),
  body('passportExpiry').optional().isISO8601().withMessage('Passport expiry must be valid date'),
  body('preferredContactMethod').optional().isIn(['email', 'sms', 'phone', 'whatsapp']).withMessage('Invalid contact method'),
  body('emergencyContactAbroad').optional().isString().trim().withMessage('Emergency contact abroad must be a string')
], validate, tripManagementController.registerStudent);

/**
 * Check trip availability
 * GET /api/v1/admin/trips/programs/:programId/availability
 */
router.get('/programs/:programId/availability', [
  param('programId').isUUID().withMessage('Valid program ID is required')
], validate, tripManagementController.checkTripAvailability);

/**
 * Get school's trip registrations
 * GET /api/v1/admin/trips/my-registrations
 */
router.get('/my-registrations', [
  requireRole(['principal', 'school_director', 'trip_coordinator', 'teacher', 'finance_manager']),
  query('registrationStatus').optional().isIn(['pending', 'confirmed', 'waitlisted', 'cancelled', 'completed']).withMessage('Invalid registration status'),
  query('paymentStatus').optional().isIn(['pending', 'partial', 'completed', 'refunded']).withMessage('Invalid payment status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, tripManagementController.getSchoolTripRegistrations);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Trip management service health check
 * GET /api/v1/admin/trips/health
 */
router.get('/health', tripManagementController.getTripServiceHealth);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for trip routes
router.use((error, req, res, next) => {
  console.error('Admin trip route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'TRIP_ERROR',
      message: error.message || 'An error occurred in trip management'
    }
  });
});

module.exports = router;