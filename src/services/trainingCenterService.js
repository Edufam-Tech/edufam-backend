const { query } = require('../config/database');
const { DatabaseError, ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Training Center Service
 * Handles training center operations, workshop management, and instructor coordination
 */
class TrainingCenterService {

  /**
   * Training Centers Management
   */

  // Create training center
  async createTrainingCenter(centerData) {
    try {
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
        certifyingBody,
        createdBy
      } = centerData;

      const result = await query(`
        INSERT INTO training_centers (
          center_name, center_code, center_type, description,
          address, city, state_province, country, postal_code, coordinates,
          phone, email, website_url, max_capacity, classroom_count,
          computer_lab_count, has_projector, has_wifi, has_parking,
          accessibility_features, virtual_platform, platform_settings,
          virtual_room_capacity, operating_hours, time_zone,
          center_manager_id, backup_manager_id, hourly_rate, daily_rate,
          currency, certification_status, certifying_body, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
          $30, $31, $32, $33
        )
        RETURNING *
      `, [
        centerName, centerCode, centerType, description,
        address, city, stateProvince, country, postalCode, JSON.stringify(coordinates),
        phone, email, websiteUrl, maxCapacity, classroomCount,
        computerLabCount, hasProjector, hasWifi, hasParking,
        accessibilityFeatures, virtualPlatform, JSON.stringify(platformSettings),
        virtualRoomCapacity, JSON.stringify(operatingHours), timeZone,
        centerManagerId, backupManagerId, hourlyRate, dailyRate,
        currency, certificationStatus, certifyingBody, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create training center', error);
    }
  }

  // Get training centers
  async getTrainingCenters(filters = {}) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.centerType) {
        paramCount++;
        whereConditions.push(`center_type = $${paramCount}`);
        queryParams.push(filters.centerType);
      }

      if (filters.status) {
        paramCount++;
        whereConditions.push(`status = $${paramCount}`);
        queryParams.push(filters.status);
      }

      if (filters.city) {
        paramCount++;
        whereConditions.push(`city ILIKE $${paramCount}`);
        queryParams.push(`%${filters.city}%`);
      }

      if (filters.country) {
        paramCount++;
        whereConditions.push(`country = $${paramCount}`);
        queryParams.push(filters.country);
      }

      const limit = Math.min(filters.limit || 50, 100);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          tc.*,
          u1.first_name as manager_first_name,
          u1.last_name as manager_last_name,
          u1.email as manager_email,
          u2.first_name as backup_manager_first_name,
          u2.last_name as backup_manager_last_name,
          COUNT(ts.id) as active_sessions
        FROM training_centers tc
        LEFT JOIN users u1 ON u1.id = tc.center_manager_id
        LEFT JOIN users u2 ON u2.id = tc.backup_manager_id
        LEFT JOIN training_sessions ts ON ts.center_id = tc.id AND ts.status IN ('scheduled', 'confirmed', 'in_progress')
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY tc.id, u1.first_name, u1.last_name, u1.email, u2.first_name, u2.last_name
        ORDER BY tc.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get training centers', error);
    }
  }

  /**
   * Training Programs Management
   */

  // Create training program
  async createTrainingProgram(programData) {
    try {
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
        marketingHighlights,
        createdBy
      } = programData;

      const result = await query(`
        INSERT INTO training_programs (
          program_name, program_code, program_type, category, subcategory,
          description, learning_objectives, prerequisites, target_audience,
          duration_days, duration_hours, session_count, difficulty_level,
          min_age, max_participants, min_participants, provides_certificate,
          certificate_type, certificate_validity_months, continuing_education_credits,
          base_price, currency, early_bird_discount, group_discount_threshold,
          group_discount_rate, materials_included, required_materials,
          software_requirements, hardware_requirements, delivery_method,
          platform_requirements, curriculum_outline, assessment_methods,
          practical_components, project_based, featured_image_url,
          promotional_video_url, marketing_highlights, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
          $30, $31, $32, $33, $34, $35, $36, $37, $38, $39
        )
        RETURNING *
      `, [
        programName, programCode, programType, category, subcategory,
        description, learningObjectives, prerequisites, targetAudience,
        durationDays, durationHours, sessionCount, difficultyLevel,
        minAge, maxParticipants, minParticipants, providesCertificate,
        certificateType, certificateValidityMonths, continuingEducationCredits,
        basePrice, currency, earlyBirdDiscount, groupDiscountThreshold,
        groupDiscountRate, materialsIncluded, requiredMaterials,
        softwareRequirements, hardwareRequirements, deliveryMethod,
        platformRequirements, JSON.stringify(curriculumOutline), assessmentMethods,
        practicalComponents, projectBased, featuredImageUrl,
        promotionalVideoUrl, marketingHighlights, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create training program', error);
    }
  }

  // Get training programs
  async getTrainingPrograms(filters = {}) {
    try {
      let whereConditions = ['status = $1'];
      let queryParams = ['published'];
      let paramCount = 1;

      if (filters.category) {
        paramCount++;
        whereConditions.push(`category = $${paramCount}`);
        queryParams.push(filters.category);
      }

      if (filters.programType) {
        paramCount++;
        whereConditions.push(`program_type = $${paramCount}`);
        queryParams.push(filters.programType);
      }

      if (filters.difficultyLevel) {
        paramCount++;
        whereConditions.push(`difficulty_level = $${paramCount}`);
        queryParams.push(filters.difficultyLevel);
      }

      if (filters.deliveryMethod) {
        paramCount++;
        whereConditions.push(`delivery_method = $${paramCount}`);
        queryParams.push(filters.deliveryMethod);
      }

      if (filters.providesCertificate) {
        paramCount++;
        whereConditions.push(`provides_certificate = $${paramCount}`);
        queryParams.push(filters.providesCertificate);
      }

      if (filters.search) {
        paramCount++;
        whereConditions.push(`(program_name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
        queryParams.push(`%${filters.search}%`);
      }

      if (filters.featured) {
        whereConditions.push(`is_featured = true`);
      }

      const limit = Math.min(filters.limit || 20, 100);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          tp.*,
          COUNT(ts.id) as total_sessions,
          COUNT(ts.id) FILTER (WHERE ts.status IN ('scheduled', 'confirmed')) as upcoming_sessions,
          AVG(ts.session_rating) as avg_session_rating
        FROM training_programs tp
        LEFT JOIN training_sessions ts ON ts.program_id = tp.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY tp.id
        ORDER BY tp.is_featured DESC, tp.average_rating DESC NULLS LAST, tp.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get training programs', error);
    }
  }

  /**
   * Training Sessions Management
   */

  // Create training session
  async createTrainingSession(sessionData) {
    try {
      const {
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
        createdBy
      } = sessionData;

      const result = await query(`
        INSERT INTO training_sessions (
          program_id, center_id, session_name, session_code, cohort_name,
          start_date, end_date, start_time, end_time, time_zone,
          daily_schedule, break_schedule, max_participants, min_participants,
          session_price, early_bird_deadline, early_bird_discount,
          delivery_method, virtual_meeting_url, virtual_meeting_id,
          virtual_meeting_password, lead_instructor_id, co_instructors,
          teaching_assistants, support_staff, course_materials_url,
          resource_links, required_software, material_distribution_method,
          assessment_schedule, project_deadlines, evaluation_criteria,
          registration_opens, registration_closes, internal_notes,
          special_requirements, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
          $30, $31, $32, $33, $34, $35, $36, $37
        )
        RETURNING *
      `, [
        programId, centerId, sessionName, sessionCode, cohortName,
        startDate, endDate, startTime, endTime, timeZone,
        JSON.stringify(dailySchedule), JSON.stringify(breakSchedule), maxParticipants, minParticipants,
        sessionPrice, earlyBirdDeadline, earlyBirdDiscount,
        deliveryMethod, virtualMeetingUrl, virtualMeetingId,
        virtualMeetingPassword, leadInstructorId, coInstructors,
        teachingAssistants, supportStaff, courseMaterialsUrl,
        JSON.stringify(resourceLinks), requiredSoftware, materialDistributionMethod,
        JSON.stringify(assessmentSchedule), JSON.stringify(projectDeadlines), JSON.stringify(evaluationCriteria),
        registrationOpens, registrationCloses, internalNotes,
        specialRequirements, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create training session', error);
    }
  }

  // Get training sessions
  async getTrainingSessions(filters = {}) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.programId) {
        paramCount++;
        whereConditions.push(`ts.program_id = $${paramCount}`);
        queryParams.push(filters.programId);
      }

      if (filters.centerId) {
        paramCount++;
        whereConditions.push(`ts.center_id = $${paramCount}`);
        queryParams.push(filters.centerId);
      }

      if (filters.status) {
        paramCount++;
        whereConditions.push(`ts.status = $${paramCount}`);
        queryParams.push(filters.status);
      }

      if (filters.leadInstructorId) {
        paramCount++;
        whereConditions.push(`ts.lead_instructor_id = $${paramCount}`);
        queryParams.push(filters.leadInstructorId);
      }

      if (filters.dateFrom) {
        paramCount++;
        whereConditions.push(`ts.start_date >= $${paramCount}`);
        queryParams.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        paramCount++;
        whereConditions.push(`ts.end_date <= $${paramCount}`);
        queryParams.push(filters.dateTo);
      }

      if (filters.registrationOpen) {
        whereConditions.push(`ts.registration_status = 'open' AND ts.registration_closes > NOW()`);
      }

      const limit = Math.min(filters.limit || 20, 100);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          ts.*,
          tp.program_name,
          tp.program_type,
          tp.category,
          tc.center_name,
          tc.center_type,
          u.first_name as instructor_first_name,
          u.last_name as instructor_last_name,
          COUNT(te.id) as total_enrollments,
          COUNT(te.id) FILTER (WHERE te.enrollment_status IN ('registered', 'confirmed')) as confirmed_enrollments
        FROM training_sessions ts
        JOIN training_programs tp ON tp.id = ts.program_id
        JOIN training_centers tc ON tc.id = ts.center_id
        LEFT JOIN users u ON u.id = ts.lead_instructor_id
        LEFT JOIN training_enrollments te ON te.session_id = ts.id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ts.id, tp.program_name, tp.program_type, tp.category, tc.center_name, tc.center_type, u.first_name, u.last_name
        ORDER BY ts.start_date ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get training sessions', error);
    }
  }

  /**
   * Training Enrollments Management
   */

  // Create enrollment
  async createEnrollment(enrollmentData) {
    try {
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
      } = enrollmentData;

      // Check session capacity
      const sessionCheck = await query(`
        SELECT 
          ts.max_participants,
          ts.registration_status,
          COUNT(te.id) as current_enrollments
        FROM training_sessions ts
        LEFT JOIN training_enrollments te ON te.session_id = ts.id 
          AND te.enrollment_status IN ('registered', 'confirmed')
        WHERE ts.id = $1
        GROUP BY ts.id, ts.max_participants, ts.registration_status
      `, [sessionId]);

      if (sessionCheck.rows.length === 0) {
        throw new NotFoundError('Training session not found');
      }

      const session = sessionCheck.rows[0];
      if (session.registration_status !== 'open') {
        throw new ValidationError('Registration is not open for this session');
      }

      if (session.current_enrollments >= session.max_participants) {
        throw new ValidationError('Session is at maximum capacity');
      }

      const result = await query(`
        INSERT INTO training_enrollments (
          session_id, participant_id, enrollment_type, participant_type,
          organization, job_title, experience_level, emergency_contact_name,
          emergency_contact_phone, emergency_contact_relationship,
          dietary_restrictions, accessibility_needs, special_accommodations,
          total_amount, payment_method, discount_applied, discount_reason,
          registration_source, referral_code, marketing_source, internal_notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21
        )
        RETURNING *
      `, [
        sessionId, participantId, enrollmentType, participantType,
        organization, jobTitle, experienceLevel, emergencyContactName,
        emergencyContactPhone, emergencyContactRelationship,
        dietaryRestrictions, accessibilityNeeds, specialAccommodations,
        totalAmount, paymentMethod, discountApplied, discountReason,
        registrationSource, referralCode, marketingSource, internalNotes
      ]);

      // Update session enrollment count
      await query(`
        UPDATE training_sessions 
        SET current_enrollments = current_enrollments + 1
        WHERE id = $1
      `, [sessionId]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to create enrollment', error);
    }
  }

  // Get enrollments
  async getEnrollments(filters = {}) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.sessionId) {
        paramCount++;
        whereConditions.push(`te.session_id = $${paramCount}`);
        queryParams.push(filters.sessionId);
      }

      if (filters.participantId) {
        paramCount++;
        whereConditions.push(`te.participant_id = $${paramCount}`);
        queryParams.push(filters.participantId);
      }

      if (filters.enrollmentStatus) {
        paramCount++;
        whereConditions.push(`te.enrollment_status = $${paramCount}`);
        queryParams.push(filters.enrollmentStatus);
      }

      if (filters.paymentStatus) {
        paramCount++;
        whereConditions.push(`te.payment_status = $${paramCount}`);
        queryParams.push(filters.paymentStatus);
      }

      const limit = Math.min(filters.limit || 50, 200);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          te.*,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          ts.session_code,
          ts.start_date,
          ts.end_date,
          tp.program_name,
          tc.center_name
        FROM training_enrollments te
        JOIN users u ON u.id = te.participant_id
        JOIN training_sessions ts ON ts.id = te.session_id
        JOIN training_programs tp ON tp.id = ts.program_id
        JOIN training_centers tc ON tc.id = ts.center_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY te.enrollment_date DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get enrollments', error);
    }
  }

  /**
   * Training Instructors Management
   */

  // Create instructor profile
  async createInstructor(instructorData) {
    try {
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
        portfolioUrl,
        createdBy
      } = instructorData;

      const result = await query(`
        INSERT INTO training_instructors (
          user_id, instructor_code, instructor_type, specializations,
          education_background, certifications, years_experience,
          industry_experience, teaching_experience_years, preferred_subjects,
          teaching_methods, languages_spoken, max_class_size,
          availability_schedule, time_zone, travel_willing,
          virtual_teaching_capable, hourly_rate, daily_rate, currency,
          payment_terms, has_own_equipment, equipment_list,
          technical_requirements, contract_type, contract_start_date,
          contract_end_date, bio, profile_image_url, linkedin_url,
          website_url, portfolio_url, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
          $30, $31, $32, $33
        )
        RETURNING *
      `, [
        userId, instructorCode, instructorType, specializations,
        educationBackground, certifications, yearsExperience,
        industryExperience, teachingExperienceYears, preferredSubjects,
        teachingMethods, languagesSpoken, maxClassSize,
        JSON.stringify(availabilitySchedule), timeZone, travelWilling,
        virtualTeachingCapable, hourlyRate, dailyRate, currency,
        paymentTerms, hasOwnEquipment, equipmentList,
        technicalRequirements, contractType, contractStartDate,
        contractEndDate, bio, profileImageUrl, linkedinUrl,
        websiteUrl, portfolioUrl, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create instructor profile', error);
    }
  }

  // Get instructors
  async getInstructors(filters = {}) {
    try {
      let whereConditions = ['ti.status = $1'];
      let queryParams = ['active'];
      let paramCount = 1;

      if (filters.instructorType) {
        paramCount++;
        whereConditions.push(`ti.instructor_type = $${paramCount}`);
        queryParams.push(filters.instructorType);
      }

      if (filters.specialization) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(ti.specializations)`);
        queryParams.push(filters.specialization);
      }

      if (filters.virtualCapable) {
        whereConditions.push(`ti.virtual_teaching_capable = true`);
      }

      if (filters.search) {
        paramCount++;
        whereConditions.push(`(u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR ti.bio ILIKE $${paramCount})`);
        queryParams.push(`%${filters.search}%`);
      }

      const limit = Math.min(filters.limit || 20, 50);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          ti.*,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          COUNT(ts.id) as total_sessions_led,
          AVG(ts.session_rating) as avg_session_rating
        FROM training_instructors ti
        JOIN users u ON u.id = ti.user_id
        LEFT JOIN training_sessions ts ON ts.lead_instructor_id = ti.user_id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ti.id, u.first_name, u.last_name, u.email, u.phone
        ORDER BY ti.average_rating DESC NULLS LAST, ti.total_sessions_taught DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get instructors', error);
    }
  }

  /**
   * Analytics and Reports
   */

  // Get training center analytics
  async getTrainingCenterAnalytics(centerId = null, startDate = null, endDate = null) {
    try {
      let centerCondition = '';
      let dateCondition = '';
      let queryParams = [];
      let paramCount = 0;

      if (centerId) {
        paramCount++;
        centerCondition = `AND ts.center_id = $${paramCount}`;
        queryParams.push(centerId);
      }

      if (startDate && endDate) {
        paramCount++;
        dateCondition = `AND ts.start_date >= $${paramCount}`;
        queryParams.push(startDate);
        paramCount++;
        dateCondition += ` AND ts.end_date <= $${paramCount}`;
        queryParams.push(endDate);
      }

      const analytics = await query(`
        SELECT 
          COUNT(DISTINCT ts.id) as total_sessions,
          COUNT(DISTINCT ts.program_id) as unique_programs,
          COUNT(DISTINCT te.participant_id) as unique_participants,
          COUNT(te.id) as total_enrollments,
          COUNT(te.id) FILTER (WHERE te.enrollment_status = 'completed') as completed_enrollments,
          AVG(ts.session_rating) as avg_session_rating,
          SUM(te.total_amount) as total_revenue,
          AVG(te.total_amount) as avg_enrollment_fee,
          AVG(ts.current_enrollments::DECIMAL / ts.max_participants * 100) as avg_capacity_utilization
        FROM training_sessions ts
        LEFT JOIN training_enrollments te ON te.session_id = ts.id
        WHERE 1=1 ${centerCondition} ${dateCondition}
      `, queryParams);

      return analytics.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get training center analytics', error);
    }
  }

  // Get instructor performance analytics
  async getInstructorAnalytics(instructorId) {
    try {
      const analytics = await query(`
        SELECT 
          ti.instructor_code,
          ti.total_sessions_taught,
          ti.total_participants_taught,
          ti.average_rating,
          ti.completion_rate,
          COUNT(ts.id) as recent_sessions,
          AVG(ts.session_rating) as recent_avg_rating,
          COUNT(te.id) as recent_participants,
          COUNT(te.id) FILTER (WHERE te.enrollment_status = 'completed') as recent_completions,
          SUM(te.total_amount) as recent_revenue
        FROM training_instructors ti
        LEFT JOIN training_sessions ts ON ts.lead_instructor_id = ti.user_id 
          AND ts.start_date >= NOW() - INTERVAL '6 months'
        LEFT JOIN training_enrollments te ON te.session_id = ts.id
        WHERE ti.user_id = $1
        GROUP BY ti.id, ti.instructor_code, ti.total_sessions_taught, ti.total_participants_taught, ti.average_rating, ti.completion_rate
      `, [instructorId]);

      if (analytics.rows.length === 0) {
        throw new NotFoundError('Instructor not found');
      }

      return analytics.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to get instructor analytics', error);
    }
  }

  /**
   * Utility Methods
   */

  // Generate session code
  async generateSessionCode(programCode) {
    try {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      const result = await query(`
        SELECT COUNT(*) + 1 as next_seq
        FROM training_sessions
        WHERE session_code LIKE $1
      `, [`${programCode}${year}${month}%`]);

      const sequenceNumber = result.rows[0].next_seq.toString().padStart(3, '0');
      return `${programCode}${year}${month}${sequenceNumber}`;
    } catch (error) {
      throw new DatabaseError('Failed to generate session code', error);
    }
  }

  // Check session availability
  async checkSessionAvailability(sessionId) {
    try {
      const result = await query(`
        SELECT 
          ts.max_participants,
          ts.current_enrollments,
          ts.registration_status,
          ts.registration_closes,
          (ts.max_participants - ts.current_enrollments) as spots_available
        FROM training_sessions ts
        WHERE ts.id = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Training session not found');
      }

      const session = result.rows[0];
      return {
        isAvailable: session.registration_status === 'open' && 
                    new Date(session.registration_closes) > new Date() &&
                    session.spots_available > 0,
        spotsAvailable: session.spots_available,
        registrationStatus: session.registration_status,
        registrationCloses: session.registration_closes
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to check session availability', error);
    }
  }
}

module.exports = new TrainingCenterService();