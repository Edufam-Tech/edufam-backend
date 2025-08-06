const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Grade {
  // Create new grade
  static async create(gradeData, createdBy) {
    try {
      const {
        schoolId,
        assessmentId,
        studentId,
        marksObtained,
        remarks,
        isAbsent,
        isExempted
      } = gradeData;

      // Validate required fields
      if (!schoolId || !assessmentId || !studentId) {
        throw new ValidationError('School ID, assessment ID, and student ID are required');
      }

      // Check if grade already exists for this student and assessment
      const existingGrade = await query(
        'SELECT id FROM grades WHERE student_id = $1 AND assessment_id = $2',
        [studentId, assessmentId]
      );

      if (existingGrade.rows.length > 0) {
        throw new ConflictError('Grade already exists for this student and assessment');
      }

      // Get assessment details for validation
      const assessment = await query(
        'SELECT total_marks, allow_decimal_marks, allow_negative_marks FROM assessments WHERE id = $1',
        [assessmentId]
      );

      if (assessment.rows.length === 0) {
        throw new NotFoundError('Assessment not found');
      }

      const assessmentDetails = assessment.rows[0];

      // Validate marks if not absent
      if (!isAbsent && marksObtained !== undefined) {
        if (marksObtained < 0 && !assessmentDetails.allow_negative_marks) {
          throw new ValidationError('Negative marks are not allowed for this assessment');
        }

        if (marksObtained > assessmentDetails.total_marks) {
          throw new ValidationError(`Marks cannot exceed total marks (${assessmentDetails.total_marks})`);
        }

        // Check decimal marks
        if (!assessmentDetails.allow_decimal_marks && marksObtained % 1 !== 0) {
          throw new ValidationError('Decimal marks are not allowed for this assessment');
        }
      }

      // Insert grade
      const result = await query(`
        INSERT INTO grades (
          school_id, assessment_id, student_id, marks_obtained, remarks,
          is_absent, is_exempted, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, assessmentId, studentId, 
        isAbsent ? 0 : (marksObtained || 0), 
        remarks, isAbsent || false, isExempted || false, createdBy
      ]);

      const newGrade = result.rows[0];

      // Log grade creation
      await this.logActivity(newGrade.id, 'GRADE_CREATED', {
        createdBy,
        schoolId,
        gradeData: { marksObtained, isAbsent, isExempted }
      });

      return newGrade;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to create grade');
    }
  }

  // Bulk create grades
  static async bulkCreate(gradesData, createdBy) {
    try {
      const results = [];
      const errors = [];

      for (let i = 0; i < gradesData.length; i++) {
        try {
          const grade = await this.create(gradesData[i], createdBy);
          results.push(grade);
        } catch (error) {
          errors.push({
            index: i,
            data: gradesData[i],
            error: error.message
          });
        }
      }

      return {
        success: results,
        errors: errors,
        totalProcessed: gradesData.length,
        successCount: results.length,
        errorCount: errors.length
      };
    } catch (error) {
      throw new DatabaseError('Failed to bulk create grades');
    }
  }

  // Get grade by ID
  static async findById(gradeId) {
    try {
      const result = await query(`
        SELECT 
          g.*,
          s.name as school_name,
          a.title as assessment_title,
          a.total_marks,
          a.pass_marks,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number,
          u.first_name || ' ' || u.last_name as created_by_name,
          sb.first_name || ' ' || sb.last_name as submitted_by_name,
          ap.first_name || ' ' || ap.last_name as approved_by_name
        FROM grades g
        JOIN schools s ON g.school_id = s.id
        JOIN assessments a ON g.assessment_id = a.id
        JOIN students st ON g.student_id = st.id
        JOIN users u ON g.created_by = u.id
        LEFT JOIN users sb ON g.submitted_by = sb.id
        LEFT JOIN users ap ON g.approved_by = ap.id
        WHERE g.id = $1
      `, [gradeId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Grade not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find grade');
    }
  }

  // Get grades for an assessment
  static async findByAssessment(assessmentId, filters = {}) {
    try {
      let sql = `
        SELECT 
          g.*,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number,
          u.first_name || ' ' || u.last_name as created_by_name,
          sb.first_name || ' ' || sb.last_name as submitted_by_name,
          ap.first_name || ' ' || ap.last_name as approved_by_name
        FROM grades g
        JOIN students st ON g.student_id = st.id
        JOIN users u ON g.created_by = u.id
        LEFT JOIN users sb ON g.submitted_by = sb.id
        LEFT JOIN users ap ON g.approved_by = ap.id
        WHERE g.assessment_id = $1
      `;
      
      const params = [assessmentId];
      let paramCount = 1;

      // Apply filters
      if (filters.status) {
        paramCount++;
        sql += ` AND g.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.isAbsent !== undefined) {
        paramCount++;
        sql += ` AND g.is_absent = $${paramCount}`;
        params.push(filters.isAbsent);
      }

      if (filters.isExempted !== undefined) {
        paramCount++;
        sql += ` AND g.is_exempted = $${paramCount}`;
        params.push(filters.isExempted);
      }

      // Add ordering
      sql += ` ORDER BY st.first_name, st.last_name`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to find assessment grades');
    }
  }

  // Get grades for a student
  static async findByStudent(studentId, filters = {}) {
    try {
      let sql = `
        SELECT 
          g.*,
          a.title as assessment_title,
          a.total_marks,
          a.pass_marks,
          a.assessment_date,
          gc.name as category_name,
          sub.name as subject_name,
          u.first_name || ' ' || u.last_name as created_by_name,
          sb.first_name || ' ' || sb.last_name as submitted_by_name,
          ap.first_name || ' ' || ap.last_name as approved_by_name
        FROM grades g
        JOIN assessments a ON g.assessment_id = a.id
        JOIN grade_categories gc ON a.category_id = gc.id
        LEFT JOIN subjects sub ON a.subject_id = sub.id
        JOIN users u ON g.created_by = u.id
        LEFT JOIN users sb ON g.submitted_by = sb.id
        LEFT JOIN users ap ON g.approved_by = ap.id
        WHERE g.student_id = $1
      `;
      
      const params = [studentId];
      let paramCount = 1;

      // Apply filters
      if (filters.assessmentId) {
        paramCount++;
        sql += ` AND g.assessment_id = $${paramCount}`;
        params.push(filters.assessmentId);
      }

      if (filters.status) {
        paramCount++;
        sql += ` AND g.status = $${paramCount}`;
        params.push(filters.status);
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
      sql += ` ORDER BY a.assessment_date DESC, a.title`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to find student grades');
    }
  }

  // Update grade
  static async update(gradeId, updateData, updatedBy) {
    try {
      const grade = await this.findById(gradeId);
      
      // Check if grade can be updated
      if (grade.status === 'approved') {
        throw new ValidationError('Cannot update approved grade');
      }

      const {
        marksObtained,
        remarks,
        isAbsent,
        isExempted
      } = updateData;

      // Get assessment details for validation
      const assessment = await query(
        'SELECT total_marks, allow_decimal_marks, allow_negative_marks FROM assessments WHERE id = $1',
        [grade.assessment_id]
      );

      const assessmentDetails = assessment.rows[0];

      // Validate marks if not absent
      if (!isAbsent && marksObtained !== undefined) {
        if (marksObtained < 0 && !assessmentDetails.allow_negative_marks) {
          throw new ValidationError('Negative marks are not allowed for this assessment');
        }

        if (marksObtained > assessmentDetails.total_marks) {
          throw new ValidationError(`Marks cannot exceed total marks (${assessmentDetails.total_marks})`);
        }

        // Check decimal marks
        if (!assessmentDetails.allow_decimal_marks && marksObtained % 1 !== 0) {
          throw new ValidationError('Decimal marks are not allowed for this assessment');
        }
      }

      // Build update query
      const updateFields = [];
      const params = [];
      let paramCount = 0;

      if (marksObtained !== undefined) {
        paramCount++;
        updateFields.push(`marks_obtained = $${paramCount}`);
        params.push(isAbsent ? 0 : marksObtained);
      }

      if (remarks !== undefined) {
        paramCount++;
        updateFields.push(`remarks = $${paramCount}`);
        params.push(remarks);
      }

      if (isAbsent !== undefined) {
        paramCount++;
        updateFields.push(`is_absent = $${paramCount}`);
        params.push(isAbsent);
      }

      if (isExempted !== undefined) {
        paramCount++;
        updateFields.push(`is_exempted = $${paramCount}`);
        params.push(isExempted);
      }

      if (updateFields.length === 0) {
        return grade; // No updates
      }

      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      params.push(new Date());

      paramCount++;
      params.push(gradeId);

      const result = await query(`
        UPDATE grades 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Grade not found');
      }

      const updatedGrade = result.rows[0];

      // Log grade update
      await this.logActivity(gradeId, 'GRADE_UPDATED', {
        updatedBy,
        updateData
      });

      return updatedGrade;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update grade');
    }
  }

  // Submit grade for approval
  static async submitForApproval(gradeId, submittedBy) {
    try {
      const grade = await this.findById(gradeId);
      
      if (grade.status !== 'draft') {
        throw new ValidationError('Only draft grades can be submitted for approval');
      }

      const result = await query(`
        UPDATE grades 
        SET status = 'submitted', submitted_by = $1, submitted_at = NOW(), updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [submittedBy, gradeId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Grade not found');
      }

      // Log submission
      await this.logActivity(gradeId, 'GRADE_SUBMITTED', {
        submittedBy
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to submit grade for approval');
    }
  }

  // Approve grade
  static async approve(gradeId, approvedBy) {
    try {
      const grade = await this.findById(gradeId);
      
      if (grade.status !== 'submitted') {
        throw new ValidationError('Only submitted grades can be approved');
      }

      const result = await query(`
        UPDATE grades 
        SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [approvedBy, gradeId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Grade not found');
      }

      // Log approval
      await this.logActivity(gradeId, 'GRADE_APPROVED', {
        approvedBy
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to approve grade');
    }
  }

  // Reject grade
  static async reject(gradeId, rejectedBy, rejectionReason) {
    try {
      const grade = await this.findById(gradeId);
      
      if (grade.status !== 'submitted') {
        throw new ValidationError('Only submitted grades can be rejected');
      }

      const result = await query(`
        UPDATE grades 
        SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [rejectionReason, gradeId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Grade not found');
      }

      // Log rejection
      await this.logActivity(gradeId, 'GRADE_REJECTED', {
        rejectedBy,
        rejectionReason
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to reject grade');
    }
  }

  // Get pending approval grades
  static async getPendingApproval(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          g.*,
          a.title as assessment_title,
          a.total_marks,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number,
          sb.first_name || ' ' || sb.last_name as submitted_by_name,
          gc.name as category_name
        FROM grades g
        JOIN assessments a ON g.assessment_id = a.id
        JOIN students st ON g.student_id = st.id
        JOIN users sb ON g.submitted_by = sb.id
        JOIN grade_categories gc ON a.category_id = gc.id
        WHERE g.school_id = $1 AND g.status = 'submitted'
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      // Apply filters
      if (filters.assessmentId) {
        paramCount++;
        sql += ` AND g.assessment_id = $${paramCount}`;
        params.push(filters.assessmentId);
      }

      if (filters.submittedBy) {
        paramCount++;
        sql += ` AND g.submitted_by = $${paramCount}`;
        params.push(filters.submittedBy);
      }

      // Add ordering
      sql += ` ORDER BY g.submitted_at ASC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get pending approval grades');
    }
  }

  // Get grade statistics for a student
  static async getStudentStatistics(studentId, filters = {}) {
    try {
      let sql = `
        SELECT 
          COUNT(g.id) as total_grades,
          COUNT(g.id) FILTER (WHERE g.status = 'approved') as approved_grades,
          COUNT(g.id) FILTER (WHERE g.status = 'draft') as draft_grades,
          COUNT(g.id) FILTER (WHERE g.status = 'submitted') as submitted_grades,
          AVG(g.marks_obtained) as average_marks,
          MIN(g.marks_obtained) as lowest_marks,
          MAX(g.marks_obtained) as highest_marks,
          COUNT(g.id) FILTER (WHERE g.is_absent = true) as absent_count,
          COUNT(g.id) FILTER (WHERE g.is_exempted = true) as exempted_count
        FROM grades g
        JOIN assessments a ON g.assessment_id = a.id
        WHERE g.student_id = $1
      `;
      
      const params = [studentId];

      if (filters.startDate) {
        sql += ' AND a.assessment_date >= $2';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND a.assessment_date <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get student grade statistics');
    }
  }

  // Calculate letter grade based on percentage
  static calculateLetterGrade(percentage, gradingScale) {
    if (!gradingScale || !gradingScale.grade_boundaries) {
      return null;
    }

    const boundaries = gradingScale.grade_boundaries;
    
    for (const boundary of boundaries) {
      if (percentage >= boundary.min && percentage <= boundary.max) {
        return {
          grade: boundary.grade,
          points: boundary.points,
          description: boundary.description
        };
      }
    }

    return null;
  }

  // Log grade activity
  static async logActivity(gradeId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.submittedBy || details.approvedBy || details.rejectedBy,
        action,
        'grades',
        gradeId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log grade activity:', error);
    }
  }

  // Validate grade data
  static validateGradeData(gradeData) {
    const errors = [];

    if (!gradeData.schoolId) {
      errors.push('School ID is required');
    }

    if (!gradeData.assessmentId) {
      errors.push('Assessment ID is required');
    }

    if (!gradeData.studentId) {
      errors.push('Student ID is required');
    }

    if (gradeData.marksObtained !== undefined && gradeData.marksObtained < 0) {
      errors.push('Marks cannot be negative');
    }

    return errors;
  }
}

module.exports = Grade; 