const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class AcademicTerm {
  // Create new academic term
  static async create(termData, createdBy) {
    try {
      const {
        academicYearId,
        name,
        startDate,
        endDate,
        isActive = false,
        description,
        curriculumType = '8-4-4', // CBC, IGCSE, 8-4-4
        termNumber,
        gradingPeriods = []
      } = termData;

      // Validate required fields
      if (!academicYearId || !name || !startDate || !endDate) {
        throw new ValidationError('Academic year ID, name, start date, and end date are required');
      }

      // Validate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        throw new ValidationError('End date must be after start date');
      }

      // Check if academic year exists
      const academicYear = await query(
        'SELECT * FROM academic_years WHERE id = $1',
        [academicYearId]
      );

      if (academicYear.rows.length === 0) {
        throw new NotFoundError('Academic year not found');
      }

      // Validate term dates fall within academic year
      const yearStart = new Date(academicYear.rows[0].start_date);
      const yearEnd = new Date(academicYear.rows[0].end_date);
      
      if (start < yearStart || end > yearEnd) {
        throw new ValidationError('Term dates must fall within the academic year');
      }

      // Check if term name already exists for this academic year
      const existingTerm = await query(
        'SELECT id FROM academic_terms WHERE academic_year_id = $1 AND name = $2',
        [academicYearId, name]
      );

      if (existingTerm.rows.length > 0) {
        throw new ConflictError('Term with this name already exists for this academic year');
      }

      // Check for overlapping terms
      const overlappingTerm = await query(`
        SELECT id, name FROM academic_terms 
        WHERE academic_year_id = $1 
          AND (
            (start_date <= $2 AND end_date >= $2) OR
            (start_date <= $3 AND end_date >= $3) OR
            (start_date >= $2 AND end_date <= $3)
          )
      `, [academicYearId, startDate, endDate]);

      if (overlappingTerm.rows.length > 0) {
        throw new ConflictError('Term dates overlap with existing term');
      }

      // If this is set as active, deactivate other active terms for this academic year
      if (isActive) {
        await query(
          'UPDATE academic_terms SET is_active = false WHERE academic_year_id = $1',
          [academicYearId]
        );
      }

      // Insert academic term
      const result = await query(`
        INSERT INTO academic_terms (
          academic_year_id, name, start_date, end_date, is_active, description,
          curriculum_type, term_number, grading_periods, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `, [academicYearId, name, startDate, endDate, isActive, description, curriculumType, termNumber, JSON.stringify(gradingPeriods)]);

      const newTerm = result.rows[0];

      // Log term creation
      await this.logActivity(newTerm.id, 'ACADEMIC_TERM_CREATED', {
        createdBy,
        academicYearId,
        termData: { name, startDate, endDate, isActive, curriculumType }
      });

      return newTerm;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create academic term');
    }
  }

  // Get term by ID
  static async findById(termId) {
    try {
      const result = await query(`
        SELECT at.*, ay.name as academic_year_name, ay.school_id, s.name as school_name
        FROM academic_terms at
        JOIN academic_years ay ON at.academic_year_id = ay.id
        JOIN schools s ON ay.school_id = s.id
        WHERE at.id = $1
      `, [termId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Academic term not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find academic term');
    }
  }

  // Get all terms for an academic year
  static async findByAcademicYear(academicYearId, filters = {}) {
    try {
      const { isActive, curriculumType, current } = filters;
      
      let whereConditions = ['academic_year_id = $1'];
      let params = [academicYearId];
      let paramIndex = 2;

      if (isActive !== undefined) {
        whereConditions.push(`is_active = $${paramIndex++}`);
        params.push(isActive);
      }

      if (curriculumType) {
        whereConditions.push(`curriculum_type = $${paramIndex++}`);
        params.push(curriculumType);
      }

      if (current) {
        const now = new Date();
        whereConditions.push(`start_date <= $${paramIndex} AND end_date >= $${paramIndex}`);
        params.push(now);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      const result = await query(`
        SELECT at.*, ay.name as academic_year_name
        FROM academic_terms at
        JOIN academic_years ay ON at.academic_year_id = ay.id
        WHERE ${whereClause}
        ORDER BY start_date ASC
      `, params);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to fetch academic terms');
    }
  }

  // Get current term for a school
  static async getCurrent(schoolId) {
    try {
      const now = new Date();
      const result = await query(`
        SELECT at.*, ay.name as academic_year_name, ay.school_id, s.name as school_name
        FROM academic_terms at
        JOIN academic_years ay ON at.academic_year_id = ay.id
        JOIN schools s ON ay.school_id = s.id
        WHERE ay.school_id = $1 
          AND at.start_date <= $2 
          AND at.end_date >= $2
        ORDER BY at.is_active DESC, at.start_date DESC
        LIMIT 1
      `, [schoolId, now]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get current academic term');
    }
  }

  // Get active term for an academic year
  static async getActive(academicYearId) {
    try {
      const result = await query(`
        SELECT at.*, ay.name as academic_year_name
        FROM academic_terms at
        JOIN academic_years ay ON at.academic_year_id = ay.id
        WHERE at.academic_year_id = $1 AND at.is_active = true
        LIMIT 1
      `, [academicYearId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get active academic term');
    }
  }

  // Update academic term
  static async update(termId, updateData, updatedBy) {
    try {
      const {
        name,
        startDate,
        endDate,
        isActive,
        description,
        curriculumType,
        termNumber,
        gradingPeriods
      } = updateData;

      // Check if term exists
      const existingTerm = await this.findById(termId);

      // Validate date range if dates are being updated
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
          throw new ValidationError('End date must be after start date');
        }

        // Check if academic year exists and validate term dates fall within academic year
        const academicYear = await query(
          'SELECT * FROM academic_years WHERE id = $1',
          [existingTerm.academic_year_id]
        );

        if (academicYear.rows.length > 0) {
          const yearStart = new Date(academicYear.rows[0].start_date);
          const yearEnd = new Date(academicYear.rows[0].end_date);
          
          if (start < yearStart || end > yearEnd) {
            throw new ValidationError('Term dates must fall within the academic year');
          }
        }

        // Check for overlapping terms (excluding current term)
        const overlappingTerm = await query(`
          SELECT id, name FROM academic_terms 
          WHERE academic_year_id = $1 
            AND id != $2
            AND (
              (start_date <= $3 AND end_date >= $3) OR
              (start_date <= $4 AND end_date >= $4) OR
              (start_date >= $3 AND end_date <= $4)
            )
        `, [existingTerm.academic_year_id, termId, startDate, endDate]);

        if (overlappingTerm.rows.length > 0) {
          throw new ConflictError('Term dates overlap with existing term');
        }
      }

      // Check if name is being changed and if it already exists
      if (name && name !== existingTerm.name) {
        const nameExists = await query(
          'SELECT id FROM academic_terms WHERE academic_year_id = $1 AND name = $2 AND id != $3',
          [existingTerm.academic_year_id, name, termId]
        );

        if (nameExists.rows.length > 0) {
          throw new ConflictError('Term with this name already exists');
        }
      }

      // If setting as active, deactivate other active terms for this academic year
      if (isActive && !existingTerm.is_active) {
        await query(
          'UPDATE academic_terms SET is_active = false WHERE academic_year_id = $1',
          [existingTerm.academic_year_id]
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

      if (curriculumType !== undefined) {
        updateFields.push(`curriculum_type = $${paramIndex++}`);
        params.push(curriculumType);
      }

      if (termNumber !== undefined) {
        updateFields.push(`term_number = $${paramIndex++}`);
        params.push(termNumber);
      }

      if (gradingPeriods !== undefined) {
        updateFields.push(`grading_periods = $${paramIndex++}`);
        params.push(JSON.stringify(gradingPeriods));
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(termId);

      const result = await query(`
        UPDATE academic_terms 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Academic term not found');
      }

      const updatedTerm = result.rows[0];

      // Log term update
      await this.logActivity(termId, 'ACADEMIC_TERM_UPDATED', {
        updatedBy,
        updatedFields: Object.keys(updateData)
      });

      return updatedTerm;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to update academic term');
    }
  }

  // Delete academic term
  static async delete(termId, deletedBy) {
    try {
      // Check if term exists
      const existingTerm = await this.findById(termId);

      // Check if term is active
      if (existingTerm.is_active) {
        throw new ValidationError('Cannot delete active academic term');
      }

      // Check if term has associated grades or attendance records
      const gradesCount = await query(
        'SELECT COUNT(*) as count FROM grades WHERE academic_term_id = $1',
        [termId]
      );

      const attendanceCount = await query(
        'SELECT COUNT(*) as count FROM attendance WHERE academic_term_id = $1',
        [termId]
      );

      if (parseInt(gradesCount.rows[0].count) > 0 || parseInt(attendanceCount.rows[0].count) > 0) {
        throw new ValidationError('Cannot delete academic term with associated grades or attendance records');
      }

      const result = await query(`
        DELETE FROM academic_terms 
        WHERE id = $1
        RETURNING *
      `, [termId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Academic term not found');
      }

      // Log term deletion
      await this.logActivity(termId, 'ACADEMIC_TERM_DELETED', {
        deletedBy,
        academicYearId: existingTerm.academic_year_id
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete academic term');
    }
  }

  // Set term as active
  static async setActive(termId, updatedBy) {
    try {
      // Check if term exists
      const existingTerm = await this.findById(termId);

      // Deactivate all other terms for this academic year
      await query(
        'UPDATE academic_terms SET is_active = false WHERE academic_year_id = $1',
        [existingTerm.academic_year_id]
      );

      // Activate this term
      const result = await query(`
        UPDATE academic_terms 
        SET is_active = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [termId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Academic term not found');
      }

      // Log activation
      await this.logActivity(termId, 'ACADEMIC_TERM_ACTIVATED', {
        updatedBy,
        academicYearId: existingTerm.academic_year_id
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to activate academic term');
    }
  }

  // Get term statistics
  static async getStatistics(termId) {
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM students WHERE school_id = (SELECT ay.school_id FROM academic_terms at JOIN academic_years ay ON at.academic_year_id = ay.id WHERE at.id = $1)) as total_students,
          (SELECT COUNT(*) FROM grades WHERE academic_term_id = $1) as total_grades,
          (SELECT COUNT(*) FROM attendance WHERE academic_term_id = $1) as total_attendance_records
      `, [termId]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get academic term statistics');
    }
  }

  // Get terms by curriculum type
  static async findByCurriculumType(schoolId, curriculumType, academicYearId = null) {
    try {
      let whereConditions = ['ay.school_id = $1', 'at.curriculum_type = $2'];
      let params = [schoolId, curriculumType];
      let paramIndex = 3;

      if (academicYearId) {
        whereConditions.push(`at.academic_year_id = $${paramIndex++}`);
        params.push(academicYearId);
      }

      const whereClause = whereConditions.join(' AND ');

      const result = await query(`
        SELECT at.*, ay.name as academic_year_name
        FROM academic_terms at
        JOIN academic_years ay ON at.academic_year_id = ay.id
        WHERE ${whereClause}
        ORDER BY ay.start_date DESC, at.start_date ASC
      `, params);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to fetch terms by curriculum type');
    }
  }

  // Log activity
  static async logActivity(termId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.deletedBy,
        action,
        'academic_terms',
        termId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      // Don't throw error for audit logging failures
      console.error('Failed to log academic term activity:', error);
    }
  }

  // Validate academic term data
  static validateAcademicTermData(termData) {
    const errors = [];

    if (!termData.name || termData.name.trim().length < 2) {
      errors.push('Academic term name must be at least 2 characters long');
    }

    if (!termData.startDate) {
      errors.push('Start date is required');
    }

    if (!termData.endDate) {
      errors.push('End date is required');
    }

    if (termData.startDate && termData.endDate) {
      const start = new Date(termData.startDate);
      const end = new Date(termData.endDate);
      
      if (start >= end) {
        errors.push('End date must be after start date');
      }

      // Check if term is at least 1 month long
      const oneMonthFromStart = new Date(start);
      oneMonthFromStart.setMonth(oneMonthFromStart.getMonth() + 1);
      
      if (end < oneMonthFromStart) {
        errors.push('Academic term must be at least 1 month long');
      }
    }

    if (termData.curriculumType && !['CBC', 'IGCSE', '8-4-4'].includes(termData.curriculumType)) {
      errors.push('Curriculum type must be CBC, IGCSE, or 8-4-4');
    }

    if (termData.termNumber && (termData.termNumber < 1 || termData.termNumber > 12)) {
      errors.push('Term number must be between 1 and 12');
    }

    return errors;
  }

  // Generate default term names for curriculum types
  static generateDefaultTermNames(curriculumType) {
    switch (curriculumType) {
      case 'CBC':
        return ['Term 1', 'Term 2', 'Term 3'];
      case 'IGCSE':
        return ['Term 1', 'Term 2', 'Term 3'];
      case '8-4-4':
        return ['Term 1', 'Term 2', 'Term 3'];
      default:
        return ['Term 1', 'Term 2', 'Term 3'];
    }
  }

  // Check if date falls within term
  static isDateInTerm(date, term) {
    const checkDate = new Date(date);
    const startDate = new Date(term.start_date);
    const endDate = new Date(term.end_date);
    
    return checkDate >= startDate && checkDate <= endDate;
  }

  // Get term progress percentage
  static getTermProgress(term) {
    const now = new Date();
    const startDate = new Date(term.start_date);
    const endDate = new Date(term.end_date);
    
    if (now < startDate) return 0;
    if (now > endDate) return 100;
    
    const totalDuration = endDate - startDate;
    const elapsed = now - startDate;
    
    return Math.round((elapsed / totalDuration) * 100);
  }
}

module.exports = AcademicTerm; 