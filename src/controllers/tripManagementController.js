const tripManagementService = require('../services/tripManagementService');
const realtimeIntegrations = require('../integrations/realtimeIntegrations');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Trip Management Controller
 * Handles company-managed academic trip programs
 */
class TripManagementController {

  /**
   * Trip Program Management
   */

  // Create new trip program
  createTripProgram = asyncHandler(async (req, res) => {
    const {
      programName,
      programType,
      targetCurriculum,
      learningObjectives,
      skillsDeveloped,
      subjectAreas,
      destinationCountry,
      destinationCity,
      destinations,
      durationDays,
      maxParticipants,
      minParticipants,
      minAge,
      maxAge,
      targetGrades,
      baseCost,
      currency,
      costIncludes,
      costExcludes,
      transportationMode,
      accommodationType,
      mealPlan,
      safetyRating,
      insuranceRequired,
      passportRequired,
      visaRequired,
      tripLeaderId,
      registrationOpens,
      registrationCloses,
      tripStartDate,
      tripEndDate,
      marketingDescription,
      highlights
    } = req.body;

    // Validate required fields
    if (!programName || !programType || !destinationCountry || !destinationCity || !durationDays || !maxParticipants || !baseCost) {
      throw new ValidationError('Program name, type, destination, duration, participants, and cost are required');
    }

    // Generate unique program code
    const programCode = await tripManagementService.generateProgramCode(programType);

    const program = await tripManagementService.createTripProgram({
      programName,
      programCode,
      programType,
      targetCurriculum,
      learningObjectives,
      skillsDeveloped,
      subjectAreas,
      destinationCountry,
      destinationCity,
      destinations,
      durationDays,
      maxParticipants,
      minParticipants,
      minAge,
      maxAge,
      targetGrades,
      baseCost,
      currency,
      costIncludes,
      costExcludes,
      transportationMode,
      accommodationType,
      mealPlan,
      safetyRating,
      insuranceRequired,
      passportRequired,
      visaRequired,
      tripLeaderId,
      registrationOpens,
      registrationCloses,
      tripStartDate,
      tripEndDate,
      marketingDescription,
      highlights,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { program },
      message: 'Trip program created successfully'
    });
  });

  // Get trip program details
  getTripProgram = asyncHandler(async (req, res) => {
    const { programId } = req.params;
    
    const program = await tripManagementService.getTripProgram(programId);

    res.json({
      success: true,
      data: { program },
      message: 'Trip program details retrieved successfully'
    });
  });

  // Update trip program
  updateTripProgram = asyncHandler(async (req, res) => {
    const { programId } = req.params;
    const updateData = req.body;

    const program = await tripManagementService.updateTripProgram(programId, updateData);

    res.json({
      success: true,
      data: { program },
      message: 'Trip program updated successfully'
    });
  });

  // Get trip programs list
  getTripPrograms = asyncHandler(async (req, res) => {
    const filters = {
      programType: req.query.programType,
      destinationCountry: req.query.destinationCountry,
      programStatus: req.query.programStatus,
      curriculum: req.query.curriculum,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const programs = await tripManagementService.getTripPrograms(filters);

    res.json({
      success: true,
      data: {
        programs,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: programs.length === filters.limit
        }
      },
      message: 'Trip programs retrieved successfully'
    });
  });

  // Publish trip program (make available for registration)
  publishTripProgram = asyncHandler(async (req, res) => {
    const { programId } = req.params;

    const program = await tripManagementService.updateTripProgram(programId, {
      programStatus: 'published'
    });

    // Send notification to all schools about new trip program
    try {
      await realtimeIntegrations.createCustomEvent({
        eventType: 'trip_program_published',
        schoolId: null, // Global event for all schools
        sourceUserId: req.user.userId,
        targetRoles: ['principal', 'school_director', 'trip_coordinator'],
        title: `New Trip Program: ${program.program_name}`,
        message: `A new educational trip to ${program.destination_city}, ${program.destination_country} is now available for registration`,
        eventPayload: {
          programId: program.id,
          programName: program.program_name,
          destination: `${program.destination_city}, ${program.destination_country}`,
          duration: program.duration_days,
          cost: program.base_cost,
          registrationOpens: program.registration_opens
        },
        priority: 'normal',
        sourceEntityType: 'trip_program',
        sourceEntityId: program.id,
        actionUrl: `/trips/programs/${program.id}`
      });
    } catch (error) {
      console.error('Failed to send trip program notification:', error);
    }

    res.json({
      success: true,
      data: { program },
      message: 'Trip program published successfully'
    });
  });

  // Open registration for trip program
  openRegistration = asyncHandler(async (req, res) => {
    const { programId } = req.params;

    const program = await tripManagementService.updateTripProgram(programId, {
      programStatus: 'open_registration'
    });

    res.json({
      success: true,
      data: { program },
      message: 'Trip registration opened successfully'
    });
  });

  // Close registration for trip program
  closeRegistration = asyncHandler(async (req, res) => {
    const { programId } = req.params;

    const program = await tripManagementService.updateTripProgram(programId, {
      programStatus: 'closed'
    });

    res.json({
      success: true,
      data: { program },
      message: 'Trip registration closed successfully'
    });
  });

  /**
   * Trip Registration Management
   */

  // Register student for trip
  registerStudent = asyncHandler(async (req, res) => {
    const { programId } = req.params;
    const {
      studentId,
      schoolId,
      parentGuardianId,
      medicalConditions,
      dietaryRestrictions,
      specialNeeds,
      passportNumber,
      passportExpiry,
      preferredContactMethod,
      emergencyContactAbroad
    } = req.body;

    if (!studentId || !schoolId) {
      throw new ValidationError('Student ID and school ID are required');
    }

    // Get program details for cost calculation
    const program = await tripManagementService.getTripProgram(programId);
    const totalAmount = program.base_cost;

    const registration = await tripManagementService.registerStudentForTrip({
      tripProgramId: programId,
      studentId,
      schoolId,
      parentGuardianId,
      totalAmount,
      medicalConditions,
      dietaryRestrictions,
      specialNeeds,
      passportNumber,
      passportExpiry,
      preferredContactMethod,
      emergencyContactAbroad
    });

    // Send confirmation notification to parent/guardian
    if (parentGuardianId) {
      try {
        await realtimeIntegrations.createCustomEvent({
          eventType: 'trip_registration_created',
          schoolId: schoolId,
          sourceUserId: req.user.userId,
          targetUserIds: [parentGuardianId],
          title: 'Trip Registration Submitted',
          message: `Registration for ${program.program_name} has been submitted and is pending confirmation`,
          eventPayload: {
            registrationId: registration.id,
            programName: program.program_name,
            destination: `${program.destination_city}, ${program.destination_country}`,
            amount: totalAmount,
            status: registration.registration_status
          },
          priority: 'normal',
          sourceEntityType: 'trip_registration',
          sourceEntityId: registration.id,
          actionUrl: `/trips/registrations/${registration.id}`
        });
      } catch (error) {
        console.error('Failed to send registration notification:', error);
      }
    }

    res.status(201).json({
      success: true,
      data: { registration },
      message: 'Student registered for trip successfully'
    });
  });

  // Update registration status
  updateRegistrationStatus = asyncHandler(async (req, res) => {
    const { registrationId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'confirmed', 'waitlisted', 'cancelled'].includes(status)) {
      throw new ValidationError('Valid status is required');
    }

    const registration = await tripManagementService.updateRegistrationStatus(
      registrationId,
      status,
      req.user.userId
    );

    res.json({
      success: true,
      data: { registration },
      message: `Registration status updated to ${status}`
    });
  });

  // Get trip registrations
  getTripRegistrations = asyncHandler(async (req, res) => {
    const { programId } = req.params;
    
    const filters = {
      registrationStatus: req.query.registrationStatus,
      paymentStatus: req.query.paymentStatus,
      schoolId: req.query.schoolId,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const registrations = await tripManagementService.getTripRegistrations(programId, filters);

    res.json({
      success: true,
      data: {
        registrations,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: registrations.length === filters.limit
        }
      },
      message: 'Trip registrations retrieved successfully'
    });
  });

  // Check trip availability
  checkTripAvailability = asyncHandler(async (req, res) => {
    const { programId } = req.params;
    
    const availability = await tripManagementService.checkTripAvailability(programId);

    res.json({
      success: true,
      data: { availability },
      message: 'Trip availability checked successfully'
    });
  });

  /**
   * Trip Analytics and Reports
   */

  // Get trip program analytics
  getTripAnalytics = asyncHandler(async (req, res) => {
    const { programId } = req.params;
    
    const analytics = await tripManagementService.getTripProgramAnalytics(programId);

    res.json({
      success: true,
      data: { analytics },
      message: 'Trip program analytics retrieved successfully'
    });
  });

  // Get trip management dashboard
  getTripDashboard = asyncHandler(async (req, res) => {
    const metrics = await tripManagementService.getTripDashboardMetrics();
    const revenueAnalytics = await tripManagementService.getRevenueAnalytics(req.query.period || 'month');

    res.json({
      success: true,
      data: {
        metrics,
        revenueAnalytics,
        timestamp: new Date().toISOString()
      },
      message: 'Trip management dashboard retrieved successfully'
    });
  });

  // Get revenue analytics
  getRevenueAnalytics = asyncHandler(async (req, res) => {
    const { period } = req.query;
    
    if (period && !['week', 'month', 'year'].includes(period)) {
      throw new ValidationError('Period must be week, month, or year');
    }

    const analytics = await tripManagementService.getRevenueAnalytics(period);

    res.json({
      success: true,
      data: { analytics },
      message: 'Revenue analytics retrieved successfully'
    });
  });

  /**
   * School-Facing Endpoints
   */

  // Get available trip programs for schools
  getAvailableTripsForSchools = asyncHandler(async (req, res) => {
    const filters = {
      programStatus: 'open_registration',
      curriculum: req.query.curriculum,
      programType: req.query.programType,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const programs = await tripManagementService.getTripPrograms(filters);

    // Add availability information to each program
    const programsWithAvailability = await Promise.all(
      programs.map(async (program) => {
        try {
          const availability = await tripManagementService.checkTripAvailability(program.id);
          return { ...program, availability };
        } catch (error) {
          return { ...program, availability: null };
        }
      })
    );

    res.json({
      success: true,
      data: {
        programs: programsWithAvailability,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: programs.length === filters.limit
        }
      },
      message: 'Available trip programs retrieved successfully'
    });
  });

  // Get school's trip registrations
  getSchoolTripRegistrations = asyncHandler(async (req, res) => {
    const schoolId = req.activeSchoolId || req.user.schoolId;
    
    const filters = {
      schoolId: schoolId,
      registrationStatus: req.query.registrationStatus,
      paymentStatus: req.query.paymentStatus,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Get all registrations for this school across all programs
    const registrations = await tripManagementService.query(`
      SELECT 
        tr.*,
        tp.program_name,
        tp.destination_city,
        tp.destination_country,
        tp.trip_start_date,
        tp.trip_end_date,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.grade_level
      FROM admin_trip_registrations tr
      JOIN admin_trip_programs tp ON tp.id = tr.trip_program_id
      JOIN students s ON s.id = tr.student_id
      WHERE tr.school_id = $1
        AND ($2::VARCHAR IS NULL OR tr.registration_status = $2)
        AND ($3::VARCHAR IS NULL OR tr.payment_status = $3)
      ORDER BY tr.registration_date DESC
      LIMIT $4 OFFSET $5
    `, [
      schoolId,
      filters.registrationStatus || null,
      filters.paymentStatus || null,
      filters.limit,
      (filters.page - 1) * filters.limit
    ]);

    res.json({
      success: true,
      data: {
        registrations: registrations.rows,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: registrations.rows.length === filters.limit
        }
      },
      message: 'School trip registrations retrieved successfully'
    });
  });

  /**
   * Health Check and Info
   */

  // Get trip management service health
  getTripServiceHealth = asyncHandler(async (req, res) => {
    const metrics = await tripManagementService.getTripDashboardMetrics();

    res.json({
      success: true,
      data: {
        service: 'Trip Management Service',
        status: 'healthy',
        features: [
          'trip_program_management',
          'student_registration',
          'payment_tracking',
          'analytics_reporting',
          'real_time_notifications',
          'availability_checking'
        ],
        metrics: {
          totalPrograms: metrics.published_programs + metrics.open_registration_programs,
          activeRegistrations: metrics.confirmed_registrations,
          totalRevenue: metrics.total_revenue
        },
        timestamp: new Date().toISOString()
      },
      message: 'Trip management service health check completed'
    });
  });
}

module.exports = new TripManagementController();