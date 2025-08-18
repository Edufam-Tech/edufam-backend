const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const TimetableController = require('../controllers/timetableController');
const { query } = require('../config/database');
const { ValidationError } = require('../middleware/errorHandler');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType('school_user'));

// =============================================================================
// TIMETABLE CONFIGURATION ROUTES
// =============================================================================

/**
 * @route   POST /api/timetable/configurations
 * @desc    Create a new timetable configuration
 * @access  Private (Principal, School Director)
 */
router.post('/configurations',
  requireRole(['principal', 'school_director']),
  TimetableController.createConfiguration
);

/**
 * @route   GET /api/timetable/configurations
 * @desc    Get all timetable configurations
 * @access  Private (All school staff)
 */
router.get('/configurations',
  TimetableController.getConfigurations
);

/**
 * @route   PUT /api/timetable/configurations/:id
 * @desc    Update a timetable configuration
 * @access  Private (Principal, School Director)
 */
router.put('/configurations/:id',
  requireRole(['principal', 'school_director']),
  TimetableController.updateConfiguration
);

// =============================================================================
// AI TIMETABLE GENERATION ROUTES
// =============================================================================

/**
 * @route   POST /api/timetable/generate
 * @desc    Generate timetable using AI
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/generate',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  TimetableController.generateTimetable
);

/**
 * @route   POST /api/timetable/publish
 * @desc    Publish a timetable version
 * @access  Private (Principal, School Director)
 */
router.post('/publish',
  requireRole(['principal', 'school_director']),
  TimetableController.publishTimetable
);

/**
 * @route   GET /api/timetable/versions
 * @desc    Get timetable versions with pagination
 * @access  Private (All school staff)
 */
router.get('/versions',
  TimetableController.getVersions
);

/**
 * @route   GET /api/timetable/versions/:versionId/entries
 * @desc    Get all timetable entries for a specific version
 * @access  Private (All school staff)
 */
router.get('/versions/:versionId/entries',
  async (req, res, next) => {
    try {
      const { versionId } = req.params;
      if (!versionId) {
        throw new ValidationError('Version ID is required');
      }
      const data = await TimetableController.getVersionEntries(versionId, req.user.schoolId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// CONSTRAINT MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   POST /api/timetable/teacher-availability
 * @desc    Set teacher availability constraints
 * @access  Private (Principal, School Director, Teacher for self)
 */
router.post('/teacher-availability',
  requireRole(['principal', 'school_director', 'teacher', 'academic_coordinator']),
  TimetableController.setTeacherAvailability
);

/**
 * @route   GET /api/timetable/teacher-availability/:teacherId
 * @desc    Get teacher availability constraints
 * @access  Private (All school staff)
 */
router.get('/teacher-availability/:teacherId',
  TimetableController.getTeacherAvailability
);

/**
 * @route   GET /api/timetable/conflicts
 * @desc    Get timetable conflicts
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/conflicts',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  TimetableController.getConflicts
);

// =============================================================================
// TIMETABLE VIEWING ROUTES
// =============================================================================

/**
 * @route   GET /api/timetable/published
 * @desc    Get published timetable
 * @access  Private (All school users including parents)
 */
router.get('/published',
  TimetableController.getPublishedTimetable
);

/**
 * @route   GET /api/timetable/today
 * @desc    Get today's timetable for the authenticated user
 * @access  Private (All school users)
 */
router.get('/today',
  async (req, res, next) => {
    try {
      const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toLowerCase();
      const role = req.user.role;
      const userId = req.user.userId;
      const schoolId = req.user.schoolId;

      let result;
      if (role === 'teacher' || role === 'head_teacher') {
        result = await query(`
          SELECT te.*
          FROM timetable_entries te
          WHERE te.school_id = $1 AND te.teacher_id = $2 AND te.day_of_week = $3
          ORDER BY te.period_number
        `, [schoolId, userId, dayOfWeek]);
      } else if (role === 'parent') {
        // Return entries for all classes of the parent's children
        result = await query(`
          SELECT te.*
          FROM timetable_entries te
          JOIN students s ON te.class_id = s.class_id
          JOIN parent_students ps ON ps.student_id = s.id
          WHERE te.school_id = $1 AND ps.parent_id = $2 AND te.day_of_week = $3
          ORDER BY te.class_id, te.period_number
        `, [schoolId, userId, dayOfWeek]);
      } else {
        // Generic: return school timetable for today
        result = await query(`
          SELECT te.*
          FROM timetable_entries te
          WHERE te.school_id = $1 AND te.day_of_week = $2
          ORDER BY te.class_id, te.period_number
        `, [schoolId, dayOfWeek]);
      }

      res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
  }
);

/**
 * @route   GET /api/timetable/analytics
 * @desc    Get timetable analytics and statistics
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/analytics',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  TimetableController.getAnalytics
);

// =============================================================================
// DISTRIBUTION AND EXPORT ROUTES (Minimal implementation)
// =============================================================================

/**
 * @route   POST /api/timetable/distribute
 * @desc    Distribute a timetable version to stakeholders
 * @access  Private (Principal, School Director)
 */
router.post('/distribute',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const result = await TimetableController.distributeTimetable(req, res);
      return result; // controller handles response
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/timetable/teacher/:teacherId
 * @desc    Get a teacher's personal schedule from published timetable
 * @access  Private (All school staff)
 */
router.get('/teacher/:teacherId',
  async (req, res, next) => {
    try {
      const data = await TimetableController.getTeacherSchedule(req.params.teacherId, req.user.schoolId);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }
);

/**
 * @route   GET /api/timetable/parent/:studentId
 * @desc    Get a student's class timetable for parents
 * @access  Private (Parents and school staff)
 */
router.get('/parent/:studentId',
  async (req, res, next) => {
    try {
      const data = await TimetableController.getStudentClassTimetable(req.params.studentId, req.user.schoolId);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }
);

/**
 * @route   POST /api/timetable/export-pdf
 * @desc    Generate a branded PDF for a timetable
 * @access  Private (Principal, School Director)
 */
router.post('/export-pdf',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const data = await TimetableController.exportPdf(req.body, req.user.schoolId);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }
);

/**
 * @route   POST /api/timetable/notify-stakeholders
 * @desc    Notify teachers and parents about timetable updates
 * @access  Private (Principal, School Director)
 */
router.post('/notify-stakeholders',
  requireRole(['principal', 'school_director']),
  async (req, res, next) => {
    try {
      const data = await TimetableController.notifyStakeholders(req.body, req.user.schoolId, req.user.userId);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }
);

// =============================================================================
// ADDITIONAL CONSTRAINT ROUTES
// =============================================================================

/**
 * @route   POST /api/timetable/room-availability
 * @desc    Set room availability constraints
 * @access  Private (Principal, School Director, Facilities Manager)
 */
router.post('/room-availability',
  requireRole(['principal', 'school_director', 'facilities_manager']),
  async (req, res, next) => {
    try {
      const {
        roomId,
        dayOfWeek,
        startTime,
        endTime,
        availabilityType = 'available',
        reason
      } = req.body;

      if (!roomId || !dayOfWeek || !startTime || !endTime) {
        throw new ValidationError('Room ID, day of week, start time, and end time are required');
      }

      const result = await query(`
        INSERT INTO room_availability (
          school_id, room_id, day_of_week, start_time, end_time,
          availability_type, reason, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (school_id, room_id, day_of_week, start_time)
        DO UPDATE SET 
          end_time = EXCLUDED.end_time,
          availability_type = EXCLUDED.availability_type,
          reason = EXCLUDED.reason,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        req.user.schoolId, roomId, dayOfWeek, startTime, endTime,
        availabilityType, reason, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Room availability set successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/timetable/room-availability/:roomId
 * @desc    Get room availability constraints
 * @access  Private (All school staff)
 */
router.get('/room-availability/:roomId',
  async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { dayOfWeek } = req.query;

      let whereClause = 'WHERE ra.school_id = $1 AND ra.room_id = $2';
      const params = [req.user.schoolId, roomId];

      if (dayOfWeek) {
        whereClause += ` AND ra.day_of_week = $${params.length + 1}`;
        params.push(dayOfWeek);
      }

      const result = await query(`
        SELECT ra.*, cr.room_name, cr.building
        FROM room_availability ra
        JOIN classrooms cr ON ra.room_id = cr.id
        ${whereClause}
        ORDER BY ra.day_of_week, ra.start_time
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
 * @route   POST /api/timetable/subject-requirements
 * @desc    Set subject requirements (lab needs, double periods, etc.)
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/subject-requirements',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  async (req, res, next) => {
    try {
      const {
        subjectId,
        requiresLab = false,
        requiresComputerLab = false,
        requiresDoublePeriod = false,
        preferredTimeOfDay = 'any',
        maxConsecutivePeriods = 1
      } = req.body;

      if (!subjectId) {
        throw new ValidationError('Subject ID is required');
      }

      const result = await query(`
        INSERT INTO subject_requirements (
          school_id, subject_id, requires_lab, requires_computer_lab,
          requires_double_period, preferred_time_of_day, max_consecutive_periods
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (school_id, subject_id)
        DO UPDATE SET 
          requires_lab = EXCLUDED.requires_lab,
          requires_computer_lab = EXCLUDED.requires_computer_lab,
          requires_double_period = EXCLUDED.requires_double_period,
          preferred_time_of_day = EXCLUDED.preferred_time_of_day,
          max_consecutive_periods = EXCLUDED.max_consecutive_periods,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        req.user.schoolId, subjectId, requiresLab, requiresComputerLab,
        requiresDoublePeriod, preferredTimeOfDay, maxConsecutivePeriods
      ]);

      res.status(201).json({
        success: true,
        message: 'Subject requirements set successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/timetable/subject-requirements
 * @desc    Get subject requirements
 * @access  Private (All school staff)
 */
router.get('/subject-requirements',
  async (req, res, next) => {
    try {
      const { subjectId } = req.query;

      let whereClause = 'WHERE sr.school_id = $1';
      const params = [req.user.schoolId];

      if (subjectId) {
        whereClause += ` AND sr.subject_id = $${params.length + 1}`;
        params.push(subjectId);
      }

      const result = await query(`
        SELECT sr.*, s.subject_name, s.subject_code
        FROM subject_requirements sr
        JOIN subjects s ON sr.subject_id = s.id
        ${whereClause}
        ORDER BY s.subject_name
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
 * @route   POST /api/timetable/preferences
 * @desc    Set teacher preferences
 * @access  Private (Teacher for self, Principal, School Director for any teacher)
 */
router.post('/preferences',
  requireRole(['teacher', 'principal', 'school_director', 'academic_coordinator']),
  async (req, res, next) => {
    try {
      const {
        teacherId,
        preferenceType,
        dayOfWeek,
        periodNumber,
        preferenceStrength = 'medium',
        notes
      } = req.body;

      if (!teacherId || !preferenceType) {
        throw new ValidationError('Teacher ID and preference type are required');
      }

      // If user is a teacher, they can only set preferences for themselves
      if (req.user.role === 'teacher' && teacherId !== req.user.userId) {
        throw new ValidationError('Teachers can only set preferences for themselves');
      }

      const result = await query(`
        INSERT INTO timetable_preferences (
          school_id, teacher_id, preference_type, day_of_week,
          period_number, preference_strength, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        req.user.schoolId, teacherId, preferenceType, dayOfWeek,
        periodNumber, preferenceStrength, notes
      ]);

      res.status(201).json({
        success: true,
        message: 'Teacher preference set successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/timetable/preferences
 * @desc    Get teacher preferences
 * @access  Private (All school staff)
 */
router.get('/preferences',
  async (req, res, next) => {
    try {
      const { teacherId, preferenceType } = req.query;

      let whereClause = 'WHERE tp.school_id = $1';
      const params = [req.user.schoolId];

      if (teacherId) {
        whereClause += ` AND tp.teacher_id = $${params.length + 1}`;
        params.push(teacherId);
      }

      if (preferenceType) {
        whereClause += ` AND tp.preference_type = $${params.length + 1}`;
        params.push(preferenceType);
      }

      const result = await query(`
        SELECT tp.*, s.first_name, s.last_name
        FROM timetable_preferences tp
        JOIN staff s ON tp.teacher_id = s.id
        ${whereClause}
        ORDER BY s.first_name, s.last_name, tp.preference_type
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
 * @route   POST /api/timetable/validate
 * @desc    Validate timetable for conflicts
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.post('/validate',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  async (req, res, next) => {
    try {
      const { versionId } = req.body;

      if (!versionId) {
        throw new ValidationError('Version ID is required');
      }

      // Run conflict detection
      const conflicts = await TimetableController.detectConflicts(versionId, req.user.schoolId);

      // Get detailed validation results
      const validationResult = await query(`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(DISTINCT class_id) as classes_covered,
          COUNT(DISTINCT teacher_id) as teachers_assigned,
          AVG(ai_score) as average_score
        FROM timetable_entries 
        WHERE school_id = $1 AND version_id = $2
      `, [req.user.schoolId, versionId]);

      res.json({
        success: true,
        data: {
          isValid: conflicts.length === 0,
          conflicts: conflicts.length,
          validationSummary: validationResult.rows[0],
          conflictDetails: conflicts
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/timetable/suggestions
 * @desc    Get AI suggestions for timetable improvements
 * @access  Private (Principal, School Director, Academic Coordinator)
 */
router.get('/suggestions',
  requireRole(['principal', 'school_director', 'academic_coordinator']),
  async (req, res, next) => {
    try {
      const { versionId } = req.query;

      if (!versionId) {
        throw new ValidationError('Version ID is required');
      }

      // Simple AI suggestions based on conflicts and utilization
      const suggestions = [];

      // Check for teacher workload balance
      const workloadResult = await query(`
        SELECT 
          teacher_id,
          s.first_name,
          s.last_name,
          COUNT(*) as periods_assigned
        FROM timetable_entries te
        JOIN staff s ON te.teacher_id = s.id
        WHERE te.school_id = $1 AND te.version_id = $2
        GROUP BY teacher_id, s.first_name, s.last_name
        ORDER BY periods_assigned DESC
      `, [req.user.schoolId, versionId]);

      const workloads = workloadResult.rows;
      if (workloads.length > 0) {
        const maxWorkload = workloads[0].periods_assigned;
        const minWorkload = workloads[workloads.length - 1].periods_assigned;
        
        if (maxWorkload - minWorkload > 5) {
          suggestions.push({
            type: 'workload_balance',
            priority: 'medium',
            description: 'Consider balancing teacher workloads more evenly',
            details: `Workload difference: ${maxWorkload - minWorkload} periods between highest and lowest assigned teachers`
          });
        }
      }

      // Check for empty periods
      const utilizationResult = await query(`
        SELECT day_of_week, period_number, COUNT(*) as classes_scheduled
        FROM timetable_entries 
        WHERE school_id = $1 AND version_id = $2
        GROUP BY day_of_week, period_number
        HAVING COUNT(*) < (SELECT COUNT(*) FROM classes WHERE school_id = $1 AND is_active = true) / 2
      `, [req.user.schoolId, versionId]);

      if (utilizationResult.rows.length > 0) {
        suggestions.push({
          type: 'utilization',
          priority: 'low',
          description: 'Some time slots are underutilized',
          details: `${utilizationResult.rows.length} periods have low class scheduling`
        });
      }

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Import required modules for inline functions

module.exports = router;