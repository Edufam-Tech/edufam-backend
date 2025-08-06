const express = require('express');
const router = express.Router();
const trainingCenterController = require('../controllers/trainingCenterController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Training Center Routes
 * Handles training center operations, workshop management, and instructor coordination
 */

// ====================================
// PUBLIC ENDPOINTS (No Authentication)
// ====================================

/**
 * Get public training programs (for website)
 * GET /api/v1/training/public/programs
 */
router.get('/public/programs', [
  query('category').optional().isString().trim().withMessage('Category must be a string'),
  query('programType').optional().isIn(['certification', 'workshop', 'seminar', 'bootcamp', 'conference']).withMessage('Invalid program type'),
  query('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid difficulty level'),
  query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], validate, trainingCenterController.getPublicTrainingPrograms);

/**
 * Get public training sessions (for website)
 * GET /api/v1/training/public/sessions
 */
router.get('/public/sessions', [
  query('programId').optional().isUUID().withMessage('Program ID must be valid UUID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
], validate, trainingCenterController.getPublicTrainingSessions);

// ====================================
// AUTHENTICATED ENDPOINTS
// ====================================

// Authentication middleware for protected routes
router.use(authenticate);

// ====================================
// TRAINING CENTERS MANAGEMENT
// ====================================

/**
 * Create training center
 * POST /api/v1/training/centers
 */
router.post('/centers', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator']),
  body('centerName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Center name is required (1-255 characters)'),
  body('centerCode').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Center code is required (1-20 characters)'),
  body('centerType').isIn(['physical', 'virtual', 'hybrid']).withMessage('Valid center type is required'),
  body('description').optional().isString().trim().withMessage('Description must be a string'),
  body('address').optional().isString().trim().withMessage('Address must be a string'),
  body('city').optional().isString().trim().withMessage('City must be a string'),
  body('stateProvince').optional().isString().trim().withMessage('State/Province must be a string'),
  body('country').optional().isString().trim().withMessage('Country must be a string'),
  body('postalCode').optional().isString().trim().withMessage('Postal code must be a string'),
  body('coordinates').optional().isObject().withMessage('Coordinates must be an object'),
  body('phone').optional().isString().trim().withMessage('Phone must be a string'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('websiteUrl').optional().isURL().withMessage('Valid website URL is required'),
  body('maxCapacity').isInt({ min: 1 }).withMessage('Max capacity must be a positive integer'),
  body('classroomCount').optional().isInt({ min: 0 }).withMessage('Classroom count must be a non-negative integer'),
  body('computerLabCount').optional().isInt({ min: 0 }).withMessage('Computer lab count must be a non-negative integer'),
  body('hasProjector').optional().isBoolean().withMessage('Has projector must be boolean'),
  body('hasWifi').optional().isBoolean().withMessage('Has WiFi must be boolean'),
  body('hasParking').optional().isBoolean().withMessage('Has parking must be boolean'),
  body('accessibilityFeatures').optional().isArray().withMessage('Accessibility features must be an array'),
  body('virtualPlatform').optional().isString().trim().withMessage('Virtual platform must be a string'),
  body('platformSettings').optional().isObject().withMessage('Platform settings must be an object'),
  body('virtualRoomCapacity').optional().isInt({ min: 1 }).withMessage('Virtual room capacity must be a positive integer'),
  body('operatingHours').optional().isObject().withMessage('Operating hours must be an object'),
  body('timeZone').optional().isString().trim().withMessage('Time zone must be a string'),
  body('centerManagerId').optional().isUUID().withMessage('Center manager ID must be valid UUID'),
  body('backupManagerId').optional().isUUID().withMessage('Backup manager ID must be valid UUID'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number'),
  body('dailyRate').optional().isFloat({ min: 0 }).withMessage('Daily rate must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
  body('certificationStatus').optional().isString().trim().withMessage('Certification status must be a string'),
  body('certifyingBody').optional().isString().trim().withMessage('Certifying body must be a string')
], validate, trainingCenterController.createTrainingCenter);

/**
 * Get training centers
 * GET /api/v1/training/centers
 */
router.get('/centers', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator', 'instructor']),
  query('centerType').optional().isIn(['physical', 'virtual', 'hybrid']).withMessage('Invalid center type'),
  query('status').optional().isIn(['active', 'inactive', 'maintenance', 'under_construction']).withMessage('Invalid status'),
  query('city').optional().isString().trim().withMessage('City must be a string'),
  query('country').optional().isString().trim().withMessage('Country must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, trainingCenterController.getTrainingCenters);

/**
 * Get training center details
 * GET /api/v1/training/centers/:centerId
 */
router.get('/centers/:centerId', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator', 'instructor']),
  param('centerId').isUUID().withMessage('Valid center ID is required')
], validate, trainingCenterController.getTrainingCenter);

// ====================================
// TRAINING PROGRAMS MANAGEMENT
// ====================================

/**
 * Create training program
 * POST /api/v1/training/programs
 */
router.post('/programs', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator']),
  body('programName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Program name is required (1-255 characters)'),
  body('programCode').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Program code is required (1-20 characters)'),
  body('programType').isIn(['certification', 'workshop', 'seminar', 'bootcamp', 'conference']).withMessage('Valid program type is required'),
  body('category').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Category is required (1-50 characters)'),
  body('subcategory').optional().isString().trim().withMessage('Subcategory must be a string'),
  body('description').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required (1-2000 characters)'),
  body('learningObjectives').optional().isArray().withMessage('Learning objectives must be an array'),
  body('prerequisites').optional().isArray().withMessage('Prerequisites must be an array'),
  body('targetAudience').optional().isArray().withMessage('Target audience must be an array'),
  body('durationDays').isInt({ min: 1 }).withMessage('Duration days must be a positive integer'),
  body('durationHours').isInt({ min: 1 }).withMessage('Duration hours must be a positive integer'),
  body('sessionCount').optional().isInt({ min: 1 }).withMessage('Session count must be a positive integer'),
  body('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid difficulty level'),
  body('minAge').optional().isInt({ min: 1, max: 100 }).withMessage('Min age must be between 1 and 100'),
  body('maxParticipants').optional().isInt({ min: 1 }).withMessage('Max participants must be a positive integer'),
  body('minParticipants').optional().isInt({ min: 1 }).withMessage('Min participants must be a positive integer'),
  body('providesCertificate').optional().isBoolean().withMessage('Provides certificate must be boolean'),
  body('certificateType').optional().isString().trim().withMessage('Certificate type must be a string'),
  body('certificateValidityMonths').optional().isInt({ min: 1 }).withMessage('Certificate validity must be a positive integer'),
  body('continuingEducationCredits').optional().isInt({ min: 0 }).withMessage('CE credits must be a non-negative integer'),
  body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
  body('earlyBirdDiscount').optional().isFloat({ min: 0, max: 100 }).withMessage('Early bird discount must be between 0 and 100'),
  body('groupDiscountThreshold').optional().isInt({ min: 1 }).withMessage('Group discount threshold must be a positive integer'),
  body('groupDiscountRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Group discount rate must be between 0 and 100'),
  body('materialsIncluded').optional().isArray().withMessage('Materials included must be an array'),
  body('requiredMaterials').optional().isArray().withMessage('Required materials must be an array'),
  body('softwareRequirements').optional().isArray().withMessage('Software requirements must be an array'),
  body('hardwareRequirements').optional().isArray().withMessage('Hardware requirements must be an array'),
  body('deliveryMethod').optional().isIn(['in_person', 'virtual', 'hybrid', 'self_paced']).withMessage('Invalid delivery method'),
  body('platformRequirements').optional().isArray().withMessage('Platform requirements must be an array'),
  body('curriculumOutline').optional().isObject().withMessage('Curriculum outline must be an object'),
  body('assessmentMethods').optional().isArray().withMessage('Assessment methods must be an array'),
  body('practicalComponents').optional().isBoolean().withMessage('Practical components must be boolean'),
  body('projectBased').optional().isBoolean().withMessage('Project based must be boolean'),
  body('featuredImageUrl').optional().isURL().withMessage('Featured image URL must be valid'),
  body('promotionalVideoUrl').optional().isURL().withMessage('Promotional video URL must be valid'),
  body('marketingHighlights').optional().isArray().withMessage('Marketing highlights must be an array')
], validate, trainingCenterController.createTrainingProgram);

/**
 * Get training programs
 * GET /api/v1/training/programs
 */
router.get('/programs', [
  query('category').optional().isString().trim().withMessage('Category must be a string'),
  query('programType').optional().isIn(['certification', 'workshop', 'seminar', 'bootcamp', 'conference']).withMessage('Invalid program type'),
  query('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid difficulty level'),
  query('deliveryMethod').optional().isIn(['in_person', 'virtual', 'hybrid', 'self_paced']).withMessage('Invalid delivery method'),
  query('providesCertificate').optional().isBoolean().withMessage('Provides certificate must be boolean'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, trainingCenterController.getTrainingPrograms);

/**
 * Get training program details
 * GET /api/v1/training/programs/:programId
 */
router.get('/programs/:programId', [
  param('programId').isUUID().withMessage('Valid program ID is required')
], validate, trainingCenterController.getTrainingProgram);

// ====================================
// TRAINING SESSIONS MANAGEMENT
// ====================================

/**
 * Create training session
 * POST /api/v1/training/sessions
 */
router.post('/sessions', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator']),
  body('programId').isUUID().withMessage('Valid program ID is required'),
  body('centerId').isUUID().withMessage('Valid center ID is required'),
  body('sessionName').optional().isString().trim().withMessage('Session name must be a string'),
  body('cohortName').optional().isString().trim().withMessage('Cohort name must be a string'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time is required (HH:MM)'),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time is required (HH:MM)'),
  body('timeZone').optional().isString().trim().withMessage('Time zone must be a string'),
  body('dailySchedule').optional().isObject().withMessage('Daily schedule must be an object'),
  body('breakSchedule').optional().isObject().withMessage('Break schedule must be an object'),
  body('maxParticipants').isInt({ min: 1 }).withMessage('Max participants must be a positive integer'),
  body('minParticipants').optional().isInt({ min: 1 }).withMessage('Min participants must be a positive integer'),
  body('sessionPrice').optional().isFloat({ min: 0 }).withMessage('Session price must be a positive number'),
  body('earlyBirdDeadline').optional().isISO8601().withMessage('Valid early bird deadline is required'),
  body('earlyBirdDiscount').optional().isFloat({ min: 0, max: 100 }).withMessage('Early bird discount must be between 0 and 100'),
  body('deliveryMethod').isIn(['in_person', 'virtual', 'hybrid']).withMessage('Valid delivery method is required'),
  body('virtualMeetingUrl').optional().isURL().withMessage('Virtual meeting URL must be valid'),
  body('virtualMeetingId').optional().isString().trim().withMessage('Virtual meeting ID must be a string'),
  body('virtualMeetingPassword').optional().isString().trim().withMessage('Virtual meeting password must be a string'),
  body('leadInstructorId').optional().isUUID().withMessage('Lead instructor ID must be valid UUID'),
  body('coInstructors').optional().isArray().withMessage('Co-instructors must be an array'),
  body('teachingAssistants').optional().isArray().withMessage('Teaching assistants must be an array'),
  body('supportStaff').optional().isArray().withMessage('Support staff must be an array'),
  body('courseMaterialsUrl').optional().isURL().withMessage('Course materials URL must be valid'),
  body('resourceLinks').optional().isObject().withMessage('Resource links must be an object'),
  body('requiredSoftware').optional().isArray().withMessage('Required software must be an array'),
  body('materialDistributionMethod').optional().isString().trim().withMessage('Material distribution method must be a string'),
  body('assessmentSchedule').optional().isObject().withMessage('Assessment schedule must be an object'),
  body('projectDeadlines').optional().isObject().withMessage('Project deadlines must be an object'),
  body('evaluationCriteria').optional().isObject().withMessage('Evaluation criteria must be an object'),
  body('registrationOpens').optional().isISO8601().withMessage('Valid registration opens date is required'),
  body('registrationCloses').optional().isISO8601().withMessage('Valid registration closes date is required'),
  body('internalNotes').optional().isString().trim().withMessage('Internal notes must be a string'),
  body('specialRequirements').optional().isArray().withMessage('Special requirements must be an array')
], validate, trainingCenterController.createTrainingSession);

/**
 * Get training sessions
 * GET /api/v1/training/sessions
 */
router.get('/sessions', [
  query('programId').optional().isUUID().withMessage('Program ID must be valid UUID'),
  query('centerId').optional().isUUID().withMessage('Center ID must be valid UUID'),
  query('status').optional().isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'postponed']).withMessage('Invalid status'),
  query('leadInstructorId').optional().isUUID().withMessage('Lead instructor ID must be valid UUID'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be valid ISO date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be valid ISO date'),
  query('registrationOpen').optional().isBoolean().withMessage('Registration open must be boolean'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, trainingCenterController.getTrainingSessions);

/**
 * Get training session details
 * GET /api/v1/training/sessions/:sessionId
 */
router.get('/sessions/:sessionId', [
  param('sessionId').isUUID().withMessage('Valid session ID is required')
], validate, trainingCenterController.getTrainingSession);

// ====================================
// TRAINING ENROLLMENTS MANAGEMENT
// ====================================

/**
 * Create enrollment
 * POST /api/v1/training/enrollments
 */
router.post('/enrollments', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator', 'student', 'teacher', 'parent']),
  body('sessionId').isUUID().withMessage('Valid session ID is required'),
  body('participantId').isUUID().withMessage('Valid participant ID is required'),
  body('enrollmentType').optional().isIn(['individual', 'corporate', 'scholarship', 'free', 'group']).withMessage('Invalid enrollment type'),
  body('participantType').optional().isIn(['student', 'teacher', 'parent', 'external', 'employee']).withMessage('Invalid participant type'),
  body('organization').optional().isString().trim().withMessage('Organization must be a string'),
  body('jobTitle').optional().isString().trim().withMessage('Job title must be a string'),
  body('experienceLevel').optional().isString().trim().withMessage('Experience level must be a string'),
  body('emergencyContactName').optional().isString().trim().withMessage('Emergency contact name must be a string'),
  body('emergencyContactPhone').optional().isString().trim().withMessage('Emergency contact phone must be a string'),
  body('emergencyContactRelationship').optional().isString().trim().withMessage('Emergency contact relationship must be a string'),
  body('dietaryRestrictions').optional().isString().trim().withMessage('Dietary restrictions must be a string'),
  body('accessibilityNeeds').optional().isString().trim().withMessage('Accessibility needs must be a string'),
  body('specialAccommodations').optional().isString().trim().withMessage('Special accommodations must be a string'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('paymentMethod').optional().isString().trim().withMessage('Payment method must be a string'),
  body('discountApplied').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount applied must be between 0 and 100'),
  body('discountReason').optional().isString().trim().withMessage('Discount reason must be a string'),
  body('registrationSource').optional().isString().trim().withMessage('Registration source must be a string'),
  body('referralCode').optional().isString().trim().withMessage('Referral code must be a string'),
  body('marketingSource').optional().isString().trim().withMessage('Marketing source must be a string'),
  body('internalNotes').optional().isString().trim().withMessage('Internal notes must be a string')
], validate, trainingCenterController.createEnrollment);

/**
 * Get enrollments
 * GET /api/v1/training/enrollments
 */
router.get('/enrollments', [
  query('sessionId').optional().isUUID().withMessage('Session ID must be valid UUID'),
  query('participantId').optional().isUUID().withMessage('Participant ID must be valid UUID'),
  query('enrollmentStatus').optional().isIn(['registered', 'confirmed', 'waitlisted', 'attended', 'completed', 'dropped', 'no_show', 'cancelled']).withMessage('Invalid enrollment status'),
  query('paymentStatus').optional().isIn(['pending', 'partial', 'completed', 'refunded', 'waived']).withMessage('Invalid payment status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
], validate, trainingCenterController.getEnrollments);

// ====================================
// TRAINING INSTRUCTORS MANAGEMENT
// ====================================

/**
 * Create instructor profile
 * POST /api/v1/training/instructors
 */
router.post('/instructors', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator']),
  body('userId').isUUID().withMessage('Valid user ID is required'),
  body('instructorCode').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Instructor code is required (1-20 characters)'),
  body('instructorType').optional().isIn(['employee', 'freelance', 'contractor', 'volunteer', 'guest']).withMessage('Invalid instructor type'),
  body('specializations').isArray({ min: 1 }).withMessage('Specializations array is required'),
  body('educationBackground').optional().isArray().withMessage('Education background must be an array'),
  body('certifications').optional().isArray().withMessage('Certifications must be an array'),
  body('yearsExperience').isInt({ min: 0 }).withMessage('Years experience must be a non-negative integer'),
  body('industryExperience').optional().isArray().withMessage('Industry experience must be an array'),
  body('teachingExperienceYears').optional().isInt({ min: 0 }).withMessage('Teaching experience years must be a non-negative integer'),
  body('preferredSubjects').optional().isArray().withMessage('Preferred subjects must be an array'),
  body('teachingMethods').optional().isArray().withMessage('Teaching methods must be an array'),
  body('languagesSpoken').optional().isArray().withMessage('Languages spoken must be an array'),
  body('maxClassSize').optional().isInt({ min: 1 }).withMessage('Max class size must be a positive integer'),
  body('availabilitySchedule').optional().isObject().withMessage('Availability schedule must be an object'),
  body('timeZone').optional().isString().trim().withMessage('Time zone must be a string'),
  body('travelWilling').optional().isBoolean().withMessage('Travel willing must be boolean'),
  body('virtualTeachingCapable').optional().isBoolean().withMessage('Virtual teaching capable must be boolean'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number'),
  body('dailyRate').optional().isFloat({ min: 0 }).withMessage('Daily rate must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
  body('paymentTerms').optional().isString().trim().withMessage('Payment terms must be a string'),
  body('hasOwnEquipment').optional().isBoolean().withMessage('Has own equipment must be boolean'),
  body('equipmentList').optional().isArray().withMessage('Equipment list must be an array'),
  body('technicalRequirements').optional().isArray().withMessage('Technical requirements must be an array'),
  body('contractType').optional().isString().trim().withMessage('Contract type must be a string'),
  body('contractStartDate').optional().isISO8601().withMessage('Valid contract start date is required'),
  body('contractEndDate').optional().isISO8601().withMessage('Valid contract end date is required'),
  body('bio').optional().isString().trim().withMessage('Bio must be a string'),
  body('profileImageUrl').optional().isURL().withMessage('Profile image URL must be valid'),
  body('linkedinUrl').optional().isURL().withMessage('LinkedIn URL must be valid'),
  body('websiteUrl').optional().isURL().withMessage('Website URL must be valid'),
  body('portfolioUrl').optional().isURL().withMessage('Portfolio URL must be valid')
], validate, trainingCenterController.createInstructor);

/**
 * Get instructors
 * GET /api/v1/training/instructors
 */
router.get('/instructors', [
  query('instructorType').optional().isIn(['employee', 'freelance', 'contractor', 'volunteer', 'guest']).withMessage('Invalid instructor type'),
  query('specialization').optional().isString().trim().withMessage('Specialization must be a string'),
  query('virtualCapable').optional().isBoolean().withMessage('Virtual capable must be boolean'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], validate, trainingCenterController.getInstructors);

// ====================================
// ANALYTICS AND REPORTS
// ====================================

/**
 * Get training center analytics
 * GET /api/v1/training/analytics
 */
router.get('/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator']),
  query('centerId').optional().isUUID().withMessage('Center ID must be valid UUID'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
], validate, trainingCenterController.getTrainingCenterAnalytics);

/**
 * Get instructor analytics
 * GET /api/v1/training/instructors/:instructorId/analytics
 */
router.get('/instructors/:instructorId/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator', 'instructor']),
  param('instructorId').isUUID().withMessage('Valid instructor ID is required')
], validate, trainingCenterController.getInstructorAnalytics);

/**
 * Get training dashboard
 * GET /api/v1/training/dashboard
 */
router.get('/dashboard', [
  requireRole(['super_admin', 'edufam_admin', 'training_coordinator']),
  query('timeframe').optional().isIn(['7days', '30days', '90days']).withMessage('Invalid timeframe')
], validate, trainingCenterController.getTrainingDashboard);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Training service health check
 * GET /api/v1/training/health
 */
router.get('/health', trainingCenterController.getTrainingServiceHealth);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for training routes
router.use((error, req, res, next) => {
  console.error('Training route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'TRAINING_ERROR',
      message: error.message || 'An error occurred in training management'
    }
  });
});

module.exports = router;