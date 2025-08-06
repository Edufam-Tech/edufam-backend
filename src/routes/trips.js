const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const TripsController = require('../controllers/tripsController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType('school_user'));

// =============================================================================
// TRIP TYPE ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/types
 * @desc    Create a new trip type
 * @access  Private (Principal, School Director)
 */
router.post('/types',
  requireRole(['principal', 'school_director']),
  TripsController.createTripType
);

/**
 * @route   GET /api/trips/types
 * @desc    Get all trip types
 * @access  Private (All school staff)
 */
router.get('/types',
  TripsController.getTripTypes
);

// =============================================================================
// TRIP MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/trips
 * @desc    Create a new trip
 * @access  Private (Principal, School Director, Teacher)
 */
router.post('/',
  requireRole(['principal', 'school_director', 'teacher']),
  TripsController.createTrip
);

/**
 * @route   GET /api/trips
 * @desc    Get all trips with filtering
 * @access  Private (All school users)
 */
router.get('/',
  TripsController.getTrips
);

/**
 * @route   GET /api/trips/upcoming
 * @desc    Get upcoming trips
 * @access  Private (All school users)
 */
router.get('/upcoming',
  TripsController.getUpcomingTrips
);

/**
 * @route   GET /api/trips/:id
 * @desc    Get trip details
 * @access  Private (All school users)
 */
router.get('/:id',
  TripsController.getTripDetails
);

/**
 * @route   PUT /api/trips/:id
 * @desc    Update a trip
 * @access  Private (Principal, School Director, Trip Creator)
 */
router.put('/:id',
  requireRole(['principal', 'school_director', 'teacher']),
  TripsController.updateTrip
);

/**
 * @route   DELETE /api/trips/:id
 * @desc    Cancel a trip
 * @access  Private (Principal, School Director)
 */
router.delete('/:id',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { NotFoundError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const result = await query(`
        UPDATE trips 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND school_id = $2
        RETURNING *
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Trip not found');
      }

      res.json({
        success: true,
        message: 'Trip cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// PARTICIPANT MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/:id/participants
 * @desc    Add participants to a trip
 * @access  Private (Principal, School Director, Teacher)
 */
router.post('/:id/participants',
  requireRole(['principal', 'school_director', 'teacher']),
  TripsController.addParticipants
);

/**
 * @route   GET /api/trips/:id/participants
 * @desc    Get trip participants
 * @access  Private (All school staff)
 */
router.get('/:id/participants',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { id } = req.params;
      const { participantType, registrationStatus } = req.query;

      let whereClause = 'WHERE tp.trip_id = $1';
      const params = [id];

      if (participantType) {
        whereClause += ` AND tp.participant_type = $${params.length + 1}`;
        params.push(participantType);
      }

      if (registrationStatus) {
        whereClause += ` AND tp.registration_status = $${params.length + 1}`;
        params.push(registrationStatus);
      }

      const result = await query(`
        SELECT 
          tp.*,
          CASE 
            WHEN tp.participant_type = 'student' THEN s.first_name || ' ' || s.last_name
            WHEN tp.participant_type = 'teacher' THEN st.first_name || ' ' || st.last_name
            ELSE u.first_name || ' ' || u.last_name
          END as participant_name,
          CASE 
            WHEN tp.participant_type = 'student' THEN c.class_name
            ELSE NULL
          END as class_name
        FROM trip_participants tp
        LEFT JOIN students s ON tp.participant_id = s.id AND tp.participant_type = 'student'
        LEFT JOIN staff st ON tp.participant_id = st.id AND tp.participant_type = 'teacher'
        LEFT JOIN users u ON tp.participant_id = u.id
        LEFT JOIN classes c ON s.class_id = c.id
        ${whereClause}
        ORDER BY tp.participant_type, participant_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/trips/:id/participants/:participantId
 * @desc    Remove participant from trip
 * @access  Private (Principal, School Director, Teacher)
 */
router.delete('/:id/participants/:participantId',
  requireRole(['principal', 'school_director', 'teacher']),
  TripsController.removeParticipant
);

// =============================================================================
// PERMISSION MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/permissions
 * @desc    Request permission for student trip
 * @access  Private (Parents for their children, Staff for any student)
 */
router.post('/permissions',
  TripsController.requestPermission
);

/**
 * @route   GET /api/trips/:tripId/permissions
 * @desc    Get all permissions for a trip
 * @access  Private (School staff)
 */
router.get('/:tripId/permissions',
  requireRole(['principal', 'school_director', 'teacher']),
  TripsController.getTripPermissions
);

/**
 * @route   GET /api/trips/:tripId/permissions/:studentId
 * @desc    Get permission status for specific student
 * @access  Private (All school users)
 */
router.get('/:tripId/permissions/:studentId',
  TripsController.getPermissionStatus
);

/**
 * @route   PUT /api/trips/permissions/:id/approve
 * @desc    Approve a permission request
 * @access  Private (Principal, School Director)
 */
router.put('/permissions/:id/approve',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { NotFoundError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const result = await query(`
        UPDATE trip_permissions 
        SET permission_granted = true, permission_date = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Permission request not found');
      }

      res.json({
        success: true,
        message: 'Permission approved successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// ITINERARY MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/:id/itinerary
 * @desc    Create or update trip itinerary
 * @access  Private (Principal, School Director, Teacher)
 */
router.post('/:id/itinerary',
  requireRole(['principal', 'school_director', 'teacher']),
  TripsController.createItinerary
);

/**
 * @route   GET /api/trips/:id/itinerary
 * @desc    Get trip itinerary
 * @access  Private (All school users)
 */
router.get('/:id/itinerary',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { id } = req.params;

      const result = await query(`
        SELECT *
        FROM trip_itineraries
        WHERE trip_id = $1
        ORDER BY day_number, start_time
      `, [id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// EXPENSE MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/:id/expenses
 * @desc    Add expense to trip
 * @access  Private (Principal, School Director, Finance)
 */
router.post('/:id/expenses',
  requireRole(['principal', 'school_director', 'finance']),
  TripsController.addExpense
);

/**
 * @route   GET /api/trips/:id/expenses
 * @desc    Get trip expenses
 * @access  Private (Principal, School Director, Finance)
 */
router.get('/:id/expenses',
  requireRole(['principal', 'school_director', 'finance']),
  TripsController.getTripExpenses
);

/**
 * @route   PUT /api/trips/expenses/:expenseId/payment
 * @desc    Record expense payment
 * @access  Private (Principal, School Director, Finance)
 */
router.put('/expenses/:expenseId/payment',
  requireRole(['principal', 'school_director', 'finance']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
      const { expenseId } = req.params;
      const { paymentStatus, paymentDate } = req.body;

      if (!paymentStatus) {
        throw new ValidationError('Payment status is required');
      }

      const result = await query(`
        UPDATE trip_expenses 
        SET payment_status = $1, payment_date = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [paymentStatus, paymentDate, expenseId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Expense not found');
      }

      res.json({
        success: true,
        message: 'Expense payment status updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// SAFETY MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/:id/safety-measures
 * @desc    Add safety measure to trip
 * @access  Private (Principal, School Director, Teacher)
 */
router.post('/:id/safety-measures',
  requireRole(['principal', 'school_director', 'teacher']),
  TripsController.addSafetyMeasure
);

/**
 * @route   GET /api/trips/:id/safety-info
 * @desc    Get trip safety information
 * @access  Private (All school users)
 */
router.get('/:id/safety-info',
  TripsController.getSafetyInfo
);

/**
 * @route   PUT /api/trips/safety-measures/:measureId/verify
 * @desc    Verify safety measure implementation
 * @access  Private (Principal, School Director)
 */
router.put('/safety-measures/:measureId/verify',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { NotFoundError } = require('../middleware/errorHandler');
      const { measureId } = req.params;

      const result = await query(`
        UPDATE trip_safety_measures 
        SET is_implemented = true, 
            implementation_date = CURRENT_DATE,
            verified_by = $1,
            verification_date = CURRENT_DATE
        WHERE id = $2
        RETURNING *
      `, [req.user.userId, measureId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Safety measure not found');
      }

      res.json({
        success: true,
        message: 'Safety measure verified successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// MEDICAL INFORMATION ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/:id/medical-info
 * @desc    Submit medical information for trip participant
 * @access  Private (Participants or their guardians)
 */
router.post('/:id/medical-info',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError } = require('../middleware/errorHandler');
      const { id } = req.params;

      const {
        participantId,
        medicalConditions,
        allergies,
        medications,
        medicalEmergencyContacts = [],
        doctorName,
        doctorPhone,
        insuranceProvider,
        insurancePolicyNumber,
        mobilityRequirements,
        dietaryRestrictions,
        otherRequirements,
        medicalClearanceRequired = false
      } = req.body;

      if (!participantId) {
        throw new ValidationError('Participant ID is required');
      }

      const result = await query(`
        INSERT INTO trip_medical_info (
          trip_id, participant_id, medical_conditions, allergies, medications,
          medical_emergency_contacts, doctor_name, doctor_phone, insurance_provider,
          insurance_policy_number, mobility_requirements, dietary_restrictions,
          other_requirements, medical_clearance_required, last_updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (trip_id, participant_id) 
        DO UPDATE SET 
          medical_conditions = EXCLUDED.medical_conditions,
          allergies = EXCLUDED.allergies,
          medications = EXCLUDED.medications,
          medical_emergency_contacts = EXCLUDED.medical_emergency_contacts,
          doctor_name = EXCLUDED.doctor_name,
          doctor_phone = EXCLUDED.doctor_phone,
          insurance_provider = EXCLUDED.insurance_provider,
          insurance_policy_number = EXCLUDED.insurance_policy_number,
          mobility_requirements = EXCLUDED.mobility_requirements,
          dietary_restrictions = EXCLUDED.dietary_restrictions,
          other_requirements = EXCLUDED.other_requirements,
          medical_clearance_required = EXCLUDED.medical_clearance_required,
          last_updated_by = EXCLUDED.last_updated_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        id, participantId, medicalConditions, allergies, medications,
        JSON.stringify(medicalEmergencyContacts), doctorName, doctorPhone,
        insuranceProvider, insurancePolicyNumber, mobilityRequirements,
        dietaryRestrictions, otherRequirements, medicalClearanceRequired,
        req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Medical information saved successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/trips/:id/medical-info
 * @desc    Get medical information for trip participants
 * @access  Private (Principal, School Director, Trip Leaders, Nurses)
 */
router.get('/:id/medical-info',
  requireRole(['principal', 'school_director', 'teacher', 'nurse']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { id } = req.params;

      const result = await query(`
        SELECT 
          tmi.*,
          CASE 
            WHEN tp.participant_type = 'student' THEN s.first_name || ' ' || s.last_name
            ELSE st.first_name || ' ' || st.last_name
          END as participant_name,
          tp.participant_type
        FROM trip_medical_info tmi
        JOIN trip_participants tp ON tmi.participant_id = tp.participant_id AND tmi.trip_id = tp.trip_id
        LEFT JOIN students s ON tp.participant_id = s.id AND tp.participant_type = 'student'
        LEFT JOIN staff st ON tp.participant_id = st.id AND tp.participant_type = 'teacher'
        WHERE tmi.trip_id = $1
        ORDER BY participant_name
      `, [id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// FEEDBACK ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/:id/feedback
 * @desc    Submit trip feedback
 * @access  Private (Trip participants)
 */
router.post('/:id/feedback',
  TripsController.submitFeedback
);

/**
 * @route   GET /api/trips/:id/feedback
 * @desc    Get trip feedback
 * @access  Private (Principal, School Director, Teacher)
 */
router.get('/:id/feedback',
  requireRole(['principal', 'school_director', 'teacher']),
  TripsController.getTripFeedback
);

// =============================================================================
// VENDOR MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/trips/vendors
 * @desc    Add trip vendor
 * @access  Private (Principal, School Director)
 */
router.post('/vendors',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { ValidationError } = require('../middleware/errorHandler');

      const {
        vendorName,
        vendorType,
        contactPerson,
        phone,
        email,
        address,
        website,
        servicesOffered = [],
        coverageAreas = [],
        licenseNumber,
        insuranceValidUntil,
        certifications = []
      } = req.body;

      if (!vendorName || !vendorType) {
        throw new ValidationError('Vendor name and type are required');
      }

      const result = await query(`
        INSERT INTO trip_vendors (
          school_id, vendor_name, vendor_type, contact_person, phone, email,
          address, website, services_offered, coverage_areas, license_number,
          insurance_valid_until, certifications
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        req.user.schoolId, vendorName, vendorType, contactPerson, phone, email,
        address, website, JSON.stringify(servicesOffered), JSON.stringify(coverageAreas),
        licenseNumber, insuranceValidUntil, JSON.stringify(certifications)
      ]);

      res.status(201).json({
        success: true,
        message: 'Vendor added successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/trips/vendors
 * @desc    Get trip vendors
 * @access  Private (All school staff)
 */
router.get('/vendors',
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const { vendorType, isActive, isPreferred } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (vendorType) {
        whereClause += ` AND vendor_type = $${params.length + 1}`;
        params.push(vendorType);
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (isPreferred !== undefined) {
        whereClause += ` AND is_preferred = $${params.length + 1}`;
        params.push(isPreferred === 'true');
      }

      const result = await query(`
        SELECT *
        FROM trip_vendors 
        ${whereClause}
        ORDER BY is_preferred DESC, vendor_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;