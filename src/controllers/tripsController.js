const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class TripsController {
  // =============================================================================
  // TRIP TYPE MANAGEMENT
  // =============================================================================

  // Create trip type
  static async createTripType(req, res, next) {
    try {
      const {
        typeName,
        description,
        category,
        defaultPermissionRequired = true,
        defaultMedicalInfoRequired = false,
        defaultInsuranceRequired = true
      } = req.body;

      if (!typeName || !category) {
        throw new ValidationError('Type name and category are required');
      }

      const result = await query(`
        INSERT INTO trip_types (
          school_id, type_name, description, category,
          default_permission_required, default_medical_info_required, default_insurance_required
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        req.user.schoolId, typeName, description, category,
        defaultPermissionRequired, defaultMedicalInfoRequired, defaultInsuranceRequired
      ]);

      res.status(201).json({
        success: true,
        message: 'Trip type created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get trip types
  static async getTripTypes(req, res, next) {
    try {
      const { category, isActive } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (category) {
        whereClause += ` AND category = $${params.length + 1}`;
        params.push(category);
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT *
        FROM trip_types 
        ${whereClause}
        ORDER BY type_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // TRIP MANAGEMENT
  // =============================================================================

  // Create trip
  static async createTrip(req, res, next) {
    try {
      const {
        tripName,
        description,
        tripTypeId,
        destination,
        departureDate,
        returnDate,
        departureTime,
        returnTime,
        maxParticipants,
        teacherSupervisorsRequired = 2,
        parentVolunteersAllowed = true,
        costPerStudent = 0,
        depositRequired = 0,
        paymentDeadline,
        minimumAge,
        maximumAge,
        requiresSwimmingAbility = false,
        requiresMedicalClearance = false
      } = req.body;

      if (!tripName || !destination || !departureDate || !returnDate) {
        throw new ValidationError('Trip name, destination, departure date, and return date are required');
      }

      // Validate dates
      if (new Date(departureDate) >= new Date(returnDate)) {
        throw new ValidationError('Return date must be after departure date');
      }

      const result = await query(`
        INSERT INTO trips (
          school_id, trip_name, description, trip_type_id, destination,
          departure_date, return_date, departure_time, return_time,
          max_participants, teacher_supervisors_required, parent_volunteers_allowed,
          cost_per_student, deposit_required, payment_deadline,
          minimum_age, maximum_age, requires_swimming_ability, requires_medical_clearance,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
        req.user.schoolId, tripName, description, tripTypeId, destination,
        departureDate, returnDate, departureTime, returnTime,
        maxParticipants, teacherSupervisorsRequired, parentVolunteersAllowed,
        costPerStudent, depositRequired, paymentDeadline,
        minimumAge, maximumAge, requiresSwimmingAbility, requiresMedicalClearance,
        req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Trip created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get trips
  static async getTrips(req, res, next) {
    try {
      const { 
        status, 
        tripTypeId, 
        startDate, 
        endDate, 
        upcoming,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE t.school_id = $1';
      const params = [req.user.schoolId];

      if (status) {
        whereClause += ` AND t.status = $${params.length + 1}`;
        params.push(status);
      }

      if (tripTypeId) {
        whereClause += ` AND t.trip_type_id = $${params.length + 1}`;
        params.push(tripTypeId);
      }

      if (startDate) {
        whereClause += ` AND t.departure_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND t.departure_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (upcoming === 'true') {
        whereClause += ` AND t.departure_date >= CURRENT_DATE`;
      }

      const result = await query(`
        SELECT 
          t.*,
          tt.type_name,
          tt.category,
          COUNT(tp.id) as registered_participants,
          COUNT(CASE WHEN tp.registration_status = 'confirmed' THEN 1 END) as confirmed_participants
        FROM trips t
        LEFT JOIN trip_types tt ON t.trip_type_id = tt.id
        LEFT JOIN trip_participants tp ON t.id = tp.trip_id
        ${whereClause}
        GROUP BY t.id, tt.type_name, tt.category
        ORDER BY t.departure_date
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get trip details
  static async getTripDetails(req, res, next) {
    try {
      const { id } = req.params;

      const [tripResult, participantsResult, itineraryResult] = await Promise.all([
        query(`
          SELECT 
            t.*,
            tt.type_name,
            tt.category,
            COUNT(tp.id) as total_participants,
            COUNT(CASE WHEN tp.registration_status = 'confirmed' THEN 1 END) as confirmed_participants
          FROM trips t
          LEFT JOIN trip_types tt ON t.trip_type_id = tt.id
          LEFT JOIN trip_participants tp ON t.id = tp.trip_id
          WHERE t.id = $1 AND t.school_id = $2
          GROUP BY t.id, tt.type_name, tt.category
        `, [id, req.user.schoolId]),

        query(`
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
          WHERE tp.trip_id = $1
          ORDER BY tp.participant_type, participant_name
        `, [id]),

        query(`
          SELECT *
          FROM trip_itineraries
          WHERE trip_id = $1
          ORDER BY day_number, start_time
        `, [id])
      ]);

      if (tripResult.rows.length === 0) {
        throw new NotFoundError('Trip not found');
      }

      const trip = {
        ...tripResult.rows[0],
        participants: participantsResult.rows,
        itinerary: itineraryResult.rows
      };

      res.json({
        success: true,
        data: trip
      });
    } catch (error) {
      next(error);
    }
  }

  // Update trip
  static async updateTrip(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'trip_name', 'description', 'destination', 'departure_date', 'return_date',
        'departure_time', 'return_time', 'max_participants', 'cost_per_student',
        'deposit_required', 'payment_deadline', 'status'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id, req.user.schoolId);

      const result = await query(`
        UPDATE trips 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND school_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Trip not found');
      }

      res.json({
        success: true,
        message: 'Trip updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PARTICIPANT MANAGEMENT
  // =============================================================================

  // Add participants to trip
  static async addParticipants(req, res, next) {
    try {
      const { id } = req.params;
      const { participants } = req.body;

      if (!participants || !Array.isArray(participants)) {
        throw new ValidationError('Participants array is required');
      }

      // Check trip capacity
      const tripResult = await query(`
        SELECT max_participants, current_participants
        FROM trips 
        WHERE id = $1 AND school_id = $2
      `, [id, req.user.schoolId]);

      if (tripResult.rows.length === 0) {
        throw new NotFoundError('Trip not found');
      }

      const trip = tripResult.rows[0];
      const newParticipantCount = participants.length;

      if (trip.max_participants && 
          (trip.current_participants + newParticipantCount) > trip.max_participants) {
        throw new ConflictError('Adding these participants would exceed trip capacity');
      }

      const addedParticipants = [];
      const errors = [];

      for (const participant of participants) {
        try {
          // Check if already registered
          const existingResult = await query(`
            SELECT id FROM trip_participants 
            WHERE trip_id = $1 AND participant_id = $2
          `, [id, participant.participantId]);

          if (existingResult.rows.length > 0) {
            errors.push({
              participantId: participant.participantId,
              error: 'Already registered for this trip'
            });
            continue;
          }

          const result = await query(`
            INSERT INTO trip_participants (
              trip_id, participant_id, participant_type, registration_status,
              dietary_requirements, medical_conditions, emergency_medication,
              special_needs, emergency_contact_name, emergency_contact_phone,
              emergency_contact_relationship
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
          `, [
            id, participant.participantId, participant.participantType, 'registered',
            participant.dietaryRequirements, participant.medicalConditions,
            participant.emergencyMedication, participant.specialNeeds,
            participant.emergencyContactName, participant.emergencyContactPhone,
            participant.emergencyContactRelationship
          ]);

          addedParticipants.push(result.rows[0]);
        } catch (error) {
          errors.push({
            participantId: participant.participantId,
            error: error.message
          });
        }
      }

      // Update trip participant count
      await query(`
        UPDATE trips 
        SET current_participants = (
          SELECT COUNT(*) FROM trip_participants WHERE trip_id = $1
        )
        WHERE id = $1
      `, [id]);

      res.status(201).json({
        success: true,
        message: 'Participants processed successfully',
        data: {
          added: addedParticipants,
          errors: errors,
          totalProcessed: participants.length,
          successCount: addedParticipants.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Remove participant from trip
  static async removeParticipant(req, res, next) {
    try {
      const { id, participantId } = req.params;

      const result = await query(`
        DELETE FROM trip_participants 
        WHERE trip_id = $1 AND participant_id = $2
        RETURNING *
      `, [id, participantId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Participant not found in this trip');
      }

      // Update trip participant count
      await query(`
        UPDATE trips 
        SET current_participants = (
          SELECT COUNT(*) FROM trip_participants WHERE trip_id = $1
        )
        WHERE id = $1
      `, [id]);

      res.json({
        success: true,
        message: 'Participant removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PERMISSION MANAGEMENT
  // =============================================================================

  // Request permission for student
  static async requestPermission(req, res, next) {
    try {
      const {
        tripId,
        studentId,
        parentId,
        medicalTreatmentConsent = false,
        photographyConsent = false,
        emergencyContactConsent = false,
        specialInstructions = '',
        medicalInformation = ''
      } = req.body;

      if (!tripId || !studentId || !parentId) {
        throw new ValidationError('Trip ID, student ID, and parent ID are required');
      }

      // Check if permission already exists
      const existingResult = await query(`
        SELECT id FROM trip_permissions 
        WHERE trip_id = $1 AND student_id = $2
      `, [tripId, studentId]);

      if (existingResult.rows.length > 0) {
        throw new ConflictError('Permission request already exists for this student');
      }

      // Get parent information
      const parentResult = await query(`
        SELECT first_name, last_name FROM users 
        WHERE id = $1 AND user_type = 'school_user'
      `, [parentId]);

      if (parentResult.rows.length === 0) {
        throw new NotFoundError('Parent not found');
      }

      const parent = parentResult.rows[0];

      const result = await query(`
        INSERT INTO trip_permissions (
          trip_id, student_id, parent_id, permission_granted, permission_date,
          parent_name, parent_relationship, medical_treatment_consent,
          photography_consent, emergency_contact_consent, special_instructions,
          medical_information, submitted_via, ip_address
        ) VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, $4, 'parent', $5, $6, $7, $8, $9, 'online', $10)
        RETURNING *
      `, [
        tripId, studentId, parentId, `${parent.first_name} ${parent.last_name}`,
        medicalTreatmentConsent, photographyConsent, emergencyContactConsent,
        specialInstructions, medicalInformation, req.ip
      ]);

      res.status(201).json({
        success: true,
        message: 'Permission granted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get permission status
  static async getPermissionStatus(req, res, next) {
    try {
      const { tripId, studentId } = req.params;

      const result = await query(`
        SELECT 
          tp.*,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          t.trip_name
        FROM trip_permissions tp
        JOIN students s ON tp.student_id = s.id
        JOIN trips t ON tp.trip_id = t.id
        WHERE tp.trip_id = $1 AND tp.student_id = $2 AND t.school_id = $3
      `, [tripId, studentId, req.user.schoolId]);

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: 'No permission found for this student'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all permissions for a trip
  static async getTripPermissions(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.query;

      let whereClause = 'WHERE tp.trip_id = $1 AND t.school_id = $2';
      const params = [id, req.user.schoolId];

      if (status) {
        if (status === 'granted') {
          whereClause += ` AND tp.permission_granted = true`;
        } else if (status === 'pending') {
          whereClause += ` AND tp.permission_granted = false`;
        }
      }

      const result = await query(`
        SELECT 
          tp.*,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          c.class_name
        FROM trip_permissions tp
        JOIN students s ON tp.student_id = s.id
        JOIN trips t ON tp.trip_id = t.id
        LEFT JOIN classes c ON s.class_id = c.id
        ${whereClause}
        ORDER BY s.last_name, s.first_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ITINERARY MANAGEMENT
  // =============================================================================

  // Create itinerary
  static async createItinerary(req, res, next) {
    try {
      const { id } = req.params;
      const { itinerary } = req.body;

      if (!itinerary || !Array.isArray(itinerary)) {
        throw new ValidationError('Itinerary array is required');
      }

      // Clear existing itinerary
      await query(`DELETE FROM trip_itineraries WHERE trip_id = $1`, [id]);

      // Add new itinerary items
      const createdItems = [];
      for (const item of itinerary) {
        const result = await query(`
          INSERT INTO trip_itineraries (
            trip_id, day_number, activity_date, start_time, end_time,
            activity_title, activity_description, location, activity_type,
            supervisor_required, headcount_required, special_equipment,
            risk_level, safety_notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `, [
          id, item.dayNumber, item.activityDate, item.startTime, item.endTime,
          item.activityTitle, item.activityDescription, item.location,
          item.activityType, item.supervisorRequired !== false,
          item.headcountRequired !== false, item.specialEquipment,
          item.riskLevel || 'low', item.safetyNotes
        ]);

        createdItems.push(result.rows[0]);
      }

      res.status(201).json({
        success: true,
        message: 'Itinerary created successfully',
        data: createdItems
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // EXPENSE MANAGEMENT
  // =============================================================================

  // Add trip expense
  static async addExpense(req, res, next) {
    try {
      const { id } = req.params;
      const {
        expenseCategory,
        description,
        estimatedCost,
        actualCost,
        costPerParticipant,
        vendorName,
        vendorContact,
        invoiceReference
      } = req.body;

      if (!expenseCategory || !description) {
        throw new ValidationError('Expense category and description are required');
      }

      const result = await query(`
        INSERT INTO trip_expenses (
          trip_id, expense_category, description, estimated_cost, actual_cost,
          cost_per_participant, vendor_name, vendor_contact, invoice_reference,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        id, expenseCategory, description, estimatedCost, actualCost,
        costPerParticipant, vendorName, vendorContact, invoiceReference,
        req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Expense added successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get trip expenses
  static async getTripExpenses(req, res, next) {
    try {
      const { id } = req.params;
      const { category, paymentStatus } = req.query;

      let whereClause = 'WHERE trip_id = $1';
      const params = [id];

      if (category) {
        whereClause += ` AND expense_category = $${params.length + 1}`;
        params.push(category);
      }

      if (paymentStatus) {
        whereClause += ` AND payment_status = $${params.length + 1}`;
        params.push(paymentStatus);
      }

      const result = await query(`
        SELECT *
        FROM trip_expenses 
        ${whereClause}
        ORDER BY expense_category, created_at
      `, params);

      // Calculate totals
      const totals = {
        totalEstimated: result.rows.reduce((sum, expense) => sum + (parseFloat(expense.estimated_cost) || 0), 0),
        totalActual: result.rows.reduce((sum, expense) => sum + (parseFloat(expense.actual_cost) || 0), 0),
        totalPaid: result.rows.filter(e => e.payment_status === 'paid').reduce((sum, expense) => sum + (parseFloat(expense.actual_cost) || 0), 0)
      };

      res.json({
        success: true,
        data: {
          expenses: result.rows,
          totals
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SAFETY MANAGEMENT
  // =============================================================================

  // Add safety measure
  static async addSafetyMeasure(req, res, next) {
    try {
      const { id } = req.params;
      const {
        safetyCategory,
        measureTitle,
        description,
        responsiblePerson,
        implementationNotes,
        requiredEquipment = []
      } = req.body;

      if (!safetyCategory || !measureTitle || !description) {
        throw new ValidationError('Safety category, measure title, and description are required');
      }

      const result = await query(`
        INSERT INTO trip_safety_measures (
          trip_id, safety_category, measure_title, description,
          responsible_person, implementation_notes, required_equipment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        id, safetyCategory, measureTitle, description,
        responsiblePerson, implementationNotes, JSON.stringify(requiredEquipment)
      ]);

      res.status(201).json({
        success: true,
        message: 'Safety measure added successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get safety info
  static async getSafetyInfo(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        SELECT *
        FROM trip_safety_measures
        WHERE trip_id = $1
        ORDER BY safety_category, created_at
      `, [id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // FEEDBACK AND EVALUATION
  // =============================================================================

  // Submit trip feedback
  static async submitFeedback(req, res, next) {
    try {
      const { id } = req.params;
      const {
        feedbackType,
        overallRating,
        organizationRating,
        safetyRating,
        educationalValueRating,
        costValueRating,
        highlights,
        areasForImprovement,
        wouldRecommend,
        additionalComments,
        suggestedImprovements = [],
        futureTripSuggestions
      } = req.body;

      if (!feedbackType || overallRating === undefined) {
        throw new ValidationError('Feedback type and overall rating are required');
      }

      const result = await query(`
        INSERT INTO trip_feedback (
          trip_id, feedback_provider_id, feedback_type, overall_rating,
          organization_rating, safety_rating, educational_value_rating,
          cost_value_rating, highlights, areas_for_improvement,
          would_recommend, additional_comments, suggested_improvements,
          future_trip_suggestions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        id, req.user.userId, feedbackType, overallRating,
        organizationRating, safetyRating, educationalValueRating,
        costValueRating, highlights, areasForImprovement,
        wouldRecommend, additionalComments, JSON.stringify(suggestedImprovements),
        futureTripSuggestions
      ]);

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get trip feedback
  static async getTripFeedback(req, res, next) {
    try {
      const { id } = req.params;
      const { feedbackType } = req.query;

      let whereClause = 'WHERE tf.trip_id = $1';
      const params = [id];

      if (feedbackType) {
        whereClause += ` AND tf.feedback_type = $${params.length + 1}`;
        params.push(feedbackType);
      }

      const result = await query(`
        SELECT 
          tf.*,
          CASE 
            WHEN tf.feedback_type = 'student' THEN s.first_name || ' ' || s.last_name
            WHEN tf.feedback_type = 'teacher' THEN st.first_name || ' ' || st.last_name
            ELSE u.first_name || ' ' || u.last_name
          END as provider_name
        FROM trip_feedback tf
        LEFT JOIN students s ON tf.feedback_provider_id = s.id AND tf.feedback_type = 'student'
        LEFT JOIN staff st ON tf.feedback_provider_id = st.id AND tf.feedback_type = 'teacher'
        LEFT JOIN users u ON tf.feedback_provider_id = u.id
        ${whereClause}
        ORDER BY tf.submitted_at DESC
      `, params);

      // Calculate average ratings
      const averages = {
        overallRating: 0,
        organizationRating: 0,
        safetyRating: 0,
        educationalValueRating: 0,
        costValueRating: 0
      };

      if (result.rows.length > 0) {
        const ratings = result.rows.filter(feedback => feedback.overall_rating !== null);
        if (ratings.length > 0) {
          averages.overallRating = ratings.reduce((sum, f) => sum + parseFloat(f.overall_rating), 0) / ratings.length;
          averages.organizationRating = ratings.reduce((sum, f) => sum + (parseFloat(f.organization_rating) || 0), 0) / ratings.length;
          averages.safetyRating = ratings.reduce((sum, f) => sum + (parseFloat(f.safety_rating) || 0), 0) / ratings.length;
          averages.educationalValueRating = ratings.reduce((sum, f) => sum + (parseFloat(f.educational_value_rating) || 0), 0) / ratings.length;
          averages.costValueRating = ratings.reduce((sum, f) => sum + (parseFloat(f.cost_value_rating) || 0), 0) / ratings.length;
        }
      }

      res.json({
        success: true,
        data: {
          feedback: result.rows,
          averages,
          totalResponses: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // UPCOMING TRIPS
  // =============================================================================

  // Get upcoming trips
  static async getUpcomingTrips(req, res, next) {
    try {
      const { days = 30 } = req.query;

      const result = await query(`
        SELECT 
          t.*,
          tt.type_name,
          tt.category,
          COUNT(tp.id) as registered_participants
        FROM trips t
        LEFT JOIN trip_types tt ON t.trip_type_id = tt.id
        LEFT JOIN trip_participants tp ON t.id = tp.trip_id
        WHERE t.school_id = $1 
          AND t.departure_date >= CURRENT_DATE 
          AND t.departure_date <= CURRENT_DATE + INTERVAL '${parseInt(days)} days'
          AND t.status IN ('open_registration', 'confirmed')
        GROUP BY t.id, tt.type_name, tt.category
        ORDER BY t.departure_date
      `, [req.user.schoolId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TripsController;