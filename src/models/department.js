const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Department {
  // Create new department
  static async create(departmentData, createdBy) {
    try {
      const {
        schoolId,
        name,
        code,
        description,
        headOfDepartmentId,
        budget,
        location,
        contactInfo,
        isActive = true
      } = departmentData;

      // Validate required fields
      if (!schoolId || !name || !code) {
        throw new ValidationError('School ID, name, and code are required');
      }

      // Check if department code already exists for this school
      const existingCode = await query(
        'SELECT id FROM staff_departments WHERE school_id = $1 AND code = $2 AND is_active = true',
        [schoolId, code]
      );

      if (existingCode.rows.length > 0) {
        throw new ConflictError('Department code already exists for this school');
      }

      // Check if department name already exists for this school
      const existingName = await query(
        'SELECT id FROM staff_departments WHERE school_id = $1 AND name = $2 AND is_active = true',
        [schoolId, name]
      );

      if (existingName.rows.length > 0) {
        throw new ConflictError('Department name already exists for this school');
      }

      // Insert department
      const result = await query(`
        INSERT INTO staff_departments (
          school_id, name, code, description, head_of_department_id,
          budget, location, contact_info, is_active, created_by, updated_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, name, code, description, headOfDepartmentId,
        budget, location, JSON.stringify(contactInfo), isActive, createdBy, createdBy
      ]);

      const newDepartment = result.rows[0];

      // Log department creation
      await this.logDepartmentActivity(newDepartment.id, 'DEPARTMENT_CREATED', {
        createdBy,
        schoolId,
        departmentData: { name, code }
      });

      return newDepartment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create department');
    }
  }

  // Get department by ID
  static async findById(departmentId) {
    try {
      const result = await query(`
        SELECT d.*, 
               sch.name as school_name,
               s.first_name as head_first_name, s.last_name as head_last_name,
               s.email as head_email
        FROM staff_departments d
        LEFT JOIN schools sch ON d.school_id = sch.id
        LEFT JOIN staff s ON d.head_of_department_id = s.id
        WHERE d.id = $1 AND d.is_active = true
      `, [departmentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Department not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find department');
    }
  }

  // Get all departments with pagination and filters
  static async findAll(filters = {}, pagination = {}) {
    try {
      const {
        schoolId,
        isActive = true,
        search
      } = filters;

      const { page = 1, limit = 10 } = pagination;
      const offset = (page - 1) * limit;

      let whereConditions = ['d.is_active = $1'];
      let params = [isActive];
      let paramIndex = 2;

      if (schoolId) {
        whereConditions.push(`d.school_id = $${paramIndex++}`);
        params.push(schoolId);
      }

      if (search) {
        whereConditions.push(`(
          d.name ILIKE $${paramIndex} OR 
          d.code ILIKE $${paramIndex} OR 
          d.description ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM staff_departments d WHERE ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get departments with related data
      const result = await query(`
        SELECT d.*, 
               sch.name as school_name,
               s.first_name as head_first_name, s.last_name as head_last_name,
               s.email as head_email,
               (SELECT COUNT(*) FROM staff WHERE department_id = d.id AND is_active = true) as staff_count
        FROM staff_departments d
        LEFT JOIN schools sch ON d.school_id = sch.id
        LEFT JOIN staff s ON d.head_of_department_id = s.id
        WHERE ${whereClause}
        ORDER BY d.name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      return {
        departments: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to fetch departments');
    }
  }

  // Update department
  static async update(departmentId, updateData, updatedBy) {
    try {
      const {
        name,
        code,
        description,
        headOfDepartmentId,
        budget,
        location,
        contactInfo
      } = updateData;

      // Check if department exists
      const existingDepartment = await this.findById(departmentId);

      // Check if code is being changed and if it already exists
      if (code && code !== existingDepartment.code) {
        const codeExists = await query(
          'SELECT id FROM staff_departments WHERE school_id = $1 AND code = $2 AND id != $3 AND is_active = true',
          [existingDepartment.school_id, code, departmentId]
        );

        if (codeExists.rows.length > 0) {
          throw new ConflictError('Department code already exists for this school');
        }
      }

      // Check if name is being changed and if it already exists
      if (name && name !== existingDepartment.name) {
        const nameExists = await query(
          'SELECT id FROM staff_departments WHERE school_id = $1 AND name = $2 AND id != $3 AND is_active = true',
          [existingDepartment.school_id, name, departmentId]
        );

        if (nameExists.rows.length > 0) {
          throw new ConflictError('Department name already exists for this school');
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

      if (code !== undefined) {
        updateFields.push(`code = $${paramIndex++}`);
        params.push(code);
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        params.push(description);
      }

      if (headOfDepartmentId !== undefined) {
        updateFields.push(`head_of_department_id = $${paramIndex++}`);
        params.push(headOfDepartmentId);
      }

      if (budget !== undefined) {
        updateFields.push(`budget = $${paramIndex++}`);
        params.push(budget);
      }

      if (location !== undefined) {
        updateFields.push(`location = $${paramIndex++}`);
        params.push(location);
      }

      if (contactInfo !== undefined) {
        updateFields.push(`contact_info = $${paramIndex++}`);
        params.push(JSON.stringify(contactInfo));
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push(`updated_by = $${paramIndex++}`);
      updateFields.push(`updated_at = NOW()`);
      params.push(updatedBy);
      params.push(departmentId);

      const result = await query(`
        UPDATE staff_departments 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Department not found');
      }

      const updatedDepartment = result.rows[0];

      // Log department update
      await this.logDepartmentActivity(departmentId, 'DEPARTMENT_UPDATED', {
        updatedBy,
        updatedFields: Object.keys(updateData)
      });

      return updatedDepartment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to update department');
    }
  }

  // Delete department
  static async delete(departmentId, deletedBy) {
    try {
      // Check if department has active staff members
      const staffCount = await query(
        'SELECT COUNT(*) as count FROM staff WHERE department_id = $1 AND is_active = true',
        [departmentId]
      );

      if (parseInt(staffCount.rows[0].count) > 0) {
        throw new ConflictError('Cannot delete department with active staff members');
      }

      const result = await query(`
        UPDATE staff_departments 
        SET is_active = false, updated_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [deletedBy, departmentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Department not found');
      }

      const deletedDepartment = result.rows[0];

      // Log department deletion
      await this.logDepartmentActivity(departmentId, 'DEPARTMENT_DELETED', {
        deletedBy
      });

      return deletedDepartment;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete department');
    }
  }

  // Get department statistics
  static async getStatistics(departmentId) {
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM staff WHERE department_id = $1 AND is_active = true) as total_staff,
          (SELECT COUNT(*) FROM staff WHERE department_id = $1 AND staff_type = 'teacher' AND is_active = true) as teachers,
          (SELECT COUNT(*) FROM staff WHERE department_id = $1 AND staff_type = 'admin' AND is_active = true) as admin_staff,
          (SELECT COUNT(*) FROM staff WHERE department_id = $1 AND staff_type = 'support' AND is_active = true) as support_staff,
          (SELECT COUNT(*) FROM staff WHERE department_id = $1 AND gender = 'male' AND is_active = true) as male_staff,
          (SELECT COUNT(*) FROM staff WHERE department_id = $1 AND gender = 'female' AND is_active = true) as female_staff,
          (SELECT AVG(salary) FROM staff WHERE department_id = $1 AND salary IS NOT NULL AND is_active = true) as avg_salary
      `, [departmentId]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get department statistics');
    }
  }

  // Get staff by department
  static async getStaffByDepartment(departmentId, filters = {}) {
    try {
      const { staffType, isActive = true } = filters;

      let whereConditions = ['department_id = $1'];
      let params = [departmentId];
      let paramIndex = 2;

      if (isActive !== undefined) {
        whereConditions.push(`is_active = $${paramIndex++}`);
        params.push(isActive);
      }

      if (staffType) {
        whereConditions.push(`staff_type = $${paramIndex++}`);
        params.push(staffType);
      }

      const whereClause = whereConditions.join(' AND ');

      const result = await query(`
        SELECT id, first_name, last_name, email, phone, staff_type, 
               contract_type, employment_date, salary
        FROM staff
        WHERE ${whereClause}
        ORDER BY first_name, last_name
      `, params);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get staff by department');
    }
  }

  // Log department activity
  static async logDepartmentActivity(departmentId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.deletedBy,
        action,
        'staff_departments',
        departmentId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log department activity:', error);
    }
  }

  // Validate department data
  static validateDepartmentData(departmentData) {
    const errors = [];

    if (!departmentData.name || departmentData.name.trim().length < 2) {
      errors.push('Department name must be at least 2 characters long');
    }

    if (!departmentData.code || departmentData.code.trim().length < 2) {
      errors.push('Department code must be at least 2 characters long');
    }

    if (departmentData.code && !/^[A-Z0-9_-]+$/.test(departmentData.code)) {
      errors.push('Department code can only contain uppercase letters, numbers, hyphens, and underscores');
    }

    if (departmentData.budget && departmentData.budget < 0) {
      errors.push('Budget cannot be negative');
    }

    return errors;
  }
}

module.exports = Department; 