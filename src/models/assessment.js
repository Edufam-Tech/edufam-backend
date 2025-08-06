const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Assessment {
  // Create new assessment
  static async create(assessmentData, createdBy) {
    try {
      const {
        schoolId,
        academicYearId,
        academicTermId,
        classId,
        subjectId,
        title,
        description,
        categoryId,
        totalMarks,
        passMarks,
        assessmentDate,
        durationMinutes,
        gradingScaleId,
        allowDecimalMarks,
        allowNegativeMarks,
        isFinal
      } = assessmentData;

      // Validate required fields
      if (!schoolId || !academicYearId || !title || !categoryId || !totalMarks || !assessmentDate) {
        throw new ValidationError('School ID, academic year ID, title, category ID, total marks, and assessment date are required');
      }

      // Validate marks
      if (totalMarks <= 0) {
        throw new ValidationError('Total marks must be greater than 0');
      }

      if (passMarks && (passMarks < 0 || passMarks > totalMarks)) {
        throw new ValidationError('Pass marks must be between 0 and total marks');
      }

      // Check if assessment with same title exists for the class and subject
      if (classId && subjectId) {
        const existingAssessment = await query(
          'SELECT id FROM assessments WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND title = $4',
          [schoolId, classId, subjectId, title]
        );

        if (existingAssessment.rows.length > 0) {
          throw new ConflictError('Assessment with this title already exists for this class and subject');
        }
      }

      // Insert assessment
      const result = await query(`
        INSERT INTO assessments (
          school_id, academic_year_id, academic_term_id, class_id, subject_id,
          title, description, category_id, total_marks, pass_marks, assessment_date,
          duration_minutes, grading_scale_id, allow_decimal_marks, allow_negative_marks,
          is_final, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, academicYearId, academicTermId, classId, subjectId, title, description,
        categoryId, totalMarks, passMarks || 0, assessmentDate, durationMinutes,
        gradingScaleId, allowDecimalMarks || false, allowNegativeMarks || false,
        isFinal || false, createdBy
      ]);

      const newAssessment = result.rows[0];

      // Log assessment creation
      await this.logActivity(newAssessment.id, 'ASSESSMENT_CREATED', {
        createdBy,
        schoolId,
        assessmentData: { title, totalMarks, assessmentDate }
      });

      return newAssessment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create assessment');
    }
  }

  // Get assessment by ID
  static async findById(assessmentId) {
    try {
      const result = await query(`
        SELECT 
          a.*,
          s.name as school_name,
          ay.name as academic_year_name,
          at.name as academic_term_name,
          c.name as class_name,
          sub.name as subject_name,
          gc.name as category_name,
          gs.name as grading_scale_name,
          u.first_name || ' ' || u.last_name as created_by_name
        FROM assessments a
        JOIN schools s ON a.school_id = s.id
        JOIN academic_years ay ON a.academic_year_id = ay.id
        LEFT JOIN academic_terms at ON a.academic_term_id = at.id
        LEFT JOIN classes c ON a.class_id = c.id
        LEFT JOIN subjects sub ON a.subject_id = sub.id
        JOIN grade_categories gc ON a.category_id = gc.id
        LEFT JOIN grading_scales gs ON a.grading_scale_id = gs.id
        JOIN users u ON a.created_by = u.id
        WHERE a.id = $1
      `, [assessmentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Assessment not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find assessment');
    }
  }

  // Get all assessments for a school with filters
  static async findBySchool(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          a.*,
          ay.name as academic_year_name,
          at.name as academic_term_name,
          c.name as class_name,
          sub.name as subject_name,
          gc.name as category_name,
          gs.name as grading_scale_name,
          u.first_name || ' ' || u.last_name as created_by_name
        FROM assessments a
        JOIN academic_years ay ON a.academic_year_id = ay.id
        LEFT JOIN academic_terms at ON a.academic_term_id = at.id
        LEFT JOIN classes c ON a.class_id = c.id
        LEFT JOIN subjects sub ON a.subject_id = sub.id
        JOIN grade_categories gc ON a.category_id = gc.id
        LEFT JOIN grading_scales gs ON a.grading_scale_id = gs.id
        JOIN users u ON a.created_by = u.id
        WHERE a.school_id = $1
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      // Apply filters
      if (filters.academicYearId) {
        paramCount++;
        sql += ` AND a.academic_year_id = $${paramCount}`;
        params.push(filters.academicYearId);
      }

      if (filters.academicTermId) {
        paramCount++;
        sql += ` AND a.academic_term_id = $${paramCount}`;
        params.push(filters.academicTermId);
      }

      if (filters.classId) {
        paramCount++;
        sql += ` AND a.class_id = $${paramCount}`;
        params.push(filters.classId);
      }

      if (filters.subjectId) {
        paramCount++;
        sql += ` AND a.subject_id = $${paramCount}`;
        params.push(filters.subjectId);
      }

      if (filters.categoryId) {
        paramCount++;
        sql += ` AND a.category_id = $${paramCount}`;
        params.push(filters.categoryId);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND a.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.isFinal !== undefined) {
        paramCount++;
        sql += ` AND a.is_final = $${paramCount}`;
        params.push(filters.isFinal);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND a.assessment_date >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND a.assessment_date <= $${paramCount}`;
        params.push(filters.endDate);
      }

      // Add ordering
      sql += ` ORDER BY a.assessment_date DESC, a.created_at DESC`;

      // Add pagination
      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to find assessments');
    }
  }

  // Get assessments for a specific class
  static async findByClass(classId, filters = {}) {
    try {
      let sql = `
        SELECT 
          a.*,
          ay.name as academic_year_name,
          at.name as academic_term_name,
          sub.name as subject_name,
          gc.name as category_name,
          gs.name as grading_scale_name,
          u.first_name || ' ' || u.last_name as created_by_name
        FROM assessments a
        JOIN academic_years ay ON a.academic_year_id = ay.id
        LEFT JOIN academic_terms at ON a.academic_term_id = at.id
        LEFT JOIN subjects sub ON a.subject_id = sub.id
        JOIN grade_categories gc ON a.category_id = gc.id
        LEFT JOIN grading_scales gs ON a.grading_scale_id = gs.id
        JOIN users u ON a.created_by = u.id
        WHERE a.class_id = $1
      `;
      
      const params = [classId];
      let paramCount = 1;

      // Apply filters
      if (filters.subjectId) {
        paramCount++;
        sql += ` AND a.subject_id = $${paramCount}`;
        params.push(filters.subjectId);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND a.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.isFinal !== undefined) {
        paramCount++;
        sql += ` AND a.is_final = $${paramCount}`;
        params.push(filters.isFinal);
      }

      // Add ordering
      sql += ` ORDER BY a.assessment_date DESC, a.created_at DESC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to find class assessments');
    }
  }

  // Update assessment
  static async update(assessmentId, updateData, updatedBy) {
    try {
      const assessment = await this.findById(assessmentId);
      
      // Check if assessment can be updated (not completed)
      if (assessment.status === 'completed') {
        throw new ValidationError('Cannot update completed assessment');
      }

      const {
        title,
        description,
        categoryId,
        totalMarks,
        passMarks,
        assessmentDate,
        durationMinutes,
        gradingScaleId,
        allowDecimalMarks,
        allowNegativeMarks,
        isFinal,
        status
      } = updateData;

      // Validate marks if provided
      if (totalMarks !== undefined && totalMarks <= 0) {
        throw new ValidationError('Total marks must be greater than 0');
      }

      if (passMarks !== undefined && (passMarks < 0 || passMarks > (totalMarks || assessment.total_marks))) {
        throw new ValidationError('Pass marks must be between 0 and total marks');
      }

      // Build update query dynamically
      const updateFields = [];
      const params = [];
      let paramCount = 0;

      if (title !== undefined) {
        paramCount++;
        updateFields.push(`title = $${paramCount}`);
        params.push(title);
      }

      if (description !== undefined) {
        paramCount++;
        updateFields.push(`description = $${paramCount}`);
        params.push(description);
      }

      if (categoryId !== undefined) {
        paramCount++;
        updateFields.push(`category_id = $${paramCount}`);
        params.push(categoryId);
      }

      if (totalMarks !== undefined) {
        paramCount++;
        updateFields.push(`total_marks = $${paramCount}`);
        params.push(totalMarks);
      }

      if (passMarks !== undefined) {
        paramCount++;
        updateFields.push(`pass_marks = $${paramCount}`);
        params.push(passMarks);
      }

      if (assessmentDate !== undefined) {
        paramCount++;
        updateFields.push(`assessment_date = $${paramCount}`);
        params.push(assessmentDate);
      }

      if (durationMinutes !== undefined) {
        paramCount++;
        updateFields.push(`duration_minutes = $${paramCount}`);
        params.push(durationMinutes);
      }

      if (gradingScaleId !== undefined) {
        paramCount++;
        updateFields.push(`grading_scale_id = $${paramCount}`);
        params.push(gradingScaleId);
      }

      if (allowDecimalMarks !== undefined) {
        paramCount++;
        updateFields.push(`allow_decimal_marks = $${paramCount}`);
        params.push(allowDecimalMarks);
      }

      if (allowNegativeMarks !== undefined) {
        paramCount++;
        updateFields.push(`allow_negative_marks = $${paramCount}`);
        params.push(allowNegativeMarks);
      }

      if (isFinal !== undefined) {
        paramCount++;
        updateFields.push(`is_final = $${paramCount}`);
        params.push(isFinal);
      }

      if (status !== undefined) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        params.push(status);
      }

      if (updateFields.length === 0) {
        return assessment; // No updates
      }

      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      params.push(new Date());

      paramCount++;
      params.push(assessmentId);

      const result = await query(`
        UPDATE assessments 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Assessment not found');
      }

      const updatedAssessment = result.rows[0];

      // Log assessment update
      await this.logActivity(assessmentId, 'ASSESSMENT_UPDATED', {
        updatedBy,
        updateData
      });

      return updatedAssessment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update assessment');
    }
  }

  // Delete assessment
  static async delete(assessmentId, deletedBy) {
    try {
      const assessment = await this.findById(assessmentId);
      
      // Check if assessment can be deleted
      if (assessment.status === 'completed' || assessment.status === 'grading') {
        throw new ValidationError('Cannot delete assessment that is completed or in grading');
      }

      // Check if grades exist for this assessment
      const gradesExist = await query(
        'SELECT id FROM grades WHERE assessment_id = $1 LIMIT 1',
        [assessmentId]
      );

      if (gradesExist.rows.length > 0) {
        throw new ValidationError('Cannot delete assessment with existing grades');
      }

      // Delete assessment
      const result = await query(
        'DELETE FROM assessments WHERE id = $1 RETURNING *',
        [assessmentId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Assessment not found');
      }

      // Log assessment deletion
      await this.logActivity(assessmentId, 'ASSESSMENT_DELETED', {
        deletedBy,
        assessmentData: assessment
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete assessment');
    }
  }

  // Change assessment status
  static async changeStatus(assessmentId, newStatus, updatedBy) {
    try {
      const validStatuses = ['draft', 'published', 'grading', 'completed', 'archived'];
      
      if (!validStatuses.includes(newStatus)) {
        throw new ValidationError('Invalid assessment status');
      }

      const assessment = await this.findById(assessmentId);

      // Validate status transitions
      if (assessment.status === 'completed' && newStatus !== 'archived') {
        throw new ValidationError('Completed assessments can only be archived');
      }

      if (assessment.status === 'archived' && newStatus !== 'archived') {
        throw new ValidationError('Archived assessments cannot be modified');
      }

      const result = await query(`
        UPDATE assessments 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [newStatus, assessmentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Assessment not found');
      }

      // Log status change
      await this.logActivity(assessmentId, 'ASSESSMENT_STATUS_CHANGED', {
        updatedBy,
        oldStatus: assessment.status,
        newStatus
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to change assessment status');
    }
  }

  // Get assessment statistics
  static async getStatistics(assessmentId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(g.id) as total_grades,
          COUNT(g.id) FILTER (WHERE g.status = 'approved') as approved_grades,
          COUNT(g.id) FILTER (WHERE g.status = 'draft') as draft_grades,
          COUNT(g.id) FILTER (WHERE g.status = 'submitted') as submitted_grades,
          AVG(g.marks_obtained) as average_marks,
          MIN(g.marks_obtained) as lowest_marks,
          MAX(g.marks_obtained) as highest_marks,
          COUNT(g.id) FILTER (WHERE g.is_absent = true) as absent_count
        FROM assessments a
        LEFT JOIN grades g ON a.id = g.assessment_id
        WHERE a.id = $1
        GROUP BY a.id
      `, [assessmentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Assessment not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to get assessment statistics');
    }
  }

  // Get assessments by date range
  static async findByDateRange(schoolId, startDate, endDate, filters = {}) {
    try {
      let sql = `
        SELECT 
          a.*,
          ay.name as academic_year_name,
          at.name as academic_term_name,
          c.name as class_name,
          sub.name as subject_name,
          gc.name as category_name
        FROM assessments a
        JOIN academic_years ay ON a.academic_year_id = ay.id
        LEFT JOIN academic_terms at ON a.academic_term_id = at.id
        LEFT JOIN classes c ON a.class_id = c.id
        LEFT JOIN subjects sub ON a.subject_id = sub.id
        JOIN grade_categories gc ON a.category_id = gc.id
        WHERE a.school_id = $1 AND a.assessment_date BETWEEN $2 AND $3
      `;
      
      const params = [schoolId, startDate, endDate];

      // Apply additional filters
      if (filters.classId) {
        sql += ' AND a.class_id = $4';
        params.push(filters.classId);
      }

      if (filters.subjectId) {
        sql += ` AND a.subject_id = $${params.length + 1}`;
        params.push(filters.subjectId);
      }

      if (filters.status) {
        sql += ` AND a.status = $${params.length + 1}`;
        params.push(filters.status);
      }

      sql += ' ORDER BY a.assessment_date ASC';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to find assessments by date range');
    }
  }

  // Log assessment activity
  static async logActivity(assessmentId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.deletedBy,
        action,
        'assessments',
        assessmentId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log assessment activity:', error);
    }
  }

  // Validate assessment data
  static validateAssessmentData(assessmentData) {
    const errors = [];

    if (!assessmentData.schoolId) {
      errors.push('School ID is required');
    }

    if (!assessmentData.academicYearId) {
      errors.push('Academic year ID is required');
    }

    if (!assessmentData.title || assessmentData.title.trim().length === 0) {
      errors.push('Assessment title is required');
    }

    if (!assessmentData.categoryId) {
      errors.push('Category ID is required');
    }

    if (!assessmentData.totalMarks || assessmentData.totalMarks <= 0) {
      errors.push('Total marks must be greater than 0');
    }

    if (!assessmentData.assessmentDate) {
      errors.push('Assessment date is required');
    }

    if (assessmentData.passMarks !== undefined && 
        (assessmentData.passMarks < 0 || assessmentData.passMarks > assessmentData.totalMarks)) {
      errors.push('Pass marks must be between 0 and total marks');
    }

    if (assessmentData.durationMinutes !== undefined && assessmentData.durationMinutes <= 0) {
      errors.push('Duration must be greater than 0');
    }

    return errors;
  }
}

module.exports = Assessment; 