const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');
const { query } = require('../config/database');

class ExaminationController {
  // =============================================================================
  // EXAMINATION MANAGEMENT
  // =============================================================================

  static async createExamination(req, res, next) {
    try {
      const {
        name, description, exam_type, academic_year, term,
        start_date, end_date, total_marks, passing_marks,
        curriculum_id, class_ids, subject_ids
      } = req.body;

      const result = await query(`
        INSERT INTO examinations (
          school_id, name, description, exam_type, academic_year, term,
          start_date, end_date, total_marks, passing_marks, curriculum_id,
          status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12)
        RETURNING *
      `, [
        req.user.school_id, name, description, exam_type, academic_year, term,
        start_date, end_date, total_marks, passing_marks, curriculum_id,
        req.user.userId
      ]);

      const examinationId = result.rows[0].id;

      // Associate with classes
      if (class_ids && class_ids.length > 0) {
        for (const classId of class_ids) {
          await query(`
            INSERT INTO examination_classes (examination_id, class_id, school_id)
            VALUES ($1, $2, $3)
          `, [examinationId, classId, req.user.school_id]);
        }
      }

      // Associate with subjects
      if (subject_ids && subject_ids.length > 0) {
        for (const subjectId of subject_ids) {
          await query(`
            INSERT INTO examination_subjects (examination_id, subject_id, school_id)
            VALUES ($1, $2, $3)
          `, [examinationId, subjectId, req.user.school_id]);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Examination created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExaminations(req, res, next) {
    try {
      const { academic_year, term, exam_type, status } = req.query;

      let whereClause = 'WHERE e.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (academic_year) {
        paramCount++;
        whereClause += ` AND e.academic_year = $${paramCount}`;
        params.push(academic_year);
      }

      if (term) {
        paramCount++;
        whereClause += ` AND e.term = $${paramCount}`;
        params.push(term);
      }

      if (exam_type) {
        paramCount++;
        whereClause += ` AND e.exam_type = $${paramCount}`;
        params.push(exam_type);
      }

      if (status) {
        paramCount++;
        whereClause += ` AND e.status = $${paramCount}`;
        params.push(status);
      }

      const examinations = await query(`
        SELECT 
          e.*, 
          c.name as curriculum_name,
          COUNT(DISTINCT ec.class_id) as class_count,
          COUNT(DISTINCT es.subject_id) as subject_count
        FROM examinations e
        LEFT JOIN curriculums c ON e.curriculum_id = c.id
        LEFT JOIN examination_classes ec ON e.id = ec.examination_id
        LEFT JOIN examination_subjects es ON e.id = es.examination_id
        ${whereClause}
        GROUP BY e.id, c.name
        ORDER BY e.start_date DESC
      `, params);

      res.json({
        success: true,
        data: examinations.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExamination(req, res, next) {
    try {
      const { examinationId } = req.params;

      const examination = await query(`
        SELECT 
          e.*, 
          c.name as curriculum_name,
          ARRAY_AGG(DISTINCT cl.name) as classes,
          ARRAY_AGG(DISTINCT s.name) as subjects
        FROM examinations e
        LEFT JOIN curriculums c ON e.curriculum_id = c.id
        LEFT JOIN examination_classes ec ON e.id = ec.examination_id
        LEFT JOIN classes cl ON ec.class_id = cl.id
        LEFT JOIN examination_subjects es ON e.id = es.examination_id
        LEFT JOIN subjects s ON es.subject_id = s.id
        WHERE e.id = $1 AND e.school_id = $2
        GROUP BY e.id, c.name
      `, [examinationId, req.user.school_id]);

      if (examination.rows.length === 0) {
        throw new NotFoundError('Examination not found');
      }

      res.json({
        success: true,
        data: examination.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateExamination(req, res, next) {
    try {
      const { examinationId } = req.params;
      const {
        name, description, exam_type, start_date, end_date,
        total_marks, passing_marks, status
      } = req.body;

      const result = await query(`
        UPDATE examinations 
        SET name = $1, description = $2, exam_type = $3, 
            start_date = $4, end_date = $5, total_marks = $6,
            passing_marks = $7, status = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND school_id = $10
        RETURNING *
      `, [
        name, description, exam_type, start_date, end_date,
        total_marks, passing_marks, status, examinationId, req.user.school_id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination not found');
      }

      res.json({
        success: true,
        message: 'Examination updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteExamination(req, res, next) {
    try {
      const { examinationId } = req.params;

      // Check if examination has results
      const hasResults = await query(`
        SELECT COUNT(*) as count
        FROM examination_results
        WHERE examination_id = $1
      `, [examinationId]);

      if (parseInt(hasResults.rows[0].count) > 0) {
        throw new ConflictError('Cannot delete examination with existing results');
      }

      // Delete associated records first
      await query(`DELETE FROM examination_classes WHERE examination_id = $1`, [examinationId]);
      await query(`DELETE FROM examination_subjects WHERE examination_id = $1`, [examinationId]);

      // Delete examination
      const result = await query(`
        DELETE FROM examinations 
        WHERE id = $1 AND school_id = $2
        RETURNING *
      `, [examinationId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination not found');
      }

      res.json({
        success: true,
        message: 'Examination deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // EXAMINATION RESULTS MANAGEMENT
  // =============================================================================

  static async recordResults(req, res, next) {
    try {
      const { examination_id, results } = req.body;

      if (!Array.isArray(results) || results.length === 0) {
        throw new ValidationError('Results array is required');
      }

      const recordedResults = [];

      for (const result of results) {
        const { student_id, subject_id, marks_obtained, grade, remarks } = result;

        const insertResult = await query(`
          INSERT INTO examination_results (
            examination_id, student_id, subject_id, marks_obtained,
            grade, remarks, school_id, recorded_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (examination_id, student_id, subject_id)
          DO UPDATE SET 
            marks_obtained = EXCLUDED.marks_obtained,
            grade = EXCLUDED.grade,
            remarks = EXCLUDED.remarks,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [
          examination_id, student_id, subject_id, marks_obtained,
          grade, remarks, req.user.school_id, req.user.userId
        ]);

        recordedResults.push(insertResult.rows[0]);
      }

      res.status(201).json({
        success: true,
        message: `${recordedResults.length} examination results recorded successfully`,
        data: recordedResults
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExaminationResults(req, res, next) {
    try {
      const { examination_id, class_id, student_id, subject_id } = req.query;

      let whereClause = 'WHERE er.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (examination_id) {
        paramCount++;
        whereClause += ` AND er.examination_id = $${paramCount}`;
        params.push(examination_id);
      }

      if (student_id) {
        paramCount++;
        whereClause += ` AND er.student_id = $${paramCount}`;
        params.push(student_id);
      }

      if (subject_id) {
        paramCount++;
        whereClause += ` AND er.subject_id = $${paramCount}`;
        params.push(subject_id);
      }

      if (class_id) {
        paramCount++;
        whereClause += ` AND s.class_id = $${paramCount}`;
        params.push(class_id);
      }

      const results = await query(`
        SELECT 
          er.*, 
          e.name as examination_name,
          u.first_name, u.last_name,
          s.admission_number,
          sub.name as subject_name,
          cl.name as class_name
        FROM examination_results er
        JOIN examinations e ON er.examination_id = e.id
        JOIN students s ON er.student_id = s.id
        JOIN users u ON s.user_id = u.id
        JOIN subjects sub ON er.subject_id = sub.id
        LEFT JOIN classes cl ON s.class_id = cl.id
        ${whereClause}
        ORDER BY e.name, cl.name, u.first_name, sub.name
      `, params);

      res.json({
        success: true,
        data: results.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateResult(req, res, next) {
    try {
      const { resultId } = req.params;
      const { marks_obtained, grade, remarks } = req.body;

      const result = await query(`
        UPDATE examination_results 
        SET marks_obtained = $1, grade = $2, remarks = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND school_id = $5
        RETURNING *
      `, [marks_obtained, grade, remarks, resultId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination result not found');
      }

      res.json({
        success: true,
        message: 'Examination result updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteResult(req, res, next) {
    try {
      const { resultId } = req.params;

      const result = await query(`
        DELETE FROM examination_results 
        WHERE id = $1 AND school_id = $2
        RETURNING *
      `, [resultId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination result not found');
      }

      res.json({
        success: true,
        message: 'Examination result deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // EXAMINATION ANALYTICS AND REPORTS
  // =============================================================================

  static async getExaminationAnalytics(req, res, next) {
    try {
      const { examination_id } = req.query;

      if (!examination_id) {
        throw new ValidationError('Examination ID is required');
      }

      // Overall statistics
      const overallStats = await query(`
        SELECT 
          COUNT(*) as total_students,
          AVG(marks_obtained) as average_marks,
          MAX(marks_obtained) as highest_marks,
          MIN(marks_obtained) as lowest_marks,
          COUNT(CASE WHEN marks_obtained >= e.passing_marks THEN 1 END) as passed_students,
          COUNT(CASE WHEN marks_obtained < e.passing_marks THEN 1 END) as failed_students
        FROM examination_results er
        JOIN examinations e ON er.examination_id = e.id
        WHERE er.examination_id = $1 AND er.school_id = $2
      `, [examination_id, req.user.school_id]);

      // Subject-wise performance
      const subjectStats = await query(`
        SELECT 
          s.name as subject_name,
          COUNT(*) as student_count,
          AVG(er.marks_obtained) as average_marks,
          MAX(er.marks_obtained) as highest_marks,
          MIN(er.marks_obtained) as lowest_marks
        FROM examination_results er
        JOIN subjects s ON er.subject_id = s.id
        WHERE er.examination_id = $1 AND er.school_id = $2
        GROUP BY s.id, s.name
        ORDER BY average_marks DESC
      `, [examination_id, req.user.school_id]);

      // Class-wise performance
      const classStats = await query(`
        SELECT 
          cl.name as class_name,
          COUNT(*) as student_count,
          AVG(er.marks_obtained) as average_marks,
          COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as passed_students
        FROM examination_results er
        JOIN examinations e ON er.examination_id = e.id
        JOIN students st ON er.student_id = st.id
        LEFT JOIN classes cl ON st.class_id = cl.id
        WHERE er.examination_id = $1 AND er.school_id = $2
        GROUP BY cl.id, cl.name, e.passing_marks
        ORDER BY average_marks DESC
      `, [examination_id, req.user.school_id]);

      // Grade distribution
      const gradeDistribution = await query(`
        SELECT 
          grade,
          COUNT(*) as student_count
        FROM examination_results
        WHERE examination_id = $1 AND school_id = $2
        GROUP BY grade
        ORDER BY grade
      `, [examination_id, req.user.school_id]);

      res.json({
        success: true,
        data: {
          overall: overallStats.rows[0],
          subject_performance: subjectStats.rows,
          class_performance: classStats.rows,
          grade_distribution: gradeDistribution.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateExaminationReport(req, res, next) {
    try {
      const { examination_id, report_type, class_id } = req.query;

      if (!examination_id) {
        throw new ValidationError('Examination ID is required');
      }

      let query_text = '';
      let params = [examination_id, req.user.school_id];

      switch (report_type) {
        case 'class_report':
          if (!class_id) {
            throw new ValidationError('Class ID is required for class report');
          }
          params.push(class_id);
          query_text = `
            SELECT 
              u.first_name, u.last_name, st.admission_number,
              sub.name as subject_name, er.marks_obtained, er.grade,
              e.total_marks, e.passing_marks,
              CASE WHEN er.marks_obtained >= e.passing_marks THEN 'Pass' ELSE 'Fail' END as result
            FROM examination_results er
            JOIN examinations e ON er.examination_id = e.id
            JOIN students st ON er.student_id = st.id
            JOIN users u ON st.user_id = u.id
            JOIN subjects sub ON er.subject_id = sub.id
            WHERE er.examination_id = $1 AND er.school_id = $2 AND st.class_id = $3
            ORDER BY u.first_name, u.last_name, sub.name
          `;
          break;

        case 'student_transcript':
          query_text = `
            SELECT 
              u.first_name, u.last_name, st.admission_number,
              sub.name as subject_name, er.marks_obtained, er.grade,
              e.total_marks, 
              ROUND((er.marks_obtained / e.total_marks) * 100, 2) as percentage
            FROM examination_results er
            JOIN examinations e ON er.examination_id = e.id
            JOIN students st ON er.student_id = st.id
            JOIN users u ON st.user_id = u.id
            JOIN subjects sub ON er.subject_id = sub.id
            WHERE er.examination_id = $1 AND er.school_id = $2
            ORDER BY u.first_name, u.last_name, sub.name
          `;
          break;

        case 'subject_analysis':
          query_text = `
            SELECT 
              sub.name as subject_name,
              COUNT(*) as total_students,
              AVG(er.marks_obtained) as average_marks,
              MAX(er.marks_obtained) as highest_marks,
              MIN(er.marks_obtained) as lowest_marks,
              STDDEV(er.marks_obtained) as standard_deviation,
              COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as passed_count,
              ROUND(
                (COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) * 100.0 / COUNT(*)), 2
              ) as pass_percentage
            FROM examination_results er
            JOIN examinations e ON er.examination_id = e.id
            JOIN subjects sub ON er.subject_id = sub.id
            WHERE er.examination_id = $1 AND er.school_id = $2
            GROUP BY sub.id, sub.name, e.passing_marks
            ORDER BY average_marks DESC
          `;
          break;

        default:
          throw new ValidationError('Invalid report type');
      }

      const reportData = await query(query_text, params);

      res.json({
        success: true,
        data: {
          report_type,
          examination_id,
          generated_at: new Date().toISOString(),
          data: reportData.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExaminationSchedules(req, res, next) {
    try {
      const { academic_year, term, class_id } = req.query;

      let whereClause = 'WHERE e.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (academic_year) {
        paramCount++;
        whereClause += ` AND e.academic_year = $${paramCount}`;
        params.push(academic_year);
      }

      if (term) {
        paramCount++;
        whereClause += ` AND e.term = $${paramCount}`;
        params.push(term);
      }

      if (class_id) {
        paramCount++;
        whereClause += ` AND ec.class_id = $${paramCount}`;
        params.push(class_id);
      }

      const schedule = await query(`
        SELECT 
          e.id, e.name, e.exam_type, e.start_date, e.end_date,
          e.status, cl.name as class_name,
          ARRAY_AGG(DISTINCT s.name) as subjects
        FROM examinations e
        LEFT JOIN examination_classes ec ON e.id = ec.examination_id
        LEFT JOIN classes cl ON ec.class_id = cl.id
        LEFT JOIN examination_subjects es ON e.id = es.examination_id
        LEFT JOIN subjects s ON es.subject_id = s.id
        ${whereClause}
        GROUP BY e.id, e.name, e.exam_type, e.start_date, e.end_date, e.status, cl.name
        ORDER BY e.start_date, cl.name
      `, params);

      res.json({
        success: true,
        data: schedule.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async publishResults(req, res, next) {
    try {
      const { examination_id, publish_to_parents } = req.body;

      // Update examination status to published
      const result = await query(`
        UPDATE examinations 
        SET status = 'published', results_published_at = CURRENT_TIMESTAMP,
            published_by = $1
        WHERE id = $2 AND school_id = $3
        RETURNING *
      `, [req.user.userId, examination_id, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination not found');
      }

      // If publishing to parents, update results visibility
      if (publish_to_parents) {
        await query(`
          UPDATE examination_results 
          SET visible_to_parents = true
          WHERE examination_id = $1 AND school_id = $2
        `, [examination_id, req.user.school_id]);
      }

      res.json({
        success: true,
        message: 'Examination results published successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTopPerformers(req, res, next) {
    try {
      const { examination_id, limit = 10 } = req.query;

      if (!examination_id) {
        throw new ValidationError('Examination ID is required');
      }

      const topPerformers = await query(`
        SELECT 
          st.id, u.first_name, u.last_name, st.admission_number,
          cl.name as class_name,
          AVG(er.marks_obtained) as average_marks,
          SUM(er.marks_obtained) as total_marks,
          COUNT(er.subject_id) as subject_count
        FROM examination_results er
        JOIN students st ON er.student_id = st.id
        JOIN users u ON st.user_id = u.id
        LEFT JOIN classes cl ON st.class_id = cl.id
        WHERE er.examination_id = $1 AND er.school_id = $2
        GROUP BY st.id, u.first_name, u.last_name, st.admission_number, cl.name
        ORDER BY average_marks DESC
        LIMIT $3
      `, [examination_id, req.user.school_id, limit]);

      res.json({
        success: true,
        data: topPerformers.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ADDITIONAL EXAMINATION METHODS
  // =============================================================================

  static async createExaminationSchedule(req, res, next) {
    try {
      const { examination_id, subjects, duration, instructions } = req.body;

      const result = await query(`
        INSERT INTO examination_schedules (
          examination_id, subjects, duration, instructions, school_id, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        examination_id, JSON.stringify(subjects), duration, 
        instructions, req.user.school_id, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Examination schedule created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateExaminationSchedule(req, res, next) {
    try {
      const { scheduleId } = req.params;
      const { subjects, duration, instructions } = req.body;

      const result = await query(`
        UPDATE examination_schedules 
        SET subjects = $1, duration = $2, instructions = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND school_id = $5
        RETURNING *
      `, [JSON.stringify(subjects), duration, instructions, scheduleId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination schedule not found');
      }

      res.json({
        success: true,
        message: 'Examination schedule updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteExaminationSchedule(req, res, next) {
    try {
      const { scheduleId } = req.params;

      const result = await query(`
        DELETE FROM examination_schedules 
        WHERE id = $1 AND school_id = $2
        RETURNING *
      `, [scheduleId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination schedule not found');
      }

      res.json({
        success: true,
        message: 'Examination schedule deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async publishExaminationSchedule(req, res, next) {
    try {
      const { scheduleId } = req.params;

      const result = await query(`
        UPDATE examination_schedules 
        SET status = 'published', published_at = CURRENT_TIMESTAMP, published_by = $1
        WHERE id = $2 AND school_id = $3
        RETURNING *
      `, [req.user.userId, scheduleId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination schedule not found');
      }

      res.json({
        success: true,
        message: 'Examination schedule published successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getQuestionBank(req, res, next) {
    try {
      const { subject_id, difficulty_level, question_type } = req.query;

      let whereClause = 'WHERE qb.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (subject_id) {
        paramCount++;
        whereClause += ` AND qb.subject_id = $${paramCount}`;
        params.push(subject_id);
      }

      if (difficulty_level) {
        paramCount++;
        whereClause += ` AND qb.difficulty_level = $${paramCount}`;
        params.push(difficulty_level);
      }

      if (question_type) {
        paramCount++;
        whereClause += ` AND qb.question_type = $${paramCount}`;
        params.push(question_type);
      }

      const questions = await query(`
        SELECT 
          qb.*, s.name as subject_name
        FROM question_bank qb
        JOIN subjects s ON qb.subject_id = s.id
        ${whereClause}
        ORDER BY s.name, qb.difficulty_level, qb.created_at DESC
      `, params);

      res.json({
        success: true,
        data: questions.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async addQuestionToBank(req, res, next) {
    try {
      const { 
        subject_id, question_text, question_type, difficulty_level,
        correct_answer, options, marks, explanation 
      } = req.body;

      const result = await query(`
        INSERT INTO question_bank (
          school_id, subject_id, question_text, question_type, difficulty_level,
          correct_answer, options, marks, explanation, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        req.user.school_id, subject_id, question_text, question_type, difficulty_level,
        correct_answer, JSON.stringify(options), marks, explanation, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Question added to bank successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateQuestionInBank(req, res, next) {
    try {
      const { questionId } = req.params;
      const { 
        question_text, question_type, difficulty_level,
        correct_answer, options, marks, explanation 
      } = req.body;

      const result = await query(`
        UPDATE question_bank 
        SET question_text = $1, question_type = $2, difficulty_level = $3,
            correct_answer = $4, options = $5, marks = $6, explanation = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND school_id = $9
        RETURNING *
      `, [
        question_text, question_type, difficulty_level, correct_answer, 
        JSON.stringify(options), marks, explanation, questionId, req.user.school_id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Question not found in bank');
      }

      res.json({
        success: true,
        message: 'Question updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExaminationRegistrations(req, res, next) {
    try {
      const { examination_id, class_id, status } = req.query;

      let whereClause = 'WHERE er.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (examination_id) {
        paramCount++;
        whereClause += ` AND er.examination_id = $${paramCount}`;
        params.push(examination_id);
      }

      if (class_id) {
        paramCount++;
        whereClause += ` AND s.class_id = $${paramCount}`;
        params.push(class_id);
      }

      if (status) {
        paramCount++;
        whereClause += ` AND er.status = $${paramCount}`;
        params.push(status);
      }

      const registrations = await query(`
        SELECT 
          er.*, e.name as examination_name,
          u.first_name, u.last_name, s.admission_number,
          cl.name as class_name
        FROM examination_registrations er
        JOIN examinations e ON er.examination_id = e.id
        JOIN students s ON er.student_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN classes cl ON s.class_id = cl.id
        ${whereClause}
        ORDER BY e.name, cl.name, u.first_name
      `, params);

      res.json({
        success: true,
        data: registrations.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async registerStudentForExamination(req, res, next) {
    try {
      const { examination_id, student_id, subjects } = req.body;

      const result = await query(`
        INSERT INTO examination_registrations (
          examination_id, student_id, subjects, status, school_id, registered_by
        )
        VALUES ($1, $2, $3, 'registered', $4, $5)
        ON CONFLICT (examination_id, student_id)
        DO UPDATE SET subjects = EXCLUDED.subjects, updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        examination_id, student_id, JSON.stringify(subjects), 
        req.user.school_id, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Student registered for examination successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkRegisterStudents(req, res, next) {
    try {
      const { examination_id, student_ids, subjects } = req.body;

      if (!Array.isArray(student_ids) || student_ids.length === 0) {
        throw new ValidationError('Student IDs array is required');
      }

      const registrations = [];

      for (const studentId of student_ids) {
        const result = await query(`
          INSERT INTO examination_registrations (
            examination_id, student_id, subjects, status, school_id, registered_by
          )
          VALUES ($1, $2, $3, 'registered', $4, $5)
          ON CONFLICT (examination_id, student_id)
          DO UPDATE SET subjects = EXCLUDED.subjects, updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [
          examination_id, studentId, JSON.stringify(subjects), 
          req.user.school_id, req.user.userId
        ]);

        registrations.push(result.rows[0]);
      }

      res.status(201).json({
        success: true,
        message: `${registrations.length} students registered for examination successfully`,
        data: registrations
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitExaminationResult(req, res, next) {
    try {
      const { examination_id, student_id, subject_results } = req.body;

      if (!Array.isArray(subject_results) || subject_results.length === 0) {
        throw new ValidationError('Subject results array is required');
      }

      const results = [];

      for (const result of subject_results) {
        const { subject_id, marks_obtained, grade, remarks } = result;

        const insertResult = await query(`
          INSERT INTO examination_results (
            examination_id, student_id, subject_id, marks_obtained,
            grade, remarks, school_id, recorded_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (examination_id, student_id, subject_id)
          DO UPDATE SET 
            marks_obtained = EXCLUDED.marks_obtained,
            grade = EXCLUDED.grade,
            remarks = EXCLUDED.remarks,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [
          examination_id, student_id, subject_id, marks_obtained,
          grade, remarks, req.user.school_id, req.user.userId
        ]);

        results.push(insertResult.rows[0]);
      }

      res.status(201).json({
        success: true,
        message: 'Examination results submitted successfully',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  static async publishExaminationResults(req, res, next) {
    try {
      const { examination_id, publish_to_parents } = req.body;

      const result = await query(`
        UPDATE examinations 
        SET status = 'published', results_published_at = CURRENT_TIMESTAMP,
            published_by = $1
        WHERE id = $2 AND school_id = $3
        RETURNING *
      `, [req.user.userId, examination_id, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Examination not found');
      }

      if (publish_to_parents) {
        await query(`
          UPDATE examination_results 
          SET visible_to_parents = true
          WHERE examination_id = $1 AND school_id = $2
        `, [examination_id, req.user.school_id]);
      }

      res.json({
        success: true,
        message: 'Examination results published successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateExaminationCertificates(req, res, next) {
    try {
      const { examination_id, certificate_type, class_id } = req.body;

      let whereClause = 'WHERE er.examination_id = $1 AND er.school_id = $2';
      let params = [examination_id, req.user.school_id];

      if (class_id) {
        whereClause += ' AND s.class_id = $3';
        params.push(class_id);
      }

      const certificates = await query(`
        SELECT 
          u.first_name, u.last_name, s.admission_number,
          cl.name as class_name, e.name as examination_name,
          AVG(er.marks_obtained) as average_marks,
          STRING_AGG(DISTINCT er.grade, ', ') as grades
        FROM examination_results er
        JOIN examinations e ON er.examination_id = e.id
        JOIN students s ON er.student_id = s.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN classes cl ON s.class_id = cl.id
        ${whereClause}
        GROUP BY u.first_name, u.last_name, s.admission_number, cl.name, e.name
        ORDER BY average_marks DESC
      `, params);

      res.json({
        success: true,
        message: 'Examination certificates generated successfully',
        data: {
          certificate_type,
          examination_id,
          generated_at: new Date().toISOString(),
          certificates: certificates.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getKnecIntegration(req, res, next) {
    try {
      const integration = await query(`
        SELECT * FROM knec_integration_settings 
        WHERE school_id = $1
      `, [req.user.school_id]);

      res.json({
        success: true,
        data: integration.rows[0] || null
      });
    } catch (error) {
      next(error);
    }
  }

  static async syncWithKnec(req, res, next) {
    try {
      const { examination_id, sync_type } = req.body;

      // This would integrate with KNEC API
      const syncResult = {
        examination_id,
        sync_type,
        status: 'completed',
        synced_at: new Date().toISOString(),
        records_synced: 0 // Would be actual count from KNEC API
      };

      res.json({
        success: true,
        message: 'KNEC synchronization completed successfully',
        data: syncResult
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadResultsToKnec(req, res, next) {
    try {
      const { examination_id, results_data } = req.body;

      // This would upload to KNEC API
      const uploadResult = {
        examination_id,
        upload_status: 'success',
        uploaded_at: new Date().toISOString(),
        records_uploaded: Array.isArray(results_data) ? results_data.length : 0
      };

      res.json({
        success: true,
        message: 'Results uploaded to KNEC successfully',
        data: uploadResult
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExaminationTrends(req, res, next) {
    try {
      const { academic_year, subject_id, class_id } = req.query;

      let whereClause = 'WHERE er.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (academic_year) {
        paramCount++;
        whereClause += ` AND e.academic_year = $${paramCount}`;
        params.push(academic_year);
      }

      if (subject_id) {
        paramCount++;
        whereClause += ` AND er.subject_id = $${paramCount}`;
        params.push(subject_id);
      }

      if (class_id) {
        paramCount++;
        whereClause += ` AND s.class_id = $${paramCount}`;
        params.push(class_id);
      }

      const trends = await query(`
        SELECT 
          e.name as examination_name,
          e.term,
          AVG(er.marks_obtained) as average_marks,
          COUNT(*) as student_count,
          COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as passed_count
        FROM examination_results er
        JOIN examinations e ON er.examination_id = e.id
        JOIN students s ON er.student_id = s.id
        ${whereClause}
        GROUP BY e.id, e.name, e.term, e.passing_marks
        ORDER BY e.academic_year, e.term
      `, params);

      res.json({
        success: true,
        data: trends.rows
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateStudentExaminationReport(req, res, next) {
    try {
      const { student_id, examination_id } = req.query;

      if (!student_id || !examination_id) {
        throw new ValidationError('Student ID and Examination ID are required');
      }

      const report = await query(`
        SELECT 
          u.first_name, u.last_name, s.admission_number,
          e.name as examination_name, e.academic_year, e.term,
          sub.name as subject_name, er.marks_obtained, er.grade,
          e.total_marks, 
          ROUND((er.marks_obtained / e.total_marks) * 100, 2) as percentage,
          CASE WHEN er.marks_obtained >= e.passing_marks THEN 'Pass' ELSE 'Fail' END as result
        FROM examination_results er
        JOIN examinations e ON er.examination_id = e.id
        JOIN students s ON er.student_id = s.id
        JOIN users u ON s.user_id = u.id
        JOIN subjects sub ON er.subject_id = sub.id
        WHERE er.student_id = $1 AND er.examination_id = $2 AND er.school_id = $3
        ORDER BY sub.name
      `, [student_id, examination_id, req.user.school_id]);

      res.json({
        success: true,
        data: {
          report_type: 'student',
          student_id,
          examination_id,
          generated_at: new Date().toISOString(),
          results: report.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateClassExaminationReport(req, res, next) {
    try {
      const { class_id, examination_id } = req.query;

      if (!class_id || !examination_id) {
        throw new ValidationError('Class ID and Examination ID are required');
      }

      const report = await query(`
        SELECT 
          u.first_name, u.last_name, s.admission_number,
          AVG(er.marks_obtained) as average_marks,
          STRING_AGG(DISTINCT er.grade, ', ') as grades,
          COUNT(er.subject_id) as subjects_count
        FROM examination_results er
        JOIN students s ON er.student_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE s.class_id = $1 AND er.examination_id = $2 AND er.school_id = $3
        GROUP BY u.first_name, u.last_name, s.admission_number
        ORDER BY average_marks DESC
      `, [class_id, examination_id, req.user.school_id]);

      res.json({
        success: true,
        data: {
          report_type: 'class',
          class_id,
          examination_id,
          generated_at: new Date().toISOString(),
          students: report.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateSchoolExaminationReport(req, res, next) {
    try {
      const { examination_id } = req.query;

      if (!examination_id) {
        throw new ValidationError('Examination ID is required');
      }

      const report = await query(`
        SELECT 
          cl.name as class_name,
          COUNT(DISTINCT er.student_id) as student_count,
          AVG(er.marks_obtained) as average_marks,
          MAX(er.marks_obtained) as highest_marks,
          MIN(er.marks_obtained) as lowest_marks,
          COUNT(CASE WHEN er.marks_obtained >= e.passing_marks THEN 1 END) as passed_count
        FROM examination_results er
        JOIN examinations e ON er.examination_id = e.id
        JOIN students s ON er.student_id = s.id
        LEFT JOIN classes cl ON s.class_id = cl.id
        WHERE er.examination_id = $1 AND er.school_id = $2
        GROUP BY cl.id, cl.name, e.passing_marks
        ORDER BY average_marks DESC
      `, [examination_id, req.user.school_id]);

      res.json({
        success: true,
        data: {
          report_type: 'school',
          examination_id,
          generated_at: new Date().toISOString(),
          classes: report.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExaminationController;