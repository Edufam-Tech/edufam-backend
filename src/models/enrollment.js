const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Enrollment {
  // Create new enrollment
  static async create(enrollmentData, createdBy) {
    try {
      const {
        studentId,
        schoolId,
        academicYearId,
        classId,
        enrollmentDate = new Date(),
        enrollmentStatus = 'active',
        enrollmentType = 'new',
        previousSchool,
        previousClass,
        documents,
        notes
      } = enrollmentData;

      // Validate required fields
      if (!studentId || !schoolId || !academicYearId || !classId) {
        throw new ValidationError('Student ID, school ID, academic year ID, and class ID are required');
      }

      // Check if student is already enrolled in this academic year
      const existingEnrollment = await query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND academic_year_id = $2 AND is_active = true',
        [studentId, academicYearId]
      );

      if (existingEnrollment.rows.length > 0) {
        throw new ConflictError('Student is already enrolled in this academic year');
      }

      // Insert enrollment
      const result = await query(`
        INSERT INTO enrollments (
          student_id, school_id, academic_year_id, class_id, enrollment_date,
          enrollment_status, enrollment_type, previous_school, previous_class,
          documents, notes, created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING *
      `, [
        studentId, schoolId, academicYearId, classId, enrollmentDate,
        enrollmentStatus, enrollmentType, previousSchool, previousClass,
        JSON.stringify(documents), notes, createdBy, createdBy
      ]);

      const newEnrollment = result.rows[0];

      // Update student's current class
      await query(
        'UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = $2',
        [classId, studentId]
      );

      // Log enrollment creation
      await this.logEnrollmentActivity(newEnrollment.id, 'ENROLLMENT_CREATED', {
        createdBy,
        studentId,
        academicYearId,
        classId
      });

      return newEnrollment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create enrollment');
    }
  }

  // Get enrollment by ID
  static async findById(enrollmentId) {
    try {
      const result = await query(`
        SELECT e.*, 
               s.first_name as student_first_name, s.last_name as student_last_name, s.admission_number,
               c.name as class_name, c.grade_level,
               ay.name as academic_year_name,
               sch.name as school_name
        FROM enrollments e
        LEFT JOIN students s ON e.student_id = s.id
        LEFT JOIN classes c ON e.class_id = c.id
        LEFT JOIN academic_years ay ON e.academic_year_id = ay.id
        LEFT JOIN schools sch ON e.school_id = sch.id
        WHERE e.id = $1 AND e.is_active = true
      `, [enrollmentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Enrollment not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find enrollment');
    }
  }

  // Get enrollment by student and academic year
  static async findByStudentAndYear(studentId, academicYearId) {
    try {
      const result = await query(`
        SELECT e.*, 
               c.name as class_name, c.grade_level,
               ay.name as academic_year_name
        FROM enrollments e
        LEFT JOIN classes c ON e.class_id = c.id
        LEFT JOIN academic_years ay ON e.academic_year_id = ay.id
        WHERE e.student_id = $1 AND e.academic_year_id = $2 AND e.is_active = true
      `, [studentId, academicYearId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Enrollment not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find enrollment');
    }
  }

  // Get all enrollments with pagination and filters
  static async findAll(filters = {}, pagination = {}) {
    try {
      const {
        schoolId,
        academicYearId,
        classId,
        enrollmentStatus,
        enrollmentType,
        isActive = true
      } = filters;

      const { page = 1, limit = 10 } = pagination;
      const offset = (page - 1) * limit;

      let whereConditions = ['e.is_active = $1'];
      let params = [isActive];
      let paramIndex = 2;

      if (schoolId) {
        whereConditions.push(`e.school_id = $${paramIndex++}`);
        params.push(schoolId);
      }

      if (academicYearId) {
        whereConditions.push(`e.academic_year_id = $${paramIndex++}`);
        params.push(academicYearId);
      }

      if (classId) {
        whereConditions.push(`e.class_id = $${paramIndex++}`);
        params.push(classId);
      }

      if (enrollmentStatus) {
        whereConditions.push(`e.enrollment_status = $${paramIndex++}`);
        params.push(enrollmentStatus);
      }

      if (enrollmentType) {
        whereConditions.push(`e.enrollment_type = $${paramIndex++}`);
        params.push(enrollmentType);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM enrollments e WHERE ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get enrollments with related data
      const result = await query(`
        SELECT e.*, 
               s.first_name as student_first_name, s.last_name as student_last_name, s.admission_number,
               c.name as class_name, c.grade_level,
               ay.name as academic_year_name,
               sch.name as school_name
        FROM enrollments e
        LEFT JOIN students s ON e.student_id = s.id
        LEFT JOIN classes c ON e.class_id = c.id
        LEFT JOIN academic_years ay ON e.academic_year_id = ay.id
        LEFT JOIN schools sch ON e.school_id = sch.id
        WHERE ${whereClause}
        ORDER BY e.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      return {
        enrollments: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to fetch enrollments');
    }
  }

  // Update enrollment
  static async update(enrollmentId, updateData, updatedBy) {
    try {
      const {
        classId,
        enrollmentStatus,
        enrollmentType,
        previousSchool,
        previousClass,
        documents,
        notes
      } = updateData;

      // Check if enrollment exists
      const existingEnrollment = await this.findById(enrollmentId);

      // Build update query dynamically
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (classId !== undefined) {
        updateFields.push(`class_id = $${paramIndex++}`);
        params.push(classId);
      }

      if (enrollmentStatus !== undefined) {
        updateFields.push(`enrollment_status = $${paramIndex++}`);
        params.push(enrollmentStatus);
      }

      if (enrollmentType !== undefined) {
        updateFields.push(`enrollment_type = $${paramIndex++}`);
        params.push(enrollmentType);
      }

      if (previousSchool !== undefined) {
        updateFields.push(`previous_school = $${paramIndex++}`);
        params.push(previousSchool);
      }

      if (previousClass !== undefined) {
        updateFields.push(`previous_class = $${paramIndex++}`);
        params.push(previousClass);
      }

      if (documents !== undefined) {
        updateFields.push(`documents = $${paramIndex++}`);
        params.push(JSON.stringify(documents));
      }

      if (notes !== undefined) {
        updateFields.push(`notes = $${paramIndex++}`);
        params.push(notes);
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push(`updated_by = $${paramIndex++}`);
      updateFields.push(`updated_at = NOW()`);
      params.push(updatedBy);
      params.push(enrollmentId);

      const result = await query(`
        UPDATE enrollments 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Enrollment not found');
      }

      const updatedEnrollment = result.rows[0];

      // Update student's current class if class was changed
      if (classId && classId !== existingEnrollment.class_id) {
        await query(
          'UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = $2',
          [classId, existingEnrollment.student_id]
        );
      }

      // Log enrollment update
      await this.logEnrollmentActivity(enrollmentId, 'ENROLLMENT_UPDATED', {
        updatedBy,
        updatedFields: Object.keys(updateData)
      });

      return updatedEnrollment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update enrollment');
    }
  }

  // Transfer student to different class
  static async transferClass(enrollmentId, newClassId, updatedBy, notes = '') {
    try {
      const enrollment = await this.findById(enrollmentId);
      
      if (enrollment.class_id === newClassId) {
        throw new ValidationError('Student is already in this class');
      }

      // Update enrollment with new class
      const result = await query(`
        UPDATE enrollments 
        SET class_id = $1, notes = CASE WHEN notes = '' THEN $2 ELSE notes || ' | ' || $2 END, 
            updated_by = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [newClassId, `Transferred to new class on ${new Date().toISOString()}. ${notes}`, updatedBy, enrollmentId]);

      // Update student's current class
      await query(
        'UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = $2',
        [newClassId, enrollment.student_id]
      );

      // Log class transfer
      await this.logEnrollmentActivity(enrollmentId, 'CLASS_TRANSFER', {
        updatedBy,
        oldClassId: enrollment.class_id,
        newClassId,
        notes
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to transfer student class');
    }
  }

  // Get enrollment statistics
  static async getStatistics(schoolId, academicYearId = null) {
    try {
      let whereClause = 'e.school_id = $1 AND e.is_active = true';
      let params = [schoolId];

      if (academicYearId) {
        whereClause += ' AND e.academic_year_id = $2';
        params.push(academicYearId);
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_enrollments,
          COUNT(CASE WHEN enrollment_status = 'active' THEN 1 END) as active_enrollments,
          COUNT(CASE WHEN enrollment_status = 'inactive' THEN 1 END) as inactive_enrollments,
          COUNT(CASE WHEN enrollment_status = 'suspended' THEN 1 END) as suspended_enrollments,
          COUNT(CASE WHEN enrollment_type = 'new' THEN 1 END) as new_enrollments,
          COUNT(CASE WHEN enrollment_type = 'transfer' THEN 1 END) as transfer_enrollments,
          COUNT(CASE WHEN enrollment_type = 're-enrollment' THEN 1 END) as re_enrollments,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as enrollments_month,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as enrollments_week
        FROM enrollments e
        WHERE ${whereClause}
      `, params);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get enrollment statistics');
    }
  }

  // Log enrollment activity
  static async logEnrollmentActivity(enrollmentId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy,
        action,
        'enrollments',
        enrollmentId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log enrollment activity:', error);
    }
  }

  // Validate enrollment data
  static validateEnrollmentData(enrollmentData) {
    const errors = [];

    if (!enrollmentData.studentId) {
      errors.push('Student ID is required');
    }

    if (!enrollmentData.schoolId) {
      errors.push('School ID is required');
    }

    if (!enrollmentData.academicYearId) {
      errors.push('Academic year ID is required');
    }

    if (!enrollmentData.classId) {
      errors.push('Class ID is required');
    }

    if (enrollmentData.enrollmentStatus && !['active', 'inactive', 'suspended', 'graduated', 'transferred'].includes(enrollmentData.enrollmentStatus)) {
      errors.push('Invalid enrollment status');
    }

    if (enrollmentData.enrollmentType && !['new', 'transfer', 're-enrollment'].includes(enrollmentData.enrollmentType)) {
      errors.push('Invalid enrollment type');
    }

    return errors;
  }
}

module.exports = Enrollment; 