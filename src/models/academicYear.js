const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class AcademicYear {
  // Create new academic year
  static async create(academicYearData, createdBy) {
    try {
      const {
        schoolId,
        name,
        startDate,
        endDate,
        isActive = false,
        description
      } = academicYearData;

      // Validate required fields
      if (!schoolId || !name || !startDate || !endDate) {
        throw new ValidationError('School ID, name, start date, and end date are required');
      }

      // Validate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        throw new ValidationError('End date must be after start date');
      }

      // Check if academic year name already exists for this school
      const existingYear = await query(
        'SELECT id FROM academic_years WHERE school_id = $1 AND name = $2',
        [schoolId, name]
      );

      if (existingYear.rows.length > 0) {
        throw new ConflictError('Academic year with this name already exists for this school');
      }

      // If this is set as active, deactivate other active years for this school
      if (isActive) {
        await query(
          'UPDATE academic_years SET is_active = false WHERE school_id = $1',
          [schoolId]
        );
      }

      // Insert academic year
      const result = await query(`
        INSERT INTO academic_years (
          school_id, name, start_date, end_date, is_active, description,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `, [schoolId, name, startDate, endDate, isActive, description]);

      const newAcademicYear = result.rows[0];

      // Log academic year creation
      await this.logActivity(newAcademicYear.id, 'ACADEMIC_YEAR_CREATED', {
        createdBy,
        schoolId,
        academicYearData: { name, startDate, endDate, isActive }
      });

      return newAcademicYear;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create academic year');
    }
  }

  // Get academic year by ID
  static async findById(academicYearId) {
    try {
      const result = await query(`
        SELECT ay.*, s.name as school_name 
        FROM academic_years ay
        JOIN schools s ON ay.school_id = s.id
        WHERE ay.id = $1
      `, [academicYearId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Academic year not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find academic year');
    }
  }

  // Get all academic years for a school
  static async findBySchool(schoolId, filters = {}) {
    try {
      const { isActive, current } = filters;
      
      let whereConditions = ['school_id = $1'];
      let params = [schoolId];
      let paramIndex = 2;

      if (isActive !== undefined) {
        whereConditions.push(`is_active = $${paramIndex++}`);
        params.push(isActive);
      }

      if (current) {
        const now = new Date();
        whereConditions.push(`start_date <= $${paramIndex} AND end_date >= $${paramIndex}`);
        params.push(now);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      const result = await query(`
        SELECT ay.*, s.name as school_name 
        FROM academic_years ay
        JOIN schools s ON ay.school_id = s.id
        WHERE ${whereClause}
        ORDER BY start_date DESC
      `, params);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to fetch academic years');
    }
  }

  // Get current academic year for a school
  static async getCurrent(schoolId) {
    try {
      const now = new Date();
      const result = await query(`
        SELECT ay.*, s.name as school_name 
        FROM academic_years ay
        JOIN schools s ON ay.school_id = s.id
        WHERE ay.school_id = $1 
          AND ay.start_date <= $2 
          AND ay.end_date >= $2
        ORDER BY ay.is_active DESC, ay.start_date DESC
        LIMIT 1
      `, [schoolId, now]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get current academic year');
    }
  }

  // Get active academic year for a school
  static async getActive(schoolId) {
    try {
      const result = await query(`
        SELECT ay.*, s.name as school_name 
        FROM academic_years ay
        JOIN schools s ON ay.school_id = s.id
        WHERE ay.school_id = $1 AND ay.is_active = true
        LIMIT 1
      `, [schoolId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get active academic year');
    }
  }

  // Update academic year
  static async update(academicYearId, updateData, updatedBy) {
    try {
      const {
        name,
        startDate,
        endDate,
        isActive,
        description
      } = updateData;

      // Check if academic year exists
      const existingYear = await this.findById(academicYearId);

      // Validate date range if dates are being updated
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
          throw new ValidationError('End date must be after start date');
        }
      }

      // Check if name is being changed and if it already exists
      if (name && name !== existingYear.name) {
        const nameExists = await query(
          'SELECT id FROM academic_years WHERE school_id = $1 AND name = $2 AND id != $3',
          [existingYear.school_id, name, academicYearId]
        );

        if (nameExists.rows.length > 0) {
          throw new ConflictError('Academic year with this name already exists');
        }
      }

      // If setting as active, deactivate other active years for this school
      if (isActive && !existingYear.is_active) {
        await query(
          'UPDATE academic_years SET is_active = false WHERE school_id = $1',
          [existingYear.school_id]
        );
      }

      // Build update query dynamically
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        params.push(name);
      }

      if (startDate !== undefined) {
        updateFields.push(`start_date = $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate !== undefined) {
        updateFields.push(`end_date = $${paramIndex++}`);
        params.push(endDate);
      }

      if (isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        params.push(isActive);
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        params.push(description);
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(academicYearId);

      const result = await query(`
        UPDATE academic_years 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Academic year not found');
      }

      const updatedYear = result.rows[0];

      // Log academic year update
      await this.logActivity(academicYearId, 'ACADEMIC_YEAR_UPDATED', {
        updatedBy,
        updatedFields: Object.keys(updateData)
      });

      return updatedYear;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to update academic year');
    }
  }

  // Delete academic year
  static async delete(academicYearId, deletedBy) {
    try {
      // Check if academic year exists
      const existingYear = await this.findById(academicYearId);

      // Check if academic year is active
      if (existingYear.is_active) {
        throw new ValidationError('Cannot delete active academic year');
      }

      // Check if academic year has associated terms
      const termsCount = await query(
        'SELECT COUNT(*) as count FROM academic_terms WHERE academic_year_id = $1',
        [academicYearId]
      );

      if (parseInt(termsCount.rows[0].count) > 0) {
        throw new ValidationError('Cannot delete academic year with associated terms');
      }

      const result = await query(`
        DELETE FROM academic_years 
        WHERE id = $1
        RETURNING *
      `, [academicYearId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Academic year not found');
      }

      // Log academic year deletion
      await this.logActivity(academicYearId, 'ACADEMIC_YEAR_DELETED', {
        deletedBy,
        schoolId: existingYear.school_id
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete academic year');
    }
  }

  // Set academic year as active
  static async setActive(academicYearId, updatedBy) {
    try {
      // Check if academic year exists
      const existingYear = await this.findById(academicYearId);

      // Deactivate all other academic years for this school
      await query(
        'UPDATE academic_years SET is_active = false WHERE school_id = $1',
        [existingYear.school_id]
      );

      // Activate this academic year
      const result = await query(`
        UPDATE academic_years 
        SET is_active = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [academicYearId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Academic year not found');
      }

      // Log activation
      await this.logActivity(academicYearId, 'ACADEMIC_YEAR_ACTIVATED', {
        updatedBy,
        schoolId: existingYear.school_id
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to activate academic year');
    }
  }

  // Get academic year statistics
  static async getStatistics(academicYearId) {
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM academic_terms WHERE academic_year_id = $1) as total_terms,
          (SELECT COUNT(*) FROM students WHERE school_id = (SELECT school_id FROM academic_years WHERE id = $1)) as total_students,
          (SELECT COUNT(*) FROM staff WHERE school_id = (SELECT school_id FROM academic_years WHERE id = $1)) as total_staff
      `, [academicYearId]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get academic year statistics');
    }
  }

  // Log activity
  static async logActivity(academicYearId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.deletedBy,
        action,
        'academic_years',
        academicYearId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      // Don't throw error for audit logging failures
      console.error('Failed to log academic year activity:', error);
    }
  }

  // Validate academic year data
  static validateAcademicYearData(academicYearData) {
    const errors = [];

    if (!academicYearData.name || academicYearData.name.trim().length < 2) {
      errors.push('Academic year name must be at least 2 characters long');
    }

    if (!academicYearData.startDate) {
      errors.push('Start date is required');
    }

    if (!academicYearData.endDate) {
      errors.push('End date is required');
    }

    if (academicYearData.startDate && academicYearData.endDate) {
      const start = new Date(academicYearData.startDate);
      const end = new Date(academicYearData.endDate);
      
      if (start >= end) {
        errors.push('End date must be after start date');
      }

      // Check if academic year is at least 6 months long
      const sixMonthsFromStart = new Date(start);
      sixMonthsFromStart.setMonth(sixMonthsFromStart.getMonth() + 6);
      
      if (end < sixMonthsFromStart) {
        errors.push('Academic year must be at least 6 months long');
      }
    }

    return errors;
  }

  // Generate academic year name from dates
  static generateName(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    if (startYear === endYear) {
      return `${startYear}`;
    } else {
      return `${startYear}/${endYear}`;
    }
  }

  // Check if date falls within academic year
  static isDateInAcademicYear(date, academicYear) {
    const checkDate = new Date(date);
    const startDate = new Date(academicYear.start_date);
    const endDate = new Date(academicYear.end_date);
    
    return checkDate >= startDate && checkDate <= endDate;
  }
}

module.exports = AcademicYear; 