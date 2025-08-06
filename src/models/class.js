const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Class {
  // Create new class
  static async create(classData, createdBy) {
    try {
      const {
        schoolId,
        name,
        gradeLevel,
        curriculumType = '8-4-4',
        academicYearId,
        capacity = 40,
        description,
        teacherId,
        roomNumber,
        schedule
      } = classData;

      // Validate required fields
      if (!schoolId || !name || !gradeLevel || !academicYearId) {
        throw new ValidationError('School ID, name, grade level, and academic year ID are required');
      }

      // Check if class name already exists for this school and academic year
      const existingClass = await query(
        'SELECT id FROM classes WHERE school_id = $1 AND name = $2 AND academic_year_id = $3',
        [schoolId, name, academicYearId]
      );

      if (existingClass.rows.length > 0) {
        throw new ConflictError('Class name already exists for this school and academic year');
      }

      // Insert class
      const result = await query(`
        INSERT INTO classes (
          school_id, name, grade_level, curriculum_type, academic_year_id,
          capacity, description, teacher_id, room_number, schedule,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, name, gradeLevel, curriculumType, academicYearId,
        capacity, description, teacherId, roomNumber, JSON.stringify(schedule)
      ]);

      const newClass = result.rows[0];

      // Log class creation
      await this.logClassActivity(newClass.id, 'CLASS_CREATED', {
        createdBy,
        schoolId,
        classData: { name, gradeLevel, curriculumType }
      });

      return newClass;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create class');
    }
  }

  // Get class by ID
  static async findById(classId) {
    try {
      const result = await query(`
        SELECT c.*, 
               s.name as school_name,
               ay.name as academic_year_name,
               u.first_name as teacher_first_name, u.last_name as teacher_last_name
        FROM classes c
        LEFT JOIN schools s ON c.school_id = s.id
        LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
        LEFT JOIN users u ON c.teacher_id = u.id
        WHERE c.id = $1 AND c.is_active = true
      `, [classId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Class not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find class');
    }
  }

  // Get all classes with pagination and filters
  static async findAll(filters = {}, pagination = {}) {
    try {
      const {
        schoolId,
        academicYearId,
        curriculumType,
        gradeLevel,
        teacherId,
        isActive = true
      } = filters;

      const { page = 1, limit = 10 } = pagination;
      const offset = (page - 1) * limit;

      let whereConditions = ['c.is_active = $1'];
      let params = [isActive];
      let paramIndex = 2;

      if (schoolId) {
        whereConditions.push(`c.school_id = $${paramIndex++}`);
        params.push(schoolId);
      }

      if (academicYearId) {
        whereConditions.push(`c.academic_year_id = $${paramIndex++}`);
        params.push(academicYearId);
      }

      if (curriculumType) {
        whereConditions.push(`c.curriculum_type = $${paramIndex++}`);
        params.push(curriculumType);
      }

      if (gradeLevel) {
        whereConditions.push(`c.grade_level = $${paramIndex++}`);
        params.push(gradeLevel);
      }

      if (teacherId) {
        whereConditions.push(`c.teacher_id = $${paramIndex++}`);
        params.push(teacherId);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM classes c WHERE ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get classes with related data
      const result = await query(`
        SELECT c.*, 
               s.name as school_name,
               ay.name as academic_year_name,
               u.first_name as teacher_first_name, u.last_name as teacher_last_name,
               (SELECT COUNT(*) FROM students WHERE class_id = c.id AND is_active = true) as student_count
        FROM classes c
        LEFT JOIN schools s ON c.school_id = s.id
        LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
        LEFT JOIN users u ON c.teacher_id = u.id
        WHERE ${whereClause}
        ORDER BY c.grade_level, c.name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      return {
        classes: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to fetch classes');
    }
  }

  // Update class
  static async update(classId, updateData, updatedBy) {
    try {
      const {
        name,
        gradeLevel,
        curriculumType,
        capacity,
        description,
        teacherId,
        roomNumber,
        schedule
      } = updateData;

      // Check if class exists
      const existingClass = await this.findById(classId);

      // Check if name is being changed and if it already exists
      if (name && name !== existingClass.name) {
        const nameExists = await query(
          'SELECT id FROM classes WHERE school_id = $1 AND name = $2 AND academic_year_id = $3 AND id != $4',
          [existingClass.school_id, name, existingClass.academic_year_id, classId]
        );

        if (nameExists.rows.length > 0) {
          throw new ConflictError('Class name already exists for this school and academic year');
        }
      }

      // Build update query dynamically
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        params.push(name);
      }

      if (gradeLevel !== undefined) {
        updateFields.push(`grade_level = $${paramIndex++}`);
        params.push(gradeLevel);
      }

      if (curriculumType !== undefined) {
        updateFields.push(`curriculum_type = $${paramIndex++}`);
        params.push(curriculumType);
      }

      if (capacity !== undefined) {
        updateFields.push(`capacity = $${paramIndex++}`);
        params.push(capacity);
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        params.push(description);
      }

      if (teacherId !== undefined) {
        updateFields.push(`teacher_id = $${paramIndex++}`);
        params.push(teacherId);
      }

      if (roomNumber !== undefined) {
        updateFields.push(`room_number = $${paramIndex++}`);
        params.push(roomNumber);
      }

      if (schedule !== undefined) {
        updateFields.push(`schedule = $${paramIndex++}`);
        params.push(JSON.stringify(schedule));
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(classId);

      const result = await query(`
        UPDATE classes 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Class not found');
      }

      const updatedClass = result.rows[0];

      // Log class update
      await this.logClassActivity(classId, 'CLASS_UPDATED', {
        updatedBy,
        updatedFields: Object.keys(updateData)
      });

      return updatedClass;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to update class');
    }
  }

  // Get class statistics
  static async getStatistics(classId) {
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM students WHERE class_id = $1 AND is_active = true) as total_students,
          (SELECT COUNT(*) FROM students WHERE class_id = $1 AND gender = 'male' AND is_active = true) as male_students,
          (SELECT COUNT(*) FROM students WHERE class_id = $1 AND gender = 'female' AND is_active = true) as female_students,
          (SELECT COUNT(*) FROM students WHERE class_id = $1 AND enrollment_status = 'active' AND is_active = true) as active_students,
          (SELECT capacity FROM classes WHERE id = $1) as capacity
      `, [classId]);

      const stats = result.rows[0];
      stats.available_slots = stats.capacity - stats.total_students;
      stats.occupancy_rate = stats.capacity > 0 ? Math.round((stats.total_students / stats.capacity) * 100) : 0;

      return stats;
    } catch (error) {
      throw new DatabaseError('Failed to get class statistics');
    }
  }

  // Log class activity
  static async logClassActivity(classId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy,
        action,
        'classes',
        classId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log class activity:', error);
    }
  }

  // Validate class data
  static validateClassData(classData) {
    const errors = [];

    if (!classData.name || classData.name.trim().length < 2) {
      errors.push('Class name must be at least 2 characters long');
    }

    if (!classData.gradeLevel || classData.gradeLevel < 1 || classData.gradeLevel > 12) {
      errors.push('Grade level must be between 1 and 12');
    }

    if (classData.capacity && (classData.capacity < 1 || classData.capacity > 100)) {
      errors.push('Class capacity must be between 1 and 100');
    }

    if (classData.curriculumType && !['CBC', 'IGCSE', '8-4-4'].includes(classData.curriculumType)) {
      errors.push('Curriculum type must be CBC, IGCSE, or 8-4-4');
    }

    return errors;
  }
}

module.exports = Class; 