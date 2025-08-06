const trainingCenterService = require('../services/trainingCenterService');
const realtimeIntegrations = require('../integrations/realtimeIntegrations');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Training Center Controller
 * Handles training center operations, workshop management, and instructor coordination
 */
class TrainingCenterController {

  /**
   * Training Centers Management
   */

  // Create training center
  createTrainingCenter = asyncHandler(async (req, res) => {
    const {
      centerName,
      centerCode,
      centerType,
      description,
      address,
      city,
      stateProvince,
      country,
      postalCode,
      coordinates,
      phone,
      email,
      websiteUrl,
      maxCapacity,
      classroomCount,
      computerLabCount,
      hasProjector,
      hasWifi,
      hasParking,
      accessibilityFeatures,
      virtualPlatform,
      platformSettings,
      virtualRoomCapacity,
      operatingHours,
      timeZone,
      centerManagerId,
      backupManagerId,
      hourlyRate,
      dailyRate,
      currency,
      certificationStatus,
      certifyingBody
    } = req.body;

    // Validate required fields
    if (!centerName || !centerCode || !centerType || !maxCapacity) {
      throw new ValidationError('Center name, code, type, and max capacity are required');
    }

    const center = await trainingCenterService.createTrainingCenter({
      centerName,
      centerCode,
      centerType,
      description,
      address,
      city,
      stateProvince,
      country,
      postalCode,
      coordinates,
      phone,
      email,
      websiteUrl,
      maxCapacity,
      classroomCount,
      computerLabCount,
      hasProjector,
      hasWifi,
      hasParking,
      accessibilityFeatures,
      virtualPlatform,
      platformSettings,
      virtualRoomCapacity,
      operatingHours,
      timeZone,
      centerManagerId,
      backupManagerId,
      hourlyRate,
      dailyRate,
      currency,
      certificationStatus,
      certifyingBody,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { center },
      message: 'Training center created successfully'
    });
  });

  // Get training centers
  getTrainingCenters = asyncHandler(async (req, res) => {
    const filters = {
      centerType: req.query.centerType,
      status: req.query.status,
      city: req.query.city,
      country: req.query.country,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const centers = await trainingCenterService.getTrainingCenters(filters);

    res.json({
      success: true,
      data: {
        centers,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: centers.length === filters.limit
        }
      },
      message: 'Training centers retrieved successfully'
    });
  });

  // Get training center details
  getTrainingCenter = asyncHandler(async (req, res) => {
    const { centerId } = req.params;
    
    const centers = await trainingCenterService.getTrainingCenters({ 
      centerId: centerId,
      limit: 1 
    });

    if (centers.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CENTER_NOT_FOUND',
          message: 'Training center not found'
        }
      });
    }

    res.json({
      success: true,
      data: { center: centers[0] },
      message: 'Training center details retrieved successfully'
    });
  });

  /**
   * Training Programs Management
   */

  // Create training program
  createTrainingProgram = asyncHandler(async (req, res) => {
    const {
      programName,
      programCode,
      programType,
      category,
      subcategory,
      description,
      learningObjectives,
      prerequisites,
      targetAudience,
      durationDays,
      durationHours,
      sessionCount,
      difficultyLevel,
      minAge,
      maxParticipants,
      minParticipants,
      providesCertificate,
      certificateType,
      certificateValidityMonths,
      continuingEducationCredits,
      basePrice,
      currency,
      earlyBirdDiscount,
      groupDiscountThreshold,
      groupDiscountRate,
      materialsIncluded,
      requiredMaterials,
      softwareRequirements,
      hardwareRequirements,
      deliveryMethod,
      platformRequirements,
      curriculumOutline,
      assessmentMethods,
      practicalComponents,
      projectBased,
      featuredImageUrl,
      promotionalVideoUrl,
      marketingHighlights
    } = req.body;

    // Validate required fields
    if (!programName || !programCode || !programType || !category || !description || !durationDays || !durationHours || !basePrice) {
      throw new ValidationError('Program name, code, type, category, description, duration, and price are required');
    }

    const program = await trainingCenterService.createTrainingProgram({
      programName,
      programCode,
      programType,
      category,
      subcategory,
      description,
      learningObjectives,
      prerequisites,
      targetAudience,
      durationDays,
      durationHours,
      sessionCount,
      difficultyLevel,
      minAge,
      maxParticipants,
      minParticipants,
      providesCertificate,
      certificateType,
      certificateValidityMonths,
      continuingEducationCredits,
      basePrice,
      currency,
      earlyBirdDiscount,
      groupDiscountThreshold,
      groupDiscountRate,
      materialsIncluded,
      requiredMaterials,
      softwareRequirements,
      hardwareRequirements,
      deliveryMethod,
      platformRequirements,
      curriculumOutline,
      assessmentMethods,
      practicalComponents,
      projectBased,
      featuredImageUrl,
      promotionalVideoUrl,
      marketingHighlights,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { program },
      message: 'Training program created successfully'
    });
  });

  // Get training programs
  getTrainingPrograms = asyncHandler(async (req, res) => {
    const filters = {
      category: req.query.category,
      programType: req.query.programType,
      difficultyLevel: req.query.difficultyLevel,
      deliveryMethod: req.query.deliveryMethod,
      providesCertificate: req.query.providesCertificate === 'true',
      search: req.query.search,
      featured: req.query.featured === 'true',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const programs = await trainingCenterService.getTrainingPrograms(filters);

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
      message: 'Training programs retrieved successfully'
    });
  });

  // Get training program details
  getTrainingProgram = asyncHandler(async (req, res) => {
    const { programId } = req.params;
    
    const programs = await trainingCenterService.getTrainingPrograms({ 
      programId: programId,
      limit: 1 
    });

    if (programs.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Training program not found'
        }
      });
    }

    res.json({
      success: true,
      data: { program: programs[0] },
      message: 'Training program details retrieved successfully'
    });
  });

  /**
   * Training Sessions Management
   */

  // Create training session
  createTrainingSession = asyncHandler(async (req, res) => {
    const {
      programId,
      centerId,
      sessionName,
      cohortName,
      startDate,
      endDate,
      startTime,
      endTime,
      timeZone,
      dailySchedule,
      breakSchedule,
      maxParticipants,
      minParticipants,
      sessionPrice,
      earlyBirdDeadline,
      earlyBirdDiscount,
      deliveryMethod,
      virtualMeetingUrl,
      virtualMeetingId,
      virtualMeetingPassword,
      leadInstructorId,
      coInstructors,
      teachingAssistants,
      supportStaff,
      courseMaterialsUrl,
      resourceLinks,
      requiredSoftware,
      materialDistributionMethod,
      assessmentSchedule,
      projectDeadlines,
      evaluationCriteria,
      registrationOpens,
      registrationCloses,
      internalNotes,
      specialRequirements
    } = req.body;

    // Validate required fields
    if (!programId || !centerId || !startDate || !endDate || !startTime || !endTime || !maxParticipants || !deliveryMethod) {
      throw new ValidationError('Program ID, center ID, dates, times, max participants, and delivery method are required');
    }

    // Generate session code
    const programs = await trainingCenterService.getTrainingPrograms({ programId, limit: 1 });
    if (programs.length === 0) {
      throw new ValidationError('Invalid program ID');
    }
    
    const sessionCode = await trainingCenterService.generateSessionCode(programs[0].program_code);

    const session = await trainingCenterService.createTrainingSession({
      programId,
      centerId,
      sessionName,
      sessionCode,
      cohortName,
      startDate,
      endDate,
      startTime,
      endTime,
      timeZone,
      dailySchedule,
      breakSchedule,
      maxParticipants,
      minParticipants,
      sessionPrice,
      earlyBirdDeadline,
      earlyBirdDiscount,
      deliveryMethod,
      virtualMeetingUrl,
      virtualMeetingId,
      virtualMeetingPassword,
      leadInstructorId,
      coInstructors,
      teachingAssistants,
      supportStaff,
      courseMaterialsUrl,
      resourceLinks,
      requiredSoftware,
      materialDistributionMethod,
      assessmentSchedule,
      projectDeadlines,
      evaluationCriteria,
      registrationOpens,
      registrationCloses,
      internalNotes,
      specialRequirements,
      createdBy: req.user.userId
    });

    // Send notification about new training session
    try {
      await realtimeIntegrations.createCustomEvent({
        eventType: 'training_session_created',
        schoolId: null, // Platform-wide notification
        sourceUserId: req.user.userId,
        targetRoles: ['training_coordinator', 'instructor', 'super_admin'],
        title: 'New Training Session Created',
        message: `Training session "${session.session_name || programs[0].program_name}" has been scheduled`,
        eventPayload: {
          sessionId: session.id,
          sessionCode: session.session_code,
          programName: programs[0].program_name,
          startDate: session.start_date,
          maxParticipants: session.max_participants
        },
        priority: 'normal',
        sourceEntityType: 'training_session',
        sourceEntityId: session.id,
        actionUrl: `/training/sessions/${session.id}`
      });
    } catch (error) {
      console.error('Failed to send training session notification:', error);
    }

    res.status(201).json({
      success: true,
      data: { session },
      message: 'Training session created successfully'
    });
  });

  // Get training sessions
  getTrainingSessions = asyncHandler(async (req, res) => {
    const filters = {
      programId: req.query.programId,
      centerId: req.query.centerId,
      status: req.query.status,
      leadInstructorId: req.query.leadInstructorId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      registrationOpen: req.query.registrationOpen === 'true',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const sessions = await trainingCenterService.getTrainingSessions(filters);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: sessions.length === filters.limit
        }
      },
      message: 'Training sessions retrieved successfully'
    });
  });

  // Get training session details
  getTrainingSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    const sessions = await trainingCenterService.getTrainingSessions({ 
      sessionId: sessionId,
      limit: 1 
    });

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Training session not found'
        }
      });
    }

    // Check session availability
    const availability = await trainingCenterService.checkSessionAvailability(sessionId);

    res.json({
      success: true,
      data: { 
        session: sessions[0],
        availability
      },
      message: 'Training session details retrieved successfully'
    });
  });

  /**
   * Training Enrollments Management
   */

  // Create enrollment
  createEnrollment = asyncHandler(async (req, res) => {
    const {
      sessionId,
      participantId,
      enrollmentType,
      participantType,
      organization,
      jobTitle,
      experienceLevel,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      dietaryRestrictions,
      accessibilityNeeds,
      specialAccommodations,
      totalAmount,
      paymentMethod,
      discountApplied,
      discountReason,
      registrationSource,
      referralCode,
      marketingSource,
      internalNotes
    } = req.body;

    // Validate required fields
    if (!sessionId || !participantId || !totalAmount) {
      throw new ValidationError('Session ID, participant ID, and total amount are required');
    }

    const enrollment = await trainingCenterService.createEnrollment({
      sessionId,
      participantId,
      enrollmentType,
      participantType,
      organization,
      jobTitle,
      experienceLevel,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      dietaryRestrictions,
      accessibilityNeeds,
      specialAccommodations,
      totalAmount,
      paymentMethod,
      discountApplied,
      discountReason,
      registrationSource,
      referralCode,
      marketingSource,
      internalNotes
    });

    res.status(201).json({
      success: true,
      data: { enrollment },
      message: 'Training enrollment created successfully'
    });
  });

  // Get enrollments
  getEnrollments = asyncHandler(async (req, res) => {
    const filters = {
      sessionId: req.query.sessionId,
      participantId: req.query.participantId,
      enrollmentStatus: req.query.enrollmentStatus,
      paymentStatus: req.query.paymentStatus,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const enrollments = await trainingCenterService.getEnrollments(filters);

    res.json({
      success: true,
      data: {
        enrollments,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: enrollments.length === filters.limit
        }
      },
      message: 'Training enrollments retrieved successfully'
    });
  });

  /**
   * Training Instructors Management
   */

  // Create instructor profile
  createInstructor = asyncHandler(async (req, res) => {
    const {
      userId,
      instructorCode,
      instructorType,
      specializations,
      educationBackground,
      certifications,
      yearsExperience,
      industryExperience,
      teachingExperienceYears,
      preferredSubjects,
      teachingMethods,
      languagesSpoken,
      maxClassSize,
      availabilitySchedule,
      timeZone,
      travelWilling,
      virtualTeachingCapable,
      hourlyRate,
      dailyRate,
      currency,
      paymentTerms,
      hasOwnEquipment,
      equipmentList,
      technicalRequirements,
      contractType,
      contractStartDate,
      contractEndDate,
      bio,
      profileImageUrl,
      linkedinUrl,
      websiteUrl,
      portfolioUrl
    } = req.body;

    // Validate required fields
    if (!userId || !instructorCode || !specializations || !yearsExperience) {
      throw new ValidationError('User ID, instructor code, specializations, and years of experience are required');
    }

    const instructor = await trainingCenterService.createInstructor({
      userId,
      instructorCode,
      instructorType,
      specializations,
      educationBackground,
      certifications,
      yearsExperience,
      industryExperience,
      teachingExperienceYears,
      preferredSubjects,
      teachingMethods,
      languagesSpoken,
      maxClassSize,
      availabilitySchedule,
      timeZone,
      travelWilling,
      virtualTeachingCapable,
      hourlyRate,
      dailyRate,
      currency,
      paymentTerms,
      hasOwnEquipment,
      equipmentList,
      technicalRequirements,
      contractType,
      contractStartDate,
      contractEndDate,
      bio,
      profileImageUrl,
      linkedinUrl,
      websiteUrl,
      portfolioUrl,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { instructor },
      message: 'Training instructor profile created successfully'
    });
  });

  // Get instructors
  getInstructors = asyncHandler(async (req, res) => {
    const filters = {
      instructorType: req.query.instructorType,
      specialization: req.query.specialization,
      virtualCapable: req.query.virtualCapable === 'true',
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const instructors = await trainingCenterService.getInstructors(filters);

    res.json({
      success: true,
      data: {
        instructors,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: instructors.length === filters.limit
        }
      },
      message: 'Training instructors retrieved successfully'
    });
  });

  /**
   * Analytics and Reports
   */

  // Get training center analytics
  getTrainingCenterAnalytics = asyncHandler(async (req, res) => {
    const {
      centerId,
      startDate,
      endDate
    } = req.query;

    const analytics = await trainingCenterService.getTrainingCenterAnalytics(centerId, startDate, endDate);

    res.json({
      success: true,
      data: {
        analytics,
        period: {
          startDate,
          endDate,
          centerId
        },
        generatedAt: new Date().toISOString()
      },
      message: 'Training center analytics retrieved successfully'
    });
  });

  // Get instructor analytics
  getInstructorAnalytics = asyncHandler(async (req, res) => {
    const { instructorId } = req.params;
    
    const analytics = await trainingCenterService.getInstructorAnalytics(instructorId);

    res.json({
      success: true,
      data: { analytics },
      message: 'Instructor analytics retrieved successfully'
    });
  });

  // Get training dashboard
  getTrainingDashboard = asyncHandler(async (req, res) => {
    const timeframe = req.query.timeframe || '30days';
    
    // Get current date and calculate start date based on timeframe
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const analytics = await trainingCenterService.getTrainingCenterAnalytics(
      null, 
      startDate.toISOString().split('T')[0], 
      endDate.toISOString().split('T')[0]
    );

    res.json({
      success: true,
      data: {
        analytics,
        timeframe,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        timestamp: new Date().toISOString()
      },
      message: 'Training dashboard retrieved successfully'
    });
  });

  /**
   * Public Endpoints (No Authentication Required)
   */

  // Get public training programs (for website)
  getPublicTrainingPrograms = asyncHandler(async (req, res) => {
    const filters = {
      category: req.query.category,
      programType: req.query.programType,
      difficultyLevel: req.query.difficultyLevel,
      featured: req.query.featured === 'true',
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 12
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const programs = await trainingCenterService.getTrainingPrograms(filters);

    // Remove sensitive information for public endpoint
    const publicPrograms = programs.map(program => ({
      id: program.id,
      program_name: program.program_name,
      program_code: program.program_code,
      program_type: program.program_type,
      category: program.category,
      description: program.description,
      learning_objectives: program.learning_objectives,
      target_audience: program.target_audience,
      duration_days: program.duration_days,
      duration_hours: program.duration_hours,
      difficulty_level: program.difficulty_level,
      provides_certificate: program.provides_certificate,
      base_price: program.base_price,
      currency: program.currency,
      delivery_method: program.delivery_method,
      featured_image_url: program.featured_image_url,
      promotional_video_url: program.promotional_video_url,
      marketing_highlights: program.marketing_highlights,
      average_rating: program.average_rating,
      is_featured: program.is_featured,
      upcoming_sessions: program.upcoming_sessions
    }));

    res.json({
      success: true,
      data: {
        programs: publicPrograms,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: programs.length === filters.limit
        }
      },
      message: 'Public training programs retrieved successfully'
    });
  });

  // Get public training sessions (for website)
  getPublicTrainingSessions = asyncHandler(async (req, res) => {
    const filters = {
      programId: req.query.programId,
      registrationOpen: true,
      dateFrom: new Date().toISOString().split('T')[0], // Only future sessions
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const sessions = await trainingCenterService.getTrainingSessions(filters);

    // Remove sensitive information for public endpoint
    const publicSessions = sessions.map(session => ({
      id: session.id,
      session_code: session.session_code,
      cohort_name: session.cohort_name,
      start_date: session.start_date,
      end_date: session.end_date,
      start_time: session.start_time,
      end_time: session.end_time,
      max_participants: session.max_participants,
      confirmed_enrollments: session.confirmed_enrollments,
      session_price: session.session_price,
      early_bird_deadline: session.early_bird_deadline,
      early_bird_discount: session.early_bird_discount,
      delivery_method: session.delivery_method,
      program_name: session.program_name,
      center_name: session.center_name,
      instructor_first_name: session.instructor_first_name,
      instructor_last_name: session.instructor_last_name,
      spots_available: session.max_participants - session.confirmed_enrollments
    }));

    res.json({
      success: true,
      data: {
        sessions: publicSessions,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: sessions.length === filters.limit
        }
      },
      message: 'Public training sessions retrieved successfully'
    });
  });

  /**
   * Health Check
   */

  // Get training service health
  getTrainingServiceHealth = asyncHandler(async (req, res) => {
    const analytics = await trainingCenterService.getTrainingCenterAnalytics();

    res.json({
      success: true,
      data: {
        service: 'Training Center Management Service',
        status: 'healthy',
        features: [
          'training_center_management',
          'workshop_scheduling',
          'instructor_coordination',
          'enrollment_management',
          'certification_tracking',
          'virtual_training_support',
          'analytics_reporting',
          'public_program_catalog'
        ],
        metrics: {
          totalSessions: analytics.total_sessions,
          totalEnrollments: analytics.total_enrollments,
          completionRate: parseFloat(analytics.completion_rate) || 0,
          avgRating: parseFloat(analytics.avg_session_rating) || 0,
          totalRevenue: parseFloat(analytics.total_revenue) || 0
        },
        timestamp: new Date().toISOString()
      },
      message: 'Training service health check completed'
    });
  });
}

module.exports = new TrainingCenterController();