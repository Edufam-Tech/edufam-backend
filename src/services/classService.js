const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class ClassService {
  // Get all classes with pagination and filtering
  static async getAllClasses(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramCount = 0;

      if (filters.schoolId) {
        whereClause += ` AND school_id = $${++paramCount}`;
        queryParams.push(filters.schoolId);
      }

      if (filters.academicYearId) {
        whereClause += ` AND academic_year_id = $${++paramCount}`;
        queryParams.push(filters.academicYearId);
      }

      if (filters.gradeLevel) {
        whereClause += ` AND grade_level = $${++paramCount}`;
        queryParams.push(filters.gradeLevel);
      }

      if (filters.status) {
        whereClause += ` AND status = $${++paramCount}`;
        queryParams.push(filters.status);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM classes ${whereClause}`;
      const countResult = await query(countQuery, queryParams);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const selectQuery = `
        SELECT c.*, ay.name as academic_year_name, s.name as school_name
        FROM classes c
        LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
        LEFT JOIN schools s ON c.school_id = s.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      queryParams.push(limit, offset);
      const result = await query(selectQuery, queryParams);

      return {
        classes: result.rows,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        currentPage: page
      };
    } catch (error) {
      throw new Error(`Failed to get classes: ${error.message}`);
    }
  }

  // Get class by ID
  static async getClassById(id) {
    try {
      const selectQuery = `
        SELECT c.*, ay.name as academic_year_name, s.name as school_name
        FROM classes c
        LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
        LEFT JOIN schools s ON c.school_id = s.id
        WHERE c.id = $1
      `;
      
      const result = await query(selectQuery, [id]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError(`Class with ID ${id} not found`);
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Create new class
  static async createClass(classData) {
    try {
      const {
        name,
        grade_level,
        section,
        academic_year_id,
        school_id,
        capacity,
        curriculum_type,
        room_number,
        created_by
      } = classData;

      // Check if class already exists
      const existsQuery = `
        SELECT id FROM classes 
        WHERE name = $1 AND grade_level = $2 AND academic_year_id = $3 AND school_id = $4
      `;
      const existsResult = await query(existsQuery, [name, grade_level, academic_year_id, school_id]);
      
      if (existsResult.rows.length > 0) {
        throw new ConflictError('Class with this name and grade level already exists for this academic year');
      }

      const insertQuery = `
        INSERT INTO classes (
          name, grade_level, section, academic_year_id, school_id, 
          capacity, curriculum_type, room_number, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [
        name, grade_level, section, academic_year_id, school_id,
        capacity, curriculum_type, room_number, created_by
      ]);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Update class
  static async updateClass(id, updateData) {
    try {
      const {
        name,
        grade_level,
        section,
        capacity,
        curriculum_type,
        room_number,
        status,
        updated_by
      } = updateData;

      const updateQuery = `
        UPDATE classes 
        SET 
          name = COALESCE($1, name),
          grade_level = COALESCE($2, grade_level),
          section = COALESCE($3, section),
          capacity = COALESCE($4, capacity),
          curriculum_type = COALESCE($5, curriculum_type),
          room_number = COALESCE($6, room_number),
          status = COALESCE($7, status),
          updated_by = $8,
          updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `;

      const result = await query(updateQuery, [
        name, grade_level, section, capacity, curriculum_type,
        room_number, status, updated_by, id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Class with ID ${id} not found`);
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Delete class
  static async deleteClass(id, userId) {
    try {
      const deleteQuery = `
        UPDATE classes 
        SET status = 'deleted', updated_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await query(deleteQuery, [userId, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Class with ID ${id} not found`);
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get classes by school
  static async getClassesBySchool(schoolId, page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE school_id = $1';
      let queryParams = [schoolId];
      let paramCount = 1;

      if (filters.academicYearId) {
        whereClause += ` AND academic_year_id = $${++paramCount}`;
        queryParams.push(filters.academicYearId);
      }

      if (filters.gradeLevel) {
        whereClause += ` AND grade_level = $${++paramCount}`;
        queryParams.push(filters.gradeLevel);
      }

      if (filters.status) {
        whereClause += ` AND status = $${++paramCount}`;
        queryParams.push(filters.status);
      }

      const selectQuery = `
        SELECT c.*, ay.name as academic_year_name
        FROM classes c
        LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
        ${whereClause}
        ORDER BY c.grade_level, c.name
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      queryParams.push(limit, offset);
      const result = await query(selectQuery, queryParams);

      return {
        classes: result.rows,
        totalItems: result.rowCount
      };
    } catch (error) {
      throw new Error(`Failed to get classes by school: ${error.message}`);
    }
  }

  // Get classes by academic year
  static async getClassesByAcademicYear(academicYearId, page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE academic_year_id = $1';
      let queryParams = [academicYearId];
      let paramCount = 1;

      if (filters.schoolId) {
        whereClause += ` AND school_id = $${++paramCount}`;
        queryParams.push(filters.schoolId);
      }

      if (filters.gradeLevel) {
        whereClause += ` AND grade_level = $${++paramCount}`;
        queryParams.push(filters.gradeLevel);
      }

      const selectQuery = `
        SELECT c.*, s.name as school_name
        FROM classes c
        LEFT JOIN schools s ON c.school_id = s.id
        ${whereClause}
        ORDER BY c.grade_level, c.name
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      queryParams.push(limit, offset);
      const result = await query(selectQuery, queryParams);

      return {
        classes: result.rows,
        totalItems: result.rowCount
      };
    } catch (error) {
      throw new Error(`Failed to get classes by academic year: ${error.message}`);
    }
  }

  // Get class students
  static async getClassStudents(classId, page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE e.class_id = $1';
      let queryParams = [classId];
      let paramCount = 1;

      if (filters.status) {
        whereClause += ` AND e.status = $${++paramCount}`;
        queryParams.push(filters.status);
      }

      const selectQuery = `
        SELECT s.*, e.enrollment_date, e.status as enrollment_status
        FROM students s
        JOIN enrollments e ON s.id = e.student_id
        ${whereClause}
        ORDER BY s.last_name, s.first_name
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      queryParams.push(limit, offset);
      const result = await query(selectQuery, queryParams);

      return {
        students: result.rows,
        totalItems: result.rowCount
      };
    } catch (error) {
      throw new Error(`Failed to get class students: ${error.message}`);
    }
  }

  // Assign teacher to class
  static async assignTeacherToClass(classId, teacherId, userId) {
    try {
      // Check if assignment already exists
      const existsQuery = `
        SELECT id FROM class_teachers 
        WHERE class_id = $1 AND teacher_id = $2 AND status = 'active'
      `;
      const existsResult = await query(existsQuery, [classId, teacherId]);

      if (existsResult.rows.length > 0) {
        throw new ConflictError('Teacher is already assigned to this class');
      }

      const insertQuery = `
        INSERT INTO class_teachers (class_id, teacher_id, assigned_by, assigned_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [classId, teacherId, userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Remove teacher from class
  static async removeTeacherFromClass(classId, userId) {
    try {
      const updateQuery = `
        UPDATE class_teachers 
        SET status = 'inactive', removed_by = $1, removed_at = NOW()
        WHERE class_id = $2 AND status = 'active'
        RETURNING *
      `;

      const result = await query(updateQuery, [userId, classId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('No active teacher assignment found for this class');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Add student to class
  static async addStudentToClass(classId, studentId, userId) {
    try {
      // Check if enrollment already exists
      const existsQuery = `
        SELECT id FROM enrollments 
        WHERE class_id = $1 AND student_id = $2 AND status = 'active'
      `;
      const existsResult = await query(existsQuery, [classId, studentId]);

      if (existsResult.rows.length > 0) {
        throw new ConflictError('Student is already enrolled in this class');
      }

      const insertQuery = `
        INSERT INTO enrollments (class_id, student_id, enrollment_date, enrolled_by)
        VALUES ($1, $2, NOW(), $3)
        RETURNING *
      `;

      const result = await query(insertQuery, [classId, studentId, userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Remove student from class
  static async removeStudentFromClass(classId, studentId, userId) {
    try {
      const updateQuery = `
        UPDATE enrollments 
        SET status = 'inactive', updated_by = $1, updated_at = NOW()
        WHERE class_id = $2 AND student_id = $3 AND status = 'active'
        RETURNING *
      `;

      const result = await query(updateQuery, [userId, classId, studentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Student enrollment not found in this class');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Activate class
  static async activateClass(classId, userId) {
    try {
      const updateQuery = `
        UPDATE classes 
        SET status = 'active', updated_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await query(updateQuery, [userId, classId]);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Class with ID ${classId} not found`);
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Deactivate class
  static async deactivateClass(classId, userId) {
    try {
      const updateQuery = `
        UPDATE classes 
        SET status = 'inactive', updated_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await query(updateQuery, [userId, classId]);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Class with ID ${classId} not found`);
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get class statistics
  static async getClassStatistics(classId) {
    try {
      const statsQuery = `
        SELECT 
          c.name as class_name,
          c.capacity,
          COUNT(e.student_id) as total_students,
          COUNT(CASE WHEN e.status = 'active' THEN 1 END) as active_students,
          COUNT(CASE WHEN s.gender = 'male' THEN 1 END) as male_students,
          COUNT(CASE WHEN s.gender = 'female' THEN 1 END) as female_students,
          COUNT(ct.teacher_id) as assigned_teachers
        FROM classes c
        LEFT JOIN enrollments e ON c.id = e.class_id
        LEFT JOIN students s ON e.student_id = s.id
        LEFT JOIN class_teachers ct ON c.id = ct.class_id AND ct.status = 'active'
        WHERE c.id = $1
        GROUP BY c.id, c.name, c.capacity
      `;

      const result = await query(statsQuery, [classId]);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Class with ID ${classId} not found`);
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Search classes
  static async searchClasses(searchTerm, page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE (c.name ILIKE $1 OR CAST(c.grade_level AS TEXT) ILIKE $1)';
      let queryParams = [`%${searchTerm}%`];
      let paramCount = 1;

      if (filters.schoolId) {
        whereClause += ` AND c.school_id = $${++paramCount}`;
        queryParams.push(filters.schoolId);
      }

      if (filters.academicYearId) {
        whereClause += ` AND c.academic_year_id = $${++paramCount}`;
        queryParams.push(filters.academicYearId);
      }

      const selectQuery = `
        SELECT c.*, ay.name as academic_year_name, s.name as school_name
        FROM classes c
        LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
        LEFT JOIN schools s ON c.school_id = s.id
        ${whereClause}
        ORDER BY c.grade_level, c.name
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      queryParams.push(limit, offset);
      const result = await query(selectQuery, queryParams);

      return {
        classes: result.rows,
        totalItems: result.rowCount
      };
    } catch (error) {
      throw new Error(`Failed to search classes: ${error.message}`);
    }
  }

  // Get classes overview
  static async getClassesOverview(filters = {}) {
    try {
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramCount = 0;

      if (filters.schoolId) {
        whereClause += ` AND school_id = $${++paramCount}`;
        queryParams.push(filters.schoolId);
      }

      if (filters.academicYearId) {
        whereClause += ` AND academic_year_id = $${++paramCount}`;
        queryParams.push(filters.academicYearId);
      }

      const overviewQuery = `
        SELECT 
          COUNT(*) as total_classes,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_classes,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_classes,
          SUM(capacity) as total_capacity,
          AVG(capacity) as average_capacity
        FROM classes
        ${whereClause}
      `;

      const result = await query(overviewQuery, queryParams);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get classes overview: ${error.message}`);
    }
  }

  // Get classes by teacher
  static async getClassesByTeacher(teacherId, page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE ct.teacher_id = $1 AND ct.status = \'active\'';
      let queryParams = [teacherId];
      let paramCount = 1;

      if (filters.schoolId) {
        whereClause += ` AND c.school_id = $${++paramCount}`;
        queryParams.push(filters.schoolId);
      }

      if (filters.academicYearId) {
        whereClause += ` AND c.academic_year_id = $${++paramCount}`;
        queryParams.push(filters.academicYearId);
      }

      const selectQuery = `
        SELECT c.*, ay.name as academic_year_name, s.name as school_name
        FROM classes c
        JOIN class_teachers ct ON c.id = ct.class_id
        LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
        LEFT JOIN schools s ON c.school_id = s.id
        ${whereClause}
        ORDER BY c.grade_level, c.name
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      queryParams.push(limit, offset);
      const result = await query(selectQuery, queryParams);

      return {
        classes: result.rows,
        totalItems: result.rowCount
      };
    } catch (error) {
      throw new Error(`Failed to get classes by teacher: ${error.message}`);
    }
  }
}

module.exports = ClassService;