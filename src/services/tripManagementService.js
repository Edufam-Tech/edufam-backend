const { query } = require('../config/database');
const { DatabaseError, ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Trip Management Service
 * Handles company-managed academic trip programs for schools
 */
class TripManagementService {

  /**
   * Trip Program Management
   */

  // Create new trip program
  async createTripProgram(programData) {
    try {
      const {
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
        minParticipants = 10,
        minAge,
        maxAge,
        targetGrades,
        baseCost,
        currency = 'KES',
        costIncludes,
        costExcludes,
        transportationMode,
        accommodationType,
        mealPlan,
        safetyRating,
        insuranceRequired = true,
        passportRequired = true,
        visaRequired = false,
        tripLeaderId,
        registrationOpens,
        registrationCloses,
        tripStartDate,
        tripEndDate,
        marketingDescription,
        highlights,
        createdBy
      } = programData;

      // Validate required fields
      if (!programName || !programCode || !programType || !destinationCountry || !destinationCity || !durationDays || !maxParticipants || !baseCost) {
        throw new ValidationError('Program name, code, type, destination, duration, participants, and cost are required');
      }

      // Validate dates
      if (new Date(tripStartDate) <= new Date(tripEndDate)) {
        if (new Date(tripStartDate) >= new Date(tripEndDate)) {
          throw new ValidationError('Trip start date must be before end date');
        }
      }

      // Check if program code already exists
      const existingProgram = await query(
        'SELECT id FROM admin_trip_programs WHERE program_code = $1',
        [programCode]
      );

      if (existingProgram.rows.length > 0) {
        throw new ValidationError('Program code already exists');
      }

      const result = await query(`
        INSERT INTO admin_trip_programs (
          program_name, program_code, program_type, target_curriculum,
          learning_objectives, skills_developed, subject_areas,
          destination_country, destination_city, destinations,
          duration_days, max_participants, min_participants,
          min_age, max_age, target_grades, base_cost, currency,
          cost_includes, cost_excludes, transportation_mode,
          accommodation_type, meal_plan, safety_rating,
          insurance_required, passport_required, visa_required,
          trip_leader_id, registration_opens, registration_closes,
          trip_start_date, trip_end_date, marketing_description,
          highlights, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
          $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
        )
        RETURNING *
      `, [
        programName, programCode, programType, targetCurriculum,
        learningObjectives, skillsDeveloped, subjectAreas,
        destinationCountry, destinationCity, destinations,
        durationDays, maxParticipants, minParticipants,
        minAge, maxAge, targetGrades, baseCost, currency,
        costIncludes, costExcludes, transportationMode,
        accommodationType, mealPlan, safetyRating,
        insuranceRequired, passportRequired, visaRequired,
        tripLeaderId, registrationOpens, registrationCloses,
        tripStartDate, tripEndDate, marketingDescription,
        highlights, createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('Failed to create trip program', error);
    }
  }

  // Get trip program details
  async getTripProgram(programId) {
    try {
      const result = await query(`
        SELECT 
          tp.*,
          e.employee_id as leader_employee_id,
          u.first_name as leader_first_name,
          u.last_name as leader_last_name,
          u.email as leader_email,
          (SELECT COUNT(*) FROM admin_trip_registrations WHERE trip_program_id = tp.id) as total_registrations,
          (SELECT COUNT(*) FROM admin_trip_registrations WHERE trip_program_id = tp.id AND registration_status = 'confirmed') as confirmed_registrations
        FROM admin_trip_programs tp
        LEFT JOIN admin_employees e ON e.id = tp.trip_leader_id
        LEFT JOIN users u ON u.id = e.user_id
        WHERE tp.id = $1
      `, [programId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Trip program not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to get trip program', error);
    }
  }

  // Update trip program
  async updateTripProgram(programId, updateData) {
    try {
      const {
        programName,
        programType,
        destinationCountry,
        destinationCity,
        baseCost,
        maxParticipants,
        tripLeaderId,
        programStatus,
        registrationOpens,
        registrationCloses,
        tripStartDate,
        tripEndDate,
        marketingDescription
      } = updateData;

      const result = await query(`
        UPDATE admin_trip_programs
        SET 
          program_name = COALESCE($2, program_name),
          program_type = COALESCE($3, program_type),
          destination_country = COALESCE($4, destination_country),
          destination_city = COALESCE($5, destination_city),
          base_cost = COALESCE($6, base_cost),
          max_participants = COALESCE($7, max_participants),
          trip_leader_id = COALESCE($8, trip_leader_id),
          program_status = COALESCE($9, program_status),
          registration_opens = COALESCE($10, registration_opens),
          registration_closes = COALESCE($11, registration_closes),
          trip_start_date = COALESCE($12, trip_start_date),
          trip_end_date = COALESCE($13, trip_end_date),
          marketing_description = COALESCE($14, marketing_description),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        programId, programName, programType, destinationCountry, destinationCity,
        baseCost, maxParticipants, tripLeaderId, programStatus,
        registrationOpens, registrationCloses, tripStartDate, tripEndDate, marketingDescription
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Trip program not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update trip program', error);
    }
  }

  // Get trip programs list with filters
  async getTripPrograms(filters = {}) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (filters.programType) {
        paramCount++;
        whereConditions.push(`tp.program_type = $${paramCount}`);
        queryParams.push(filters.programType);
      }

      if (filters.destinationCountry) {
        paramCount++;
        whereConditions.push(`tp.destination_country = $${paramCount}`);
        queryParams.push(filters.destinationCountry);
      }

      if (filters.programStatus) {
        paramCount++;
        whereConditions.push(`tp.program_status = $${paramCount}`);
        queryParams.push(filters.programStatus);
      }

      if (filters.curriculum) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(tp.target_curriculum)`);
        queryParams.push(filters.curriculum);
      }

      if (filters.dateFrom) {
        paramCount++;
        whereConditions.push(`tp.trip_start_date >= $${paramCount}`);
        queryParams.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        paramCount++;
        whereConditions.push(`tp.trip_end_date <= $${paramCount}`);
        queryParams.push(filters.dateTo);
      }

      if (filters.search) {
        paramCount++;
        whereConditions.push(`(tp.program_name ILIKE $${paramCount} OR tp.destination_city ILIKE $${paramCount} OR tp.destination_country ILIKE $${paramCount})`);
        queryParams.push(`%${filters.search}%`);
      }

      const limit = Math.min(filters.limit || 20, 100);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          tp.*,
          e.employee_id as leader_employee_id,
          u.first_name as leader_first_name,
          u.last_name as leader_last_name,
          (SELECT COUNT(*) FROM admin_trip_registrations WHERE trip_program_id = tp.id) as total_registrations,
          (SELECT COUNT(*) FROM admin_trip_registrations WHERE trip_program_id = tp.id AND registration_status = 'confirmed') as confirmed_registrations
        FROM admin_trip_programs tp
        LEFT JOIN admin_employees e ON e.id = tp.trip_leader_id
        LEFT JOIN users u ON u.id = e.user_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY tp.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get trip programs', error);
    }
  }

  /**
   * Trip Registration Management
   */

  // Register student for trip
  async registerStudentForTrip(registrationData) {
    try {
      const {
        tripProgramId,
        studentId,
        schoolId,
        parentGuardianId,
        totalAmount,
        medicalConditions,
        dietaryRestrictions,
        specialNeeds,
        passportNumber,
        passportExpiry,
        preferredContactMethod = 'email',
        emergencyContactAbroad
      } = registrationData;

      // Check if program exists and is open for registration
      const program = await query(`
        SELECT * FROM admin_trip_programs 
        WHERE id = $1 AND program_status = 'open_registration'
      `, [tripProgramId]);

      if (program.rows.length === 0) {
        throw new ValidationError('Trip program not found or not open for registration');
      }

      // Check if student already registered
      const existingRegistration = await query(`
        SELECT id FROM admin_trip_registrations
        WHERE trip_program_id = $1 AND student_id = $2
      `, [tripProgramId, studentId]);

      if (existingRegistration.rows.length > 0) {
        throw new ValidationError('Student already registered for this trip');
      }

      // Check capacity
      const registrationCount = await query(`
        SELECT COUNT(*) FROM admin_trip_registrations
        WHERE trip_program_id = $1 AND registration_status IN ('confirmed', 'pending')
      `, [tripProgramId]);

      if (parseInt(registrationCount.rows[0].count) >= program.rows[0].max_participants) {
        throw new ValidationError('Trip program is at maximum capacity');
      }

      const result = await query(`
        INSERT INTO admin_trip_registrations (
          trip_program_id, student_id, school_id, parent_guardian_id,
          total_amount, medical_conditions, dietary_restrictions,
          special_needs, passport_number, passport_expiry,
          preferred_contact_method, emergency_contact_abroad
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        tripProgramId, studentId, schoolId, parentGuardianId,
        totalAmount, medicalConditions, dietaryRestrictions,
        specialNeeds, passportNumber, passportExpiry,
        preferredContactMethod, emergencyContactAbroad
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('Failed to register student for trip', error);
    }
  }

  // Update registration status
  async updateRegistrationStatus(registrationId, status, updatedBy) {
    try {
      if (!['pending', 'confirmed', 'waitlisted', 'cancelled'].includes(status)) {
        throw new ValidationError('Invalid registration status');
      }

      const result = await query(`
        UPDATE admin_trip_registrations
        SET 
          registration_status = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [registrationId, status]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Registration not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update registration status', error);
    }
  }

  // Get trip registrations
  async getTripRegistrations(tripProgramId, filters = {}) {
    try {
      let whereConditions = ['tr.trip_program_id = $1'];
      let queryParams = [tripProgramId];
      let paramCount = 1;

      if (filters.registrationStatus) {
        paramCount++;
        whereConditions.push(`tr.registration_status = $${paramCount}`);
        queryParams.push(filters.registrationStatus);
      }

      if (filters.paymentStatus) {
        paramCount++;
        whereConditions.push(`tr.payment_status = $${paramCount}`);
        queryParams.push(filters.paymentStatus);
      }

      if (filters.schoolId) {
        paramCount++;
        whereConditions.push(`tr.school_id = $${paramCount}`);
        queryParams.push(filters.schoolId);
      }

      const limit = Math.min(filters.limit || 50, 200);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          tr.*,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          s.date_of_birth,
          s.grade_level,
          sch.name as school_name,
          u.first_name as parent_first_name,
          u.last_name as parent_last_name,
          u.email as parent_email,
          u.phone as parent_phone
        FROM admin_trip_registrations tr
        JOIN students s ON s.id = tr.student_id
        JOIN schools sch ON sch.id = tr.school_id
        LEFT JOIN users u ON u.id = tr.parent_guardian_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY tr.registration_date DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get trip registrations', error);
    }
  }

  /**
   * Trip Analytics and Reports
   */

  // Get trip program analytics
  async getTripProgramAnalytics(programId) {
    try {
      const analytics = await query(`
        SELECT 
          tp.program_name,
          tp.max_participants,
          tp.base_cost,
          COUNT(tr.id) as total_registrations,
          COUNT(tr.id) FILTER (WHERE tr.registration_status = 'confirmed') as confirmed_registrations,
          COUNT(tr.id) FILTER (WHERE tr.registration_status = 'pending') as pending_registrations,
          COUNT(tr.id) FILTER (WHERE tr.registration_status = 'waitlisted') as waitlisted_registrations,
          COUNT(tr.id) FILTER (WHERE tr.payment_status = 'completed') as paid_registrations,
          SUM(tr.total_amount) as total_revenue,
          SUM(tr.amount_paid) as collected_revenue,
          COUNT(DISTINCT tr.school_id) as participating_schools,
          AVG(EXTRACT(YEAR FROM AGE(s.date_of_birth))) as avg_participant_age
        FROM admin_trip_programs tp
        LEFT JOIN admin_trip_registrations tr ON tr.trip_program_id = tp.id
        LEFT JOIN students s ON s.id = tr.student_id
        WHERE tp.id = $1
        GROUP BY tp.id, tp.program_name, tp.max_participants, tp.base_cost
      `, [programId]);

      return analytics.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get trip program analytics', error);
    }
  }

  // Get trip management dashboard metrics
  async getTripDashboardMetrics() {
    try {
      const metrics = await query(`
        SELECT 
          (SELECT COUNT(*) FROM admin_trip_programs WHERE program_status = 'published') as published_programs,
          (SELECT COUNT(*) FROM admin_trip_programs WHERE program_status = 'open_registration') as open_registration_programs,
          (SELECT COUNT(*) FROM admin_trip_registrations WHERE registration_status = 'pending') as pending_registrations,
          (SELECT COUNT(*) FROM admin_trip_registrations WHERE registration_status = 'confirmed') as confirmed_registrations,
          (SELECT SUM(amount_paid) FROM admin_trip_registrations) as total_revenue,
          (SELECT COUNT(DISTINCT school_id) FROM admin_trip_registrations) as participating_schools,
          (SELECT COUNT(*) FROM admin_trip_programs WHERE trip_start_date >= CURRENT_DATE AND trip_start_date <= CURRENT_DATE + INTERVAL '30 days') as upcoming_trips_30_days,
          (SELECT AVG(average_rating) FROM admin_trip_programs WHERE average_rating IS NOT NULL) as avg_trip_rating
      `);

      return metrics.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get trip dashboard metrics', error);
    }
  }

  // Get revenue analytics by period
  async getRevenueAnalytics(period = 'month') {
    try {
      let dateFormat;
      switch (period) {
        case 'week':
          dateFormat = 'YYYY-WW';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          break;
        case 'year':
          dateFormat = 'YYYY';
          break;
        default:
          dateFormat = 'YYYY-MM';
      }

      const result = await query(`
        SELECT 
          TO_CHAR(tr.registration_date, $1) as period,
          COUNT(tr.id) as registrations,
          SUM(tr.total_amount) as total_revenue,
          SUM(tr.amount_paid) as collected_revenue,
          COUNT(DISTINCT tr.trip_program_id) as active_programs
        FROM admin_trip_registrations tr
        WHERE tr.registration_date >= CURRENT_DATE - INTERVAL '1 year'
        GROUP BY TO_CHAR(tr.registration_date, $1)
        ORDER BY period DESC
        LIMIT 12
      `, [dateFormat]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get revenue analytics', error);
    }
  }

  /**
   * Trip Program Utilities
   */

  // Generate unique program code
  async generateProgramCode(programType) {
    try {
      const year = new Date().getFullYear();
      const typePrefix = programType.substring(0, 3).toUpperCase();
      
      // Get the next sequence number for this year and type
      const result = await query(`
        SELECT COUNT(*) + 1 as next_seq
        FROM admin_trip_programs
        WHERE program_code LIKE $1
      `, [`${typePrefix}${year}%`]);

      const sequenceNumber = result.rows[0].next_seq.toString().padStart(3, '0');
      return `${typePrefix}${year}${sequenceNumber}`;
    } catch (error) {
      throw new DatabaseError('Failed to generate program code', error);
    }
  }

  // Check trip capacity and availability
  async checkTripAvailability(tripProgramId) {
    try {
      const result = await query(`
        SELECT 
          tp.max_participants,
          tp.min_participants,
          tp.program_status,
          tp.registration_opens,
          tp.registration_closes,
          COUNT(tr.id) FILTER (WHERE tr.registration_status IN ('confirmed', 'pending')) as current_registrations
        FROM admin_trip_programs tp
        LEFT JOIN admin_trip_registrations tr ON tr.trip_program_id = tp.id
        WHERE tp.id = $1
        GROUP BY tp.id, tp.max_participants, tp.min_participants, tp.program_status, tp.registration_opens, tp.registration_closes
      `, [tripProgramId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Trip program not found');
      }

      const trip = result.rows[0];
      const now = new Date();
      
      return {
        isAvailable: trip.program_status === 'open_registration' &&
                    new Date(trip.registration_opens) <= now &&
                    new Date(trip.registration_closes) >= now &&
                    trip.current_registrations < trip.max_participants,
        spotsRemaining: trip.max_participants - trip.current_registrations,
        registrationStatus: trip.program_status,
        currentRegistrations: parseInt(trip.current_registrations)
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to check trip availability', error);
    }
  }
}

module.exports = new TripManagementService();