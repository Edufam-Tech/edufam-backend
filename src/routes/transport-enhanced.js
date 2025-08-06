const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const TransportController = require('../controllers/transportController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType(['school_user', 'admin_user']));

// =============================================================================
// FLEET MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/transport/vehicles
 * @desc    Get vehicles
 * @access  Private (Transport Manager, Principal, School Director)
 */
router.get('/vehicles',
  requireRole(['transport_manager', 'principal', 'school_director', 'super_admin']),
  query('status').optional().isIn(['active', 'maintenance', 'retired', 'all']).withMessage('Invalid status'),
  query('vehicleType').optional().isIn(['bus', 'van', 'car', 'truck']).withMessage('Invalid vehicle type'),
  validate,
  TransportController.getVehicles
);

/**
 * @route   POST /api/transport/vehicles
 * @desc    Register new vehicle
 * @access  Private (Transport Manager, Principal, School Director)
 */
router.post('/vehicles',
  requireRole(['transport_manager', 'principal', 'school_director', 'super_admin']),
  body('vehicleNumber').notEmpty().withMessage('Vehicle number is required'),
  body('vehicleType').isIn(['bus', 'van', 'car', 'truck']).withMessage('Invalid vehicle type'),
  body('make').notEmpty().withMessage('Vehicle make is required'),
  body('model').notEmpty().withMessage('Vehicle model is required'),
  body('year').isInt({ min: 1990, max: 2030 }).withMessage('Year must be between 1990 and 2030'),
  body('capacity').isInt({ min: 1, max: 100 }).withMessage('Capacity must be between 1 and 100'),
  validate,
  TransportController.registerVehicle
);

// =============================================================================
// ROUTE MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/transport/routes
 * @desc    Get transport routes
 * @access  Private (All users)
 */
router.get('/routes',
  query('active').optional().isBoolean().withMessage('Active must be boolean'),
  validate,
  TransportController.getRoutes
);

/**
 * @route   POST /api/transport/routes
 * @desc    Create transport route
 * @access  Private (Transport Manager, Principal, School Director)
 */
router.post('/routes',
  requireRole(['transport_manager', 'principal', 'school_director', 'super_admin']),
  body('routeName').notEmpty().withMessage('Route name is required'),
  body('stops').isArray({ min: 2 }).withMessage('At least 2 stops are required'),
  body('routeFee').isFloat({ min: 0 }).withMessage('Route fee must be positive'),
  validate,
  TransportController.createRoute
);

// =============================================================================
// DRIVER MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/transport/drivers
 * @desc    Get drivers
 * @access  Private (Transport Manager, Principal, School Director)
 */
router.get('/drivers',
  requireRole(['transport_manager', 'principal', 'school_director', 'super_admin']),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'all']).withMessage('Invalid status'),
  validate,
  TransportController.getDrivers
);

/**
 * @route   POST /api/transport/drivers
 * @desc    Register new driver
 * @access  Private (Transport Manager, Principal, School Director)
 */
router.post('/drivers',
  requireRole(['transport_manager', 'principal', 'school_director', 'super_admin']),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('licenseNumber').notEmpty().withMessage('License number is required'),
  validate,
  TransportController.registerDriver
);

// =============================================================================
// STUDENT ASSIGNMENTS
// =============================================================================

/**
 * @route   GET /api/transport/student-assignments
 * @desc    Get student route assignments
 * @access  Private (All users)
 */
router.get('/student-assignments',
  query('studentId').optional().isUUID().withMessage('Student ID must be valid UUID'),
  validate,
  TransportController.getStudentAssignments
);

/**
 * @route   POST /api/transport/student-assignments
 * @desc    Assign student to route
 * @access  Private (Transport Manager, Principal, School Director)
 */
router.post('/student-assignments',
  requireRole(['transport_manager', 'principal', 'school_director', 'super_admin']),
  body('studentId').isUUID().withMessage('Student ID is required'),
  body('routeId').isUUID().withMessage('Route ID is required'),
  body('monthlyFee').isFloat({ min: 0 }).withMessage('Monthly fee must be positive'),
  validate,
  TransportController.assignStudentToRoute
);

// =============================================================================
// REAL-TIME TRACKING
// =============================================================================

/**
 * @route   GET /api/transport/tracking/vehicles/:vehicleId
 * @desc    Get real-time vehicle location
 * @access  Private (All users)
 */
router.get('/tracking/vehicles/:vehicleId',
  param('vehicleId').isUUID().withMessage('Vehicle ID must be valid UUID'),
  TransportController.getVehicleLocation
);

/**
 * @route   POST /api/transport/tracking/location-update
 * @desc    Update vehicle location
 * @access  Private (GPS Device/Driver App)
 */
router.post('/tracking/location-update',
  body('vehicleId').isUUID().withMessage('Vehicle ID is required'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  validate,
  TransportController.updateVehicleLocation
);

module.exports = router;