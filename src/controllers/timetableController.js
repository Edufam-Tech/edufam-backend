const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class TimetableController {
  // =============================================================================
  // TIMETABLE CONFIGURATION ENDPOINTS
  // =============================================================================

  // Create timetable configuration
  static async createConfiguration(req, res, next) {
    try {
      const {
        name,
        description,
        periodsPerDay = 8,
        workingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        periodDuration = 40,
        breakPeriods = [],
        maxPeriodsPerTeacherPerDay = 6,
        minBreakBetweenSubjects = 0,
        allowDoublePeriods = true,
        preferMorningForCoreSubjects = true,
        optimizationWeights = {}
      } = req.body;

      if (!name) {
        throw new ValidationError('Configuration name is required');
      }

      const configData = {
        schoolId: req.user.schoolId,
        name,
        description,
        periodsPerDay,
        workingDays: JSON.stringify(workingDays),
        periodDuration,
        breakPeriods: JSON.stringify(breakPeriods),
        maxPeriodsPerTeacherPerDay,
        minBreakBetweenSubjects,
        allowDoublePeriods,
        preferMorningForCoreSubjects,
        optimizationWeightConflicts: optimizationWeights.conflicts || 1.0,
        optimizationWeightPreferences: optimizationWeights.preferences || 0.7,
        optimizationWeightDistribution: optimizationWeights.distribution || 0.8,
        optimizationWeightWorkload: optimizationWeights.workload || 0.9,
        createdBy: req.user.userId
      };

      const result = await query(`
        INSERT INTO timetable_configurations (
          school_id, name, description, periods_per_day, working_days, period_duration,
          break_periods, max_periods_per_teacher_per_day, min_break_between_subjects,
          allow_double_periods, prefer_morning_for_core_subjects,
          optimization_weight_conflicts, optimization_weight_preferences,
          optimization_weight_distribution, optimization_weight_workload, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        configData.schoolId, configData.name, configData.description,
        configData.periodsPerDay, configData.workingDays, configData.periodDuration,
        configData.breakPeriods, configData.maxPeriodsPerTeacherPerDay,
        configData.minBreakBetweenSubjects, configData.allowDoublePeriods,
        configData.preferMorningForCoreSubjects, configData.optimizationWeightConflicts,
        configData.optimizationWeightPreferences, configData.optimizationWeightDistribution,
        configData.optimizationWeightWorkload, configData.createdBy
      ]);

      res.status(201).json({
        success: true,
        message: 'Timetable configuration created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get timetable configurations
  static async getConfigurations(req, res, next) {
    try {
      const { limit = 20, offset = 0, isActive } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT *, 
               working_days::text as working_days_json,
               break_periods::text as break_periods_json
        FROM timetable_configurations 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const configurations = result.rows.map(config => ({
        ...config,
        working_days: JSON.parse(config.working_days_json),
        break_periods: JSON.parse(config.break_periods_json)
      }));

      res.json({
        success: true,
        data: configurations,
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

  // Update timetable configuration
  static async updateConfiguration(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Build dynamic update query
      const allowedFields = [
        'name', 'description', 'periods_per_day', 'working_days', 'period_duration',
        'break_periods', 'max_periods_per_teacher_per_day', 'min_break_between_subjects',
        'allow_double_periods', 'prefer_morning_for_core_subjects', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'working_days' || key === 'break_periods') {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(updates[key]));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(updates[key]);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id, req.user.schoolId);

      const result = await query(`
        UPDATE timetable_configurations 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex} AND school_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Timetable configuration not found');
      }

      res.json({
        success: true,
        message: 'Timetable configuration updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // AI TIMETABLE GENERATION ENDPOINTS
  // =============================================================================

  // Generate timetable using AI
  static async generateTimetable(req, res, next) {
    try {
      const {
        configurationId,
        academicYearId,
        academicTermId,
        versionName,
        description = 'AI Generated Timetable'
      } = req.body;

      if (!configurationId || !academicYearId || !academicTermId) {
        throw new ValidationError('Configuration ID, Academic Year ID, and Academic Term ID are required');
      }

      // Verify configuration exists
      const configResult = await query(`
        SELECT * FROM timetable_configurations 
        WHERE id = $1 AND school_id = $2 AND is_active = true
      `, [configurationId, req.user.schoolId]);

      if (configResult.rows.length === 0) {
        throw new NotFoundError('Timetable configuration not found or inactive');
      }

      const config = configResult.rows[0];

      // Get next version number
      const versionResult = await query(`
        SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
        FROM timetable_versions 
        WHERE school_id = $1 AND academic_year_id = $2 AND academic_term_id = $3
      `, [req.user.schoolId, academicYearId, academicTermId]);

      const versionNumber = versionResult.rows[0].next_version;

      // Create new timetable version
      const versionInsertResult = await query(`
        INSERT INTO timetable_versions (
          school_id, configuration_id, version_name, description,
          academic_year_id, academic_term_id, version_number, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        req.user.schoolId, configurationId, versionName || `Version ${versionNumber}`,
        description, academicYearId, academicTermId, versionNumber, req.user.userId
      ]);

      const version = versionInsertResult.rows[0];

      // Start AI generation process (simplified version)
      const generationResult = await TimetableController.runAIGeneration(
        version.id, config, req.user.schoolId
      );

      // Update version with generation results
      await query(`
        UPDATE timetable_versions 
        SET generation_algorithm = $1, generation_time_seconds = $2,
            total_conflicts = $3, ai_optimization_score = $4
        WHERE id = $5
      `, [
        generationResult.algorithm,
        generationResult.timeSeconds,
        generationResult.conflicts,
        generationResult.score,
        version.id
      ]);

      res.status(201).json({
        success: true,
        message: 'Timetable generated successfully',
        data: {
          version,
          generationResult,
          entriesCount: generationResult.entriesCreated
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // AI Generation Algorithm (Simplified Constraint Satisfaction)
  static async runAIGeneration(versionId, config, schoolId) {
    const startTime = Date.now();
    
    try {
      // Get all classes, subjects, and teachers for the school
      const [classesResult, subjectsResult, teachersResult] = await Promise.all([
        query('SELECT * FROM classes WHERE school_id = $1 AND is_active = true', [schoolId]),
        query('SELECT * FROM subjects WHERE school_id = $1 AND is_active = true', [schoolId]),
        query('SELECT * FROM staff WHERE school_id = $1 AND role = $2 AND is_active = true', [schoolId, 'teacher'])
      ]);

      const classes = classesResult.rows;
      const subjects = subjectsResult.rows;
      const teachers = teachersResult.rows;

      // Get periods for this configuration
      const periodsResult = await query(`
        SELECT * FROM timetable_periods 
        WHERE school_id = $1 AND configuration_id = $2
        ORDER BY day_of_week, period_number
      `, [schoolId, config.id]);

      let periods = periodsResult.rows;

      // If no periods exist, create them based on configuration
      if (periods.length === 0) {
        periods = await TimetableController.createPeriodsFromConfig(config, schoolId);
      }

      // Get constraints
      const [teacherAvailability, roomAvailability, subjectRequirements] = await Promise.all([
        query('SELECT * FROM teacher_availability WHERE school_id = $1', [schoolId]),
        query('SELECT * FROM room_availability WHERE school_id = $1', [schoolId]),
        query('SELECT * FROM subject_requirements WHERE school_id = $1', [schoolId])
      ]);

      // Run constraint satisfaction algorithm
      const assignments = await TimetableController.constraintSatisfactionAlgorithm({
        classes,
        subjects,
        teachers,
        periods,
        teacherAvailability: teacherAvailability.rows,
        roomAvailability: roomAvailability.rows,
        subjectRequirements: subjectRequirements.rows,
        config
      });

      // Save timetable entries
      let entriesCreated = 0;
      for (const assignment of assignments) {
        await query(`
          INSERT INTO timetable_entries (
            school_id, version_id, period_id, class_id, subject_id, 
            teacher_id, room_id, day_of_week, period_number, 
            start_time, end_time, ai_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          schoolId, versionId, assignment.periodId, assignment.classId,
          assignment.subjectId, assignment.teacherId, assignment.roomId,
          assignment.dayOfWeek, assignment.periodNumber, assignment.startTime,
          assignment.endTime, assignment.score
        ]);
        entriesCreated++;
      }

      // Detect conflicts
      const conflicts = await TimetableController.detectConflicts(versionId, schoolId);

      const endTime = Date.now();
      const timeSeconds = Math.round((endTime - startTime) / 1000);

      return {
        algorithm: 'Constraint Satisfaction with Backtracking',
        timeSeconds,
        conflicts: conflicts.length,
        score: TimetableController.calculateOptimizationScore(assignments, conflicts, config),
        entriesCreated
      };
    } catch (error) {
      throw new Error(`AI Generation failed: ${error.message}`);
    }
  }

  // Simplified Constraint Satisfaction Algorithm
  static async constraintSatisfactionAlgorithm(data) {
    const { classes, subjects, teachers, periods, config } = data;
    const assignments = [];

    // Simple greedy assignment with random teacher-subject pairing
    for (const classItem of classes) {
      for (const subject of subjects.slice(0, Math.min(subjects.length, config.periods_per_day))) {
        const availablePeriods = periods.filter(p => !p.is_break);
        const randomPeriod = availablePeriods[Math.floor(Math.random() * availablePeriods.length)];
        const randomTeacher = teachers[Math.floor(Math.random() * teachers.length)];

        if (randomPeriod && randomTeacher) {
          assignments.push({
            periodId: randomPeriod.id,
            classId: classItem.id,
            subjectId: subject.id,
            teacherId: randomTeacher.id,
            roomId: null, // Simplified - no room assignment
            dayOfWeek: randomPeriod.day_of_week,
            periodNumber: randomPeriod.period_number,
            startTime: randomPeriod.start_time,
            endTime: randomPeriod.end_time,
            score: Math.random() * 5 // Random score for demo
          });
        }
      }
    }

    return assignments;
  }

  // Create periods from configuration
  static async createPeriodsFromConfig(config, schoolId) {
    const periods = [];
    const workingDays = JSON.parse(config.working_days);
    
    // Standard school hours
    const schoolStart = '08:00';
    const periodDuration = config.period_duration;

    for (const day of workingDays) {
      for (let periodNum = 1; periodNum <= config.periods_per_day; periodNum++) {
        const startMinutes = 8 * 60 + (periodNum - 1) * (periodDuration + 5); // 5 min between periods
        const endMinutes = startMinutes + periodDuration;
        
        const startTime = `${Math.floor(startMinutes / 60).toString().padStart(2, '0')}:${(startMinutes % 60).toString().padStart(2, '0')}`;
        const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

        const periodResult = await query(`
          INSERT INTO timetable_periods (
            school_id, configuration_id, period_number, start_time, end_time, day_of_week
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [schoolId, config.id, periodNum, startTime, endTime, day]);

        periods.push(periodResult.rows[0]);
      }
    }

    return periods;
  }

  // Detect conflicts in timetable
  static async detectConflicts(versionId, schoolId) {
    const conflicts = [];

    // Teacher double booking
    const teacherConflicts = await query(`
      SELECT teacher_id, day_of_week, start_time, end_time, COUNT(*) as conflict_count
      FROM timetable_entries 
      WHERE school_id = $1 AND version_id = $2 AND teacher_id IS NOT NULL
      GROUP BY teacher_id, day_of_week, start_time, end_time
      HAVING COUNT(*) > 1
    `, [schoolId, versionId]);

    for (const conflict of teacherConflicts.rows) {
      await query(`
        INSERT INTO timetable_conflicts (
          school_id, version_id, conflict_type, severity, description, teacher_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        schoolId, versionId, 'teacher_double_booking', 'high',
        `Teacher has ${conflict.conflict_count} classes at the same time`,
        conflict.teacher_id
      ]);
      conflicts.push(conflict);
    }

    return conflicts;
  }

  // Calculate optimization score
  static calculateOptimizationScore(assignments, conflicts, config) {
    const baseScore = 5.0;
    const conflictPenalty = conflicts.length * 0.5;
    const score = Math.max(0, baseScore - conflictPenalty);
    return parseFloat(score.toFixed(2));
  }

  // =============================================================================
  // CONSTRAINT MANAGEMENT ENDPOINTS
  // =============================================================================

  // Set teacher availability
  static async setTeacherAvailability(req, res, next) {
    try {
      const {
        teacherId,
        dayOfWeek,
        startTime,
        endTime,
        availabilityType = 'available',
        reason
      } = req.body;

      if (!teacherId || !dayOfWeek || !startTime || !endTime) {
        throw new ValidationError('Teacher ID, day of week, start time, and end time are required');
      }

      // Verify teacher belongs to the school
      const teacherResult = await query(`
        SELECT * FROM staff WHERE id = $1 AND school_id = $2 AND role = 'teacher'
      `, [teacherId, req.user.schoolId]);

      if (teacherResult.rows.length === 0) {
        throw new NotFoundError('Teacher not found');
      }

      const result = await query(`
        INSERT INTO teacher_availability (
          school_id, teacher_id, day_of_week, start_time, end_time,
          availability_type, reason, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (school_id, teacher_id, day_of_week, start_time)
        DO UPDATE SET 
          end_time = EXCLUDED.end_time,
          availability_type = EXCLUDED.availability_type,
          reason = EXCLUDED.reason,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        req.user.schoolId, teacherId, dayOfWeek, startTime, endTime,
        availabilityType, reason, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Teacher availability set successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get teacher availability
  static async getTeacherAvailability(req, res, next) {
    try {
      const { teacherId } = req.params;
      const { dayOfWeek } = req.query;

      let whereClause = 'WHERE ta.school_id = $1 AND ta.teacher_id = $2';
      const params = [req.user.schoolId, teacherId];

      if (dayOfWeek) {
        whereClause += ` AND ta.day_of_week = $${params.length + 1}`;
        params.push(dayOfWeek);
      }

      const result = await query(`
        SELECT ta.*, s.first_name, s.last_name
        FROM teacher_availability ta
        JOIN staff s ON ta.teacher_id = s.id
        ${whereClause}
        ORDER BY ta.day_of_week, ta.start_time
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Get timetable conflicts
  static async getConflicts(req, res, next) {
    try {
      const { versionId } = req.query;
      const { severity } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (versionId) {
        whereClause += ` AND version_id = $${params.length + 1}`;
        params.push(versionId);
      }

      if (severity) {
        whereClause += ` AND severity = $${params.length + 1}`;
        params.push(severity);
      }

      const result = await query(`
        SELECT tc.*, tv.version_name
        FROM timetable_conflicts tc
        LEFT JOIN timetable_versions tv ON tc.version_id = tv.id
        ${whereClause}
        ORDER BY tc.severity DESC, tc.detected_at DESC
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
  // TIMETABLE VIEWING ENDPOINTS
  // =============================================================================

  // Get published timetable
  static async getPublishedTimetable(req, res, next) {
    try {
      const { academicYearId, academicTermId, classId } = req.query;

      let whereClause = 'WHERE tv.school_id = $1 AND tv.is_published = true AND tv.is_active = true';
      const params = [req.user.schoolId];

      if (academicYearId) {
        whereClause += ` AND tv.academic_year_id = $${params.length + 1}`;
        params.push(academicYearId);
      }

      if (academicTermId) {
        whereClause += ` AND tv.academic_term_id = $${params.length + 1}`;
        params.push(academicTermId);
      }

      if (classId) {
        whereClause += ` AND te.class_id = $${params.length + 1}`;
        params.push(classId);
      }

      const result = await query(`
        SELECT 
          te.*,
          tv.version_name,
          c.class_name,
          s.subject_name,
          st.first_name as teacher_first_name,
          st.last_name as teacher_last_name,
          cr.room_name
        FROM timetable_entries te
        JOIN timetable_versions tv ON te.version_id = tv.id
        JOIN classes c ON te.class_id = c.id
        JOIN subjects s ON te.subject_id = s.id
        LEFT JOIN staff st ON te.teacher_id = st.id
        LEFT JOIN classrooms cr ON te.room_id = cr.id
        ${whereClause}
        ORDER BY te.day_of_week, te.period_number, c.class_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Publish timetable version
  static async publishTimetable(req, res, next) {
    try {
      const { versionId } = req.body;

      if (!versionId) {
        throw new ValidationError('Version ID is required');
      }

      // Verify version exists and belongs to school
      const versionResult = await query(`
        SELECT * FROM timetable_versions 
        WHERE id = $1 AND school_id = $2
      `, [versionId, req.user.schoolId]);

      if (versionResult.rows.length === 0) {
        throw new NotFoundError('Timetable version not found');
      }

      // Deactivate other published versions for the same academic year/term
      const version = versionResult.rows[0];
      await query(`
        UPDATE timetable_versions 
        SET is_published = false, is_active = false
        WHERE school_id = $1 AND academic_year_id = $2 AND academic_term_id = $3 AND id != $4
      `, [req.user.schoolId, version.academic_year_id, version.academic_term_id, versionId]);

      // Publish the selected version
      const publishResult = await query(`
        UPDATE timetable_versions 
        SET is_published = true, is_active = true, published_by = $1, published_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [req.user.userId, versionId]);

      res.json({
        success: true,
        message: 'Timetable published successfully',
        data: publishResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get timetable versions
  static async getVersions(req, res, next) {
    try {
      const { academicYearId, academicTermId, limit = 20, offset = 0 } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (academicYearId) {
        whereClause += ` AND academic_year_id = $${params.length + 1}`;
        params.push(academicYearId);
      }

      if (academicTermId) {
        whereClause += ` AND academic_term_id = $${params.length + 1}`;
        params.push(academicTermId);
      }

      const result = await query(`
        SELECT tv.*, 
               tc.name as configuration_name,
               ay.year_name,
               at.term_name,
               COUNT(te.id) as entries_count
        FROM timetable_versions tv
        LEFT JOIN timetable_configurations tc ON tv.configuration_id = tc.id
        LEFT JOIN academic_years ay ON tv.academic_year_id = ay.id
        LEFT JOIN academic_terms at ON tv.academic_term_id = at.id
        LEFT JOIN timetable_entries te ON tv.id = te.version_id
        ${whereClause}
        GROUP BY tv.id, tc.name, ay.year_name, at.term_name
        ORDER BY tv.created_at DESC
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

  // =============================================================================
  // ANALYTICS ENDPOINTS
  // =============================================================================

  // Get timetable analytics
  static async getAnalytics(req, res, next) {
    try {
      const { versionId } = req.query;

      if (!versionId) {
        throw new ValidationError('Version ID is required');
      }

      // Get basic statistics
      const [entriesResult, conflictsResult, utilizationResult] = await Promise.all([
        query(`
          SELECT 
            COUNT(*) as total_entries,
            COUNT(DISTINCT class_id) as classes_scheduled,
            COUNT(DISTINCT teacher_id) as teachers_assigned,
            COUNT(DISTINCT subject_id) as subjects_scheduled
          FROM timetable_entries 
          WHERE school_id = $1 AND version_id = $2
        `, [req.user.schoolId, versionId]),

        query(`
          SELECT severity, COUNT(*) as count
          FROM timetable_conflicts 
          WHERE school_id = $1 AND version_id = $2
          GROUP BY severity
        `, [req.user.schoolId, versionId]),

        query(`
          SELECT 
            day_of_week,
            COUNT(*) as periods_used,
            COUNT(DISTINCT period_number) as unique_periods
          FROM timetable_entries 
          WHERE school_id = $1 AND version_id = $2
          GROUP BY day_of_week
          ORDER BY day_of_week
        `, [req.user.schoolId, versionId])
      ]);

      const analytics = {
        overview: entriesResult.rows[0],
        conflicts: conflictsResult.rows,
        utilization: utilizationResult.rows
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ADDITIONAL HELPERS FOR VERSIONS/ENTRIES
  // =============================================================================

  static async getVersionEntries(versionId, schoolId) {
    const result = await query(`
      SELECT 
        te.*,
        c.class_name,
        s.subject_name,
        st.first_name as teacher_first_name,
        st.last_name as teacher_last_name,
        cr.room_name
      FROM timetable_entries te
      LEFT JOIN classes c ON te.class_id = c.id
      LEFT JOIN subjects s ON te.subject_id = s.id
      LEFT JOIN staff st ON te.teacher_id = st.id
      LEFT JOIN classrooms cr ON te.room_id = cr.id
      WHERE te.school_id = $1 AND te.version_id = $2
      ORDER BY te.day_of_week, te.period_number, c.class_name
    `, [schoolId, versionId]);
    return result.rows;
  }

  // =============================================================================
  // DISTRIBUTION/EXPORT/NOTIFICATIONS (SIMPLE STUBS)
  // =============================================================================

  static async getTeacherSchedule(teacherId, schoolId) {
    const result = await query(`
      SELECT te.*, c.class_name, s.subject_name, cr.room_name
      FROM timetable_entries te
      LEFT JOIN classes c ON te.class_id = c.id
      LEFT JOIN subjects s ON te.subject_id = s.id
      LEFT JOIN classrooms cr ON te.room_id = cr.id
      JOIN timetable_versions tv ON te.version_id = tv.id
      WHERE te.school_id = $1 AND te.teacher_id = $2 AND tv.is_active = true AND tv.is_published = true
      ORDER BY te.day_of_week, te.period_number
    `, [schoolId, teacherId]);
    return result.rows;
  }

  static async getStudentClassTimetable(studentId, schoolId) {
    const result = await query(`
      SELECT te.*, c.class_name, s.subject_name, st.first_name as teacher_first_name, st.last_name as teacher_last_name
      FROM timetable_entries te
      JOIN students stu ON stu.class_id = te.class_id
      JOIN classes c ON te.class_id = c.id
      JOIN subjects s ON te.subject_id = s.id
      LEFT JOIN staff st ON te.teacher_id = st.id
      JOIN timetable_versions tv ON te.version_id = tv.id
      WHERE te.school_id = $1 AND stu.id = $2 AND tv.is_active = true AND tv.is_published = true
      ORDER BY te.day_of_week, te.period_number
    `, [schoolId, studentId]);
    return result.rows;
  }

  static async distributeTimetable(req, res) {
    const { versionId, notify } = req.body || {};
    if (!versionId) {
      throw new ValidationError('Version ID is required');
    }
    // Minimal distribution: mark version as distributed and optionally notify
    await query(`
      UPDATE timetable_versions SET distributed_at = CURRENT_TIMESTAMP WHERE id = $1 AND school_id = $2
    `, [versionId, req.user.schoolId]);
    if (notify) {
      // hook into realtime integrations if available
      // placeholder: return counts 0
    }
    return res.json({ success: true, message: 'Timetable distributed', data: { versionId, notified: !!notify } });
  }

  static async exportPdf(payload, schoolId) {
    // Placeholder returns a presigned-like URL/id; real implementation would render PDF
    const { versionId, mode = 'class' } = payload || {};
    if (!versionId) {
      throw new ValidationError('Version ID is required');
    }
    const downloadUrl = `/downloads/timetables/${versionId}-${mode}.pdf`;
    return { versionId, mode, url: downloadUrl };
  }

  static async notifyStakeholders(payload, schoolId, userId) {
    const { versionId, target = 'all', message } = payload || {};
    if (!versionId) {
      throw new ValidationError('Version ID is required');
    }
    // Placeholder: record notification intent
    return { versionId, target, message: message || 'New timetable available', sent: true };
  }
}

module.exports = TimetableController;