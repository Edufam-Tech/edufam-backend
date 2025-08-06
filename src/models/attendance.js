const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Attendance {
  // Create attendance register
  static async createRegister(registerData, createdBy) {
    try {
      const {
        schoolId,
        classId,
        academicYearId,
        academicTermId,
        registerDate,
        sessionType,
        subjectId
      } = registerData;

      // Validate required fields
      if (!schoolId || !classId || !academicYearId || !registerDate || !sessionType) {
        throw new ValidationError('School ID, class ID, academic year ID, register date, and session type are required');
      }

      // Validate session type
      const validSessionTypes = ['morning', 'afternoon', 'full_day'];
      if (!validSessionTypes.includes(sessionType)) {
        throw new ValidationError('Invalid session type');
      }

      // Check if register already exists for this class, date, and session
      const existingRegister = await query(
        'SELECT id FROM attendance_registers WHERE class_id = $1 AND register_date = $2 AND session_type = $3 AND (subject_id = $4 OR (subject_id IS NULL AND $4 IS NULL))',
        [classId, registerDate, sessionType, subjectId]
      );

      if (existingRegister.rows.length > 0) {
        throw new ConflictError('Attendance register already exists for this class, date, and session');
      }

      // Insert register
      const result = await query(`
        INSERT INTO attendance_registers (
          school_id, class_id, academic_year_id, academic_term_id,
          register_date, session_type, subject_id, created_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, classId, academicYearId, academicTermId,
        registerDate, sessionType, subjectId, createdBy
      ]);

      const newRegister = result.rows[0];

      // Log register creation
      await this.logActivity(newRegister.id, 'ATTENDANCE_REGISTER_CREATED', {
        createdBy,
        schoolId,
        registerData: { registerDate, sessionType, classId }
      });

      return newRegister;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create attendance register');
    }
  }

  // Get attendance register by ID
  static async getRegisterById(registerId) {
    try {
      const result = await query(`
        SELECT 
          ar.*,
          s.name as school_name,
          c.name as class_name,
          ay.name as academic_year_name,
          at.name as academic_term_name,
          sub.name as subject_name,
          u.first_name || ' ' || u.last_name as created_by_name
        FROM attendance_registers ar
        JOIN schools s ON ar.school_id = s.id
        JOIN classes c ON ar.class_id = c.id
        JOIN academic_years ay ON ar.academic_year_id = ay.id
        LEFT JOIN academic_terms at ON ar.academic_term_id = at.id
        LEFT JOIN subjects sub ON ar.subject_id = sub.id
        JOIN users u ON ar.created_by = u.id
        WHERE ar.id = $1
      `, [registerId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Attendance register not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find attendance register');
    }
  }

  // Get attendance registers for a class
  static async getRegistersByClass(classId, filters = {}) {
    try {
      let sql = `
        SELECT 
          ar.*,
          ay.name as academic_year_name,
          at.name as academic_term_name,
          sub.name as subject_name,
          u.first_name || ' ' || u.last_name as created_by_name
        FROM attendance_registers ar
        JOIN academic_years ay ON ar.academic_year_id = ay.id
        LEFT JOIN academic_terms at ON ar.academic_term_id = at.id
        LEFT JOIN subjects sub ON ar.subject_id = sub.id
        JOIN users u ON ar.created_by = u.id
        WHERE ar.class_id = $1
      `;
      
      const params = [classId];
      let paramCount = 1;

      // Apply filters
      if (filters.startDate) {
        paramCount++;
        sql += ` AND ar.register_date >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND ar.register_date <= $${paramCount}`;
        params.push(filters.endDate);
      }

      if (filters.sessionType) {
        paramCount++;
        sql += ` AND ar.session_type = $${paramCount}`;
        params.push(filters.sessionType);
      }

      if (filters.subjectId) {
        paramCount++;
        sql += ` AND ar.subject_id = $${paramCount}`;
        params.push(filters.subjectId);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND ar.status = $${paramCount}`;
        params.push(filters.status);
      }

      // Add ordering
      sql += ` ORDER BY ar.register_date DESC, ar.session_type`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to find attendance registers');
    }
  }

  // Mark attendance for a student
  static async markAttendance(attendanceData, markedBy) {
    try {
      const {
        registerId,
        studentId,
        status,
        timeIn,
        timeOut,
        reasonId,
        customReason,
        remarks
      } = attendanceData;

      // Validate required fields
      if (!registerId || !studentId || !status) {
        throw new ValidationError('Register ID, student ID, and status are required');
      }

      // Validate status
      const validStatuses = ['present', 'absent', 'late', 'excused', 'sick_leave', 'other'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid attendance status');
      }

      // Check if attendance already exists for this student and register
      const existingAttendance = await query(
        'SELECT id FROM attendance_records WHERE student_id = $1 AND register_id = $2',
        [studentId, registerId]
      );

      if (existingAttendance.rows.length > 0) {
        throw new ConflictError('Attendance already marked for this student');
      }

      // Insert attendance record
      const result = await query(`
        INSERT INTO attendance_records (
          register_id, student_id, status, time_in, time_out,
          reason_id, custom_reason, remarks, marked_by,
          marked_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `, [
        registerId, studentId, status, timeIn, timeOut,
        reasonId, customReason, remarks, markedBy
      ]);

      const newAttendance = result.rows[0];

      // Log attendance marking
      await this.logActivity(newAttendance.id, 'ATTENDANCE_MARKED', {
        markedBy,
        attendanceData: { status, timeIn, timeOut }
      });

      return newAttendance;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to mark attendance');
    }
  }

  // Bulk mark attendance
  static async bulkMarkAttendance(attendanceData, markedBy) {
    try {
      const results = [];
      const errors = [];

      for (let i = 0; i < attendanceData.length; i++) {
        try {
          const attendance = await this.markAttendance(attendanceData[i], markedBy);
          results.push(attendance);
        } catch (error) {
          errors.push({
            index: i,
            data: attendanceData[i],
            error: error.message
          });
        }
      }

      return {
        success: results,
        errors: errors,
        totalProcessed: attendanceData.length,
        successCount: results.length,
        errorCount: errors.length
      };
    } catch (error) {
      throw new DatabaseError('Failed to bulk mark attendance');
    }
  }

  // Get attendance records for a register
  static async getAttendanceByRegister(registerId) {
    try {
      const result = await query(`
        SELECT 
          ar.*,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number,
          u.first_name || ' ' || u.last_name as marked_by_name,
          atr.name as reason_name
        FROM attendance_records ar
        JOIN students st ON ar.student_id = st.id
        JOIN users u ON ar.marked_by = u.id
        LEFT JOIN attendance_reasons atr ON ar.reason_id = atr.id
        WHERE ar.register_id = $1
        ORDER BY st.first_name, st.last_name
      `, [registerId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get attendance records');
    }
  }

  // Get attendance records for a student
  static async getAttendanceByStudent(studentId, filters = {}) {
    try {
      let sql = `
        SELECT 
          ar.*,
          arr.register_date,
          arr.session_type,
          arr.subject_id,
          sub.name as subject_name,
          u.first_name || ' ' || u.last_name as marked_by_name,
          atr.name as reason_name
        FROM attendance_records ar
        JOIN attendance_registers arr ON ar.register_id = arr.id
        LEFT JOIN subjects sub ON arr.subject_id = sub.id
        JOIN users u ON ar.marked_by = u.id
        LEFT JOIN attendance_reasons atr ON ar.reason_id = atr.id
        WHERE ar.student_id = $1
      `;
      
      const params = [studentId];
      let paramCount = 1;

      // Apply filters
      if (filters.startDate) {
        paramCount++;
        sql += ` AND arr.register_date >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND arr.register_date <= $${paramCount}`;
        params.push(filters.endDate);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND ar.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.sessionType) {
        paramCount++;
        sql += ` AND arr.session_type = $${paramCount}`;
        params.push(filters.sessionType);
      }

      // Add ordering
      sql += ` ORDER BY arr.register_date DESC, arr.session_type`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get student attendance');
    }
  }

  // Update attendance record
  static async updateAttendance(attendanceId, updateData, updatedBy) {
    try {
      const attendance = await query(
        'SELECT * FROM attendance_records WHERE id = $1',
        [attendanceId]
      );

      if (attendance.rows.length === 0) {
        throw new NotFoundError('Attendance record not found');
      }

      const {
        status,
        timeIn,
        timeOut,
        reasonId,
        customReason,
        remarks
      } = updateData;

      // Validate status if provided
      if (status && !['present', 'absent', 'late', 'excused', 'sick_leave', 'other'].includes(status)) {
        throw new ValidationError('Invalid attendance status');
      }

      // Build update query
      const updateFields = [];
      const params = [];
      let paramCount = 0;

      if (status !== undefined) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        params.push(status);
      }

      if (timeIn !== undefined) {
        paramCount++;
        updateFields.push(`time_in = $${paramCount}`);
        params.push(timeIn);
      }

      if (timeOut !== undefined) {
        paramCount++;
        updateFields.push(`time_out = $${paramCount}`);
        params.push(timeOut);
      }

      if (reasonId !== undefined) {
        paramCount++;
        updateFields.push(`reason_id = $${paramCount}`);
        params.push(reasonId);
      }

      if (customReason !== undefined) {
        paramCount++;
        updateFields.push(`custom_reason = $${paramCount}`);
        params.push(customReason);
      }

      if (remarks !== undefined) {
        paramCount++;
        updateFields.push(`remarks = $${paramCount}`);
        params.push(remarks);
      }

      if (updateFields.length === 0) {
        return attendance.rows[0]; // No updates
      }

      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      params.push(new Date());

      paramCount++;
      params.push(attendanceId);

      const result = await query(`
        UPDATE attendance_records 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Attendance record not found');
      }

      const updatedAttendance = result.rows[0];

      // Log attendance update
      await this.logActivity(attendanceId, 'ATTENDANCE_UPDATED', {
        updatedBy,
        updateData
      });

      return updatedAttendance;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update attendance');
    }
  }

  // Get attendance summary for a class
  static async getClassSummary(classId, filters = {}) {
    try {
      let sql = `
        SELECT 
          arr.register_date,
          arr.session_type,
          COUNT(ar.id) as total_students,
          COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'excused') as excused_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'sick_leave') as sick_leave_count,
          ROUND(
            (COUNT(ar.id) FILTER (WHERE ar.status = 'present')::DECIMAL / COUNT(ar.id)) * 100, 2
          ) as attendance_percentage
        FROM attendance_registers arr
        LEFT JOIN attendance_records ar ON arr.id = ar.register_id
        WHERE arr.class_id = $1
      `;
      
      const params = [classId];
      let paramCount = 1;

      // Apply filters
      if (filters.startDate) {
        paramCount++;
        sql += ` AND arr.register_date >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND arr.register_date <= $${paramCount}`;
        params.push(filters.endDate);
      }

      if (filters.sessionType) {
        paramCount++;
        sql += ` AND arr.session_type = $${paramCount}`;
        params.push(filters.sessionType);
      }

      sql += ` GROUP BY arr.register_date, arr.session_type ORDER BY arr.register_date DESC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get class attendance summary');
    }
  }

  // Get attendance statistics for a student
  static async getStudentStatistics(studentId, filters = {}) {
    try {
      let sql = `
        SELECT 
          COUNT(ar.id) as total_days,
          COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present_days,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_days,
          COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late_days,
          COUNT(ar.id) FILTER (WHERE ar.status = 'excused') as excused_days,
          COUNT(ar.id) FILTER (WHERE ar.status = 'sick_leave') as sick_leave_days,
          ROUND(
            (COUNT(ar.id) FILTER (WHERE ar.status = 'present')::DECIMAL / COUNT(ar.id)) * 100, 2
          ) as attendance_percentage
        FROM attendance_records ar
        JOIN attendance_registers arr ON ar.register_id = arr.id
        WHERE ar.student_id = $1
      `;
      
      const params = [studentId];

      if (filters.startDate) {
        sql += ' AND arr.register_date >= $2';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND arr.register_date <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get student attendance statistics');
    }
  }

  // Get attendance reasons for a school
  static async getAttendanceReasons(schoolId) {
    try {
      const result = await query(`
        SELECT * FROM attendance_reasons 
        WHERE school_id = $1 AND is_active = true 
        ORDER BY name
      `, [schoolId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get attendance reasons');
    }
  }

  // Create attendance reason
  static async createAttendanceReason(reasonData, createdBy) {
    try {
      const {
        schoolId,
        name,
        description,
        isExcused,
        requiresDocumentation,
        color
      } = reasonData;

      // Validate required fields
      if (!schoolId || !name) {
        throw new ValidationError('School ID and name are required');
      }

      // Check if reason already exists
      const existingReason = await query(
        'SELECT id FROM attendance_reasons WHERE school_id = $1 AND name = $2',
        [schoolId, name]
      );

      if (existingReason.rows.length > 0) {
        throw new ConflictError('Attendance reason with this name already exists');
      }

      // Insert reason
      const result = await query(`
        INSERT INTO attendance_reasons (
          school_id, name, description, is_excused, requires_documentation, color,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, name, description, isExcused || false,
        requiresDocumentation || false, color || '#EF4444'
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create attendance reason');
    }
  }

  // Get attendance settings for a school
  static async getAttendanceSettings(schoolId) {
    try {
      const result = await query(`
        SELECT * FROM attendance_settings WHERE school_id = $1
      `, [schoolId]);

      if (result.rows.length === 0) {
        // Create default settings if none exist
        const defaultSettings = await query(`
          INSERT INTO attendance_settings (school_id) VALUES ($1) RETURNING *
        `, [schoolId]);
        return defaultSettings.rows[0];
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get attendance settings');
    }
  }

  // Update attendance settings
  static async updateAttendanceSettings(schoolId, updateData) {
    try {
      const updateFields = [];
      const params = [];
      let paramCount = 0;

      // Build update query dynamically
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          paramCount++;
          updateFields.push(`${key} = $${paramCount}`);
          params.push(updateData[key]);
        }
      });

      if (updateFields.length === 0) {
        return await this.getAttendanceSettings(schoolId);
      }

      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      params.push(new Date());

      paramCount++;
      params.push(schoolId);

      const result = await query(`
        UPDATE attendance_settings 
        SET ${updateFields.join(', ')}
        WHERE school_id = $${paramCount}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Attendance settings not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update attendance settings');
    }
  }

  // Log attendance activity
  static async logActivity(recordId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.markedBy,
        action,
        'attendance_records',
        recordId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log attendance activity:', error);
    }
  }

  // Validate attendance data
  static validateAttendanceData(attendanceData) {
    const errors = [];

    if (!attendanceData.registerId) {
      errors.push('Register ID is required');
    }

    if (!attendanceData.studentId) {
      errors.push('Student ID is required');
    }

    if (!attendanceData.status) {
      errors.push('Status is required');
    }

    if (attendanceData.status && !['present', 'absent', 'late', 'excused', 'sick_leave', 'other'].includes(attendanceData.status)) {
      errors.push('Invalid attendance status');
    }

    return errors;
  }
}

module.exports = Attendance; 