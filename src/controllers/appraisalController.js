const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class AppraisalController {
  // =============================================================================
  // APPRAISAL CYCLE MANAGEMENT
  // =============================================================================

  // Create appraisal cycle
  static async createCycle(req, res, next) {
    try {
      const {
        cycleName,
        description,
        academicYearId,
        startDate,
        endDate,
        selfReviewDeadline,
        managerReviewDeadline,
        finalReviewDeadline,
        sendReminders = true,
        reminderFrequencyDays = 7
      } = req.body;

      if (!cycleName || !startDate || !endDate) {
        throw new ValidationError('Cycle name, start date, and end date are required');
      }

      const result = await query(`
        INSERT INTO appraisal_cycles (
          school_id, cycle_name, description, academic_year_id,
          start_date, end_date, self_review_deadline, manager_review_deadline,
          final_review_deadline, send_reminders, reminder_frequency_days, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        req.user.schoolId, cycleName, description, academicYearId,
        startDate, endDate, selfReviewDeadline, managerReviewDeadline,
        finalReviewDeadline, sendReminders, reminderFrequencyDays, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Appraisal cycle created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        next(new ConflictError('Appraisal cycle name already exists for this academic year'));
      } else {
        next(error);
      }
    }
  }

  // Get appraisal cycles
  static async getCycles(req, res, next) {
    try {
      const { academicYearId, status, limit = 20, offset = 0 } = req.query;

      let whereClause = 'WHERE school_id = $1';
      const params = [req.user.schoolId];

      if (academicYearId) {
        whereClause += ` AND academic_year_id = $${params.length + 1}`;
        params.push(academicYearId);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          ac.*,
          ay.year_name,
          COUNT(a.id) as total_appraisals,
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appraisals
        FROM appraisal_cycles ac
        LEFT JOIN academic_years ay ON ac.academic_year_id = ay.id
        LEFT JOIN appraisals a ON ac.id = a.cycle_id
        ${whereClause}
        GROUP BY ac.id, ay.year_name
        ORDER BY ac.start_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get current active cycle
  static async getCurrentCycle(req, res, next) {
    try {
      const result = await query(`
        SELECT *
        FROM appraisal_cycles 
        WHERE school_id = $1 AND is_active = true AND status = 'active'
        ORDER BY start_date DESC
        LIMIT 1
      `, [req.user.schoolId]);

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: 'No active appraisal cycle found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Activate cycle
  static async activateCycle(req, res, next) {
    try {
      const { id } = req.params;

      // Deactivate other cycles first
      await query(`
        UPDATE appraisal_cycles 
        SET is_active = false 
        WHERE school_id = $1
      `, [req.user.schoolId]);

      // Activate selected cycle
      const result = await query(`
        UPDATE appraisal_cycles 
        SET is_active = true, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND school_id = $2
        RETURNING *
      `, [id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Appraisal cycle not found');
      }

      res.json({
        success: true,
        message: 'Appraisal cycle activated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // APPRAISAL TEMPLATE MANAGEMENT
  // =============================================================================

  // Create appraisal template
  static async createTemplate(req, res, next) {
    try {
      const {
        templateName,
        description,
        applicableRoles = [],
        includesSelfReview = true,
        includesManagerReview = true,
        includesPeerFeedback = false,
        includes360Feedback = false,
        scoringMethod = 'numeric',
        maxScore = 5.0,
        passingScore = 3.0,
        categories = []
      } = req.body;

      if (!templateName || !categories.length) {
        throw new ValidationError('Template name and categories are required');
      }

      // Create template
      const templateResult = await query(`
        INSERT INTO appraisal_templates (
          school_id, template_name, description, applicable_roles,
          includes_self_review, includes_manager_review, includes_peer_feedback,
          includes_360_feedback, scoring_method, max_score, passing_score, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        req.user.schoolId, templateName, description, JSON.stringify(applicableRoles),
        includesSelfReview, includesManagerReview, includesPeerFeedback,
        includes360Feedback, scoringMethod, maxScore, passingScore, req.user.userId
      ]);

      const template = templateResult.rows[0];

      // Create categories and questions
      for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex++) {
        const category = categories[categoryIndex];
        
        const categoryResult = await query(`
          INSERT INTO appraisal_categories (
            template_id, category_name, description, weight_percentage, display_order
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [
          template.id, category.categoryName, category.description,
          category.weightPercentage || 0, categoryIndex + 1
        ]);

        const categoryRecord = categoryResult.rows[0];

        // Create questions for this category
        if (category.questions && category.questions.length > 0) {
          for (let questionIndex = 0; questionIndex < category.questions.length; questionIndex++) {
            const question = category.questions[questionIndex];
            
            await query(`
              INSERT INTO appraisal_questions (
                category_id, question_text, question_type, is_required,
                max_score, weight_percentage, display_order, options, rating_labels
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              categoryRecord.id, question.questionText, question.questionType,
              question.isRequired !== false, question.maxScore || maxScore,
              question.weightPercentage || 0, questionIndex + 1,
              JSON.stringify(question.options || []),
              JSON.stringify(question.ratingLabels || {})
            ]);
          }
        }
      }

      res.status(201).json({
        success: true,
        message: 'Appraisal template created successfully',
        data: template
      });
    } catch (error) {
      next(error);
    }
  }

  // Get appraisal templates
  static async getTemplates(req, res, next) {
    try {
      const { isActive, isDefault } = req.query;

      let whereClause = 'WHERE at.school_id = $1';
      const params = [req.user.schoolId];

      if (isActive !== undefined) {
        whereClause += ` AND at.is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (isDefault !== undefined) {
        whereClause += ` AND at.is_default = $${params.length + 1}`;
        params.push(isDefault === 'true');
      }

      const result = await query(`
        SELECT 
          at.*,
          COUNT(ac.id) as categories_count,
          COUNT(aq.id) as questions_count
        FROM appraisal_templates at
        LEFT JOIN appraisal_categories ac ON at.id = ac.template_id
        LEFT JOIN appraisal_questions aq ON ac.id = aq.category_id
        ${whereClause}
        GROUP BY at.id
        ORDER BY at.is_default DESC, at.template_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Get template with categories and questions
  static async getTemplateDetails(req, res, next) {
    try {
      const { id } = req.params;

      const [templateResult, categoriesResult] = await Promise.all([
        query(`
          SELECT * FROM appraisal_templates 
          WHERE id = $1 AND school_id = $2
        `, [id, req.user.schoolId]),

        query(`
          SELECT 
            ac.*,
            COALESCE(
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', aq.id,
                  'questionText', aq.question_text,
                  'questionType', aq.question_type,
                  'isRequired', aq.is_required,
                  'maxScore', aq.max_score,
                  'weightPercentage', aq.weight_percentage,
                  'displayOrder', aq.display_order,
                  'options', aq.options,
                  'ratingLabels', aq.rating_labels
                ) ORDER BY aq.display_order
              ) FILTER (WHERE aq.id IS NOT NULL), '[]'
            ) as questions
          FROM appraisal_categories ac
          LEFT JOIN appraisal_questions aq ON ac.id = aq.category_id
          WHERE ac.template_id = $1
          GROUP BY ac.id
          ORDER BY ac.display_order
        `, [id])
      ]);

      if (templateResult.rows.length === 0) {
        throw new NotFoundError('Appraisal template not found');
      }

      const template = {
        ...templateResult.rows[0],
        categories: categoriesResult.rows
      };

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // APPRAISAL MANAGEMENT
  // =============================================================================

  // Initiate appraisal
  static async initiateAppraisal(req, res, next) {
    try {
      const {
        cycleId,
        templateId,
        employeeId,
        managerId,
        appraisalPeriodStart,
        appraisalPeriodEnd
      } = req.body;

      if (!cycleId || !templateId || !employeeId) {
        throw new ValidationError('Cycle ID, template ID, and employee ID are required');
      }

      // Check if appraisal already exists
      const existingResult = await query(`
        SELECT id FROM appraisals 
        WHERE cycle_id = $1 AND employee_id = $2
      `, [cycleId, employeeId]);

      if (existingResult.rows.length > 0) {
        throw new ConflictError('Appraisal already exists for this employee in this cycle');
      }

      const result = await query(`
        INSERT INTO appraisals (
          school_id, cycle_id, template_id, employee_id, manager_id,
          appraisal_period_start, appraisal_period_end, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        req.user.schoolId, cycleId, templateId, employeeId, managerId,
        appraisalPeriodStart, appraisalPeriodEnd, req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Appraisal initiated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get my appraisals (for current user)
  static async getMyAppraisals(req, res, next) {
    try {
      const { status, cycleId } = req.query;

      let whereClause = 'WHERE a.school_id = $1 AND a.employee_id = $2';
      const params = [req.user.schoolId, req.user.userId];

      if (status) {
        whereClause += ` AND a.status = $${params.length + 1}`;
        params.push(status);
      }

      if (cycleId) {
        whereClause += ` AND a.cycle_id = $${params.length + 1}`;
        params.push(cycleId);
      }

      const result = await query(`
        SELECT 
          a.*,
          ac.cycle_name,
          at.template_name,
          m.first_name as manager_first_name,
          m.last_name as manager_last_name
        FROM appraisals a
        JOIN appraisal_cycles ac ON a.cycle_id = ac.id
        JOIN appraisal_templates at ON a.template_id = at.id
        LEFT JOIN staff m ON a.manager_id = m.id
        ${whereClause}
        ORDER BY a.created_at DESC
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Submit self review
  static async submitSelfReview(req, res, next) {
    try {
      const { id } = req.params;
      const { responses, employeeComments } = req.body;

      if (!responses || !Array.isArray(responses)) {
        throw new ValidationError('Responses array is required');
      }

      // Verify appraisal belongs to current user
      const appraisalResult = await query(`
        SELECT * FROM appraisals 
        WHERE id = $1 AND employee_id = $2 AND school_id = $3
      `, [id, req.user.userId, req.user.schoolId]);

      if (appraisalResult.rows.length === 0) {
        throw new NotFoundError('Appraisal not found or access denied');
      }

      // Save responses
      for (const response of responses) {
        await query(`
          INSERT INTO appraisal_responses (
            appraisal_id, question_id, response_type, respondent_id,
            numeric_score, text_response, selected_option
          ) VALUES ($1, $2, 'self', $3, $4, $5, $6)
          ON CONFLICT (appraisal_id, question_id, response_type, respondent_id)
          DO UPDATE SET 
            numeric_score = EXCLUDED.numeric_score,
            text_response = EXCLUDED.text_response,
            selected_option = EXCLUDED.selected_option,
            submitted_at = CURRENT_TIMESTAMP
        `, [
          id, response.questionId, req.user.userId,
          response.numericScore, response.textResponse, response.selectedOption
        ]);
      }

      // Calculate self review score
      const avgScoreResult = await query(`
        SELECT AVG(numeric_score) as avg_score
        FROM appraisal_responses
        WHERE appraisal_id = $1 AND response_type = 'self' AND numeric_score IS NOT NULL
      `, [id]);

      const selfReviewScore = avgScoreResult.rows[0].avg_score;

      // Update appraisal
      const updatedAppraisal = await query(`
        UPDATE appraisals 
        SET self_review_completed = true,
            self_review_completed_at = CURRENT_TIMESTAMP,
            self_review_score = $1,
            employee_comments = $2,
            status = CASE WHEN status = 'not_started' THEN 'self_review' ELSE status END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [selfReviewScore, employeeComments, id]);

      res.json({
        success: true,
        message: 'Self review submitted successfully',
        data: updatedAppraisal.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Submit manager review
  static async submitManagerReview(req, res, next) {
    try {
      const { id } = req.params;
      const { responses, managerComments, overallRating } = req.body;

      if (!responses || !Array.isArray(responses)) {
        throw new ValidationError('Responses array is required');
      }

      // Verify user is the manager for this appraisal
      const appraisalResult = await query(`
        SELECT * FROM appraisals 
        WHERE id = $1 AND manager_id = $2 AND school_id = $3
      `, [id, req.user.userId, req.user.schoolId]);

      if (appraisalResult.rows.length === 0) {
        throw new NotFoundError('Appraisal not found or access denied');
      }

      // Save manager responses
      for (const response of responses) {
        await query(`
          INSERT INTO appraisal_responses (
            appraisal_id, question_id, response_type, respondent_id,
            numeric_score, text_response, selected_option
          ) VALUES ($1, $2, 'manager', $3, $4, $5, $6)
          ON CONFLICT (appraisal_id, question_id, response_type, respondent_id)
          DO UPDATE SET 
            numeric_score = EXCLUDED.numeric_score,
            text_response = EXCLUDED.text_response,
            selected_option = EXCLUDED.selected_option,
            submitted_at = CURRENT_TIMESTAMP
        `, [
          id, response.questionId, req.user.userId,
          response.numericScore, response.textResponse, response.selectedOption
        ]);
      }

      // Calculate manager review score
      const avgScoreResult = await query(`
        SELECT AVG(numeric_score) as avg_score
        FROM appraisal_responses
        WHERE appraisal_id = $1 AND response_type = 'manager' AND numeric_score IS NOT NULL
      `, [id]);

      const managerReviewScore = avgScoreResult.rows[0].avg_score;

      // Calculate final score (average of self and manager scores)
      const appraisal = appraisalResult.rows[0];
      const finalScore = appraisal.self_review_score ? 
        ((parseFloat(appraisal.self_review_score) + parseFloat(managerReviewScore)) / 2) : 
        managerReviewScore;

      // Update appraisal
      const updatedAppraisal = await query(`
        UPDATE appraisals 
        SET manager_review_completed = true,
            manager_review_completed_at = CURRENT_TIMESTAMP,
            manager_review_score = $1,
            final_score = $2,
            overall_rating = $3,
            manager_comments = $4,
            status = 'completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [managerReviewScore, finalScore, overallRating, managerComments, id]);

      res.json({
        success: true,
        message: 'Manager review submitted successfully',
        data: updatedAppraisal.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // GOAL MANAGEMENT
  // =============================================================================

  // Set goals for appraisal
  static async setGoals(req, res, next) {
    try {
      const { id } = req.params;
      const { goals } = req.body;

      if (!goals || !Array.isArray(goals)) {
        throw new ValidationError('Goals array is required');
      }

      // Verify appraisal exists and user has access
      const appraisalResult = await query(`
        SELECT * FROM appraisals 
        WHERE id = $1 AND school_id = $2 AND (employee_id = $3 OR manager_id = $3)
      `, [id, req.user.schoolId, req.user.userId]);

      if (appraisalResult.rows.length === 0) {
        throw new NotFoundError('Appraisal not found or access denied');
      }

      // Create goals
      const createdGoals = [];
      for (const goal of goals) {
        const result = await query(`
          INSERT INTO appraisal_goals (
            appraisal_id, goal_title, goal_description, goal_type,
            is_specific, is_measurable, is_achievable, is_relevant, is_timebound,
            target_date, review_frequency, success_criteria
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `, [
          id, goal.goalTitle, goal.goalDescription, goal.goalType || 'performance',
          goal.isSpecific || false, goal.isMeasurable || false, goal.isAchievable || false,
          goal.isRelevant || false, goal.isTimebound || false, goal.targetDate,
          goal.reviewFrequency || 'quarterly', goal.successCriteria
        ]);

        createdGoals.push(result.rows[0]);
      }

      res.status(201).json({
        success: true,
        message: 'Goals set successfully',
        data: createdGoals
      });
    } catch (error) {
      next(error);
    }
  }

  // Get goal progress
  static async getGoalProgress(req, res, next) {
    try {
      const { id } = req.params;

      // Verify appraisal access
      const appraisalResult = await query(`
        SELECT * FROM appraisals 
        WHERE id = $1 AND school_id = $2 AND (employee_id = $3 OR manager_id = $3)
      `, [id, req.user.schoolId, req.user.userId]);

      if (appraisalResult.rows.length === 0) {
        throw new NotFoundError('Appraisal not found or access denied');
      }

      const result = await query(`
        SELECT *
        FROM appraisal_goals
        WHERE appraisal_id = $1
        ORDER BY created_at
      `, [id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Update goal progress
  static async updateGoalProgress(req, res, next) {
    try {
      const { goalId } = req.params;
      const { 
        progressPercentage, 
        status, 
        actualOutcome, 
        lessonsLearned 
      } = req.body;

      const result = await query(`
        UPDATE appraisal_goals 
        SET progress_percentage = COALESCE($1, progress_percentage),
            status = COALESCE($2, status),
            actual_outcome = COALESCE($3, actual_outcome),
            lessons_learned = COALESCE($4, lessons_learned),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [progressPercentage, status, actualOutcome, lessonsLearned, goalId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Goal not found');
      }

      res.json({
        success: true,
        message: 'Goal progress updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // 360-DEGREE FEEDBACK
  // =============================================================================

  // Submit peer feedback
  static async submitPeerFeedback(req, res, next) {
    try {
      const { id } = req.params;
      const {
        strengths,
        areasForImprovement,
        specificExamples,
        recommendations,
        ratings = {},
        isAnonymous = true
      } = req.body;

      const result = await query(`
        INSERT INTO appraisal_feedback (
          appraisal_id, feedback_provider_id, feedback_type,
          strengths, areas_for_improvement, specific_examples, recommendations,
          communication_rating, teamwork_rating, leadership_rating,
          technical_skills_rating, overall_rating, is_anonymous
        ) VALUES ($1, $2, 'peer', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        id, req.user.userId, strengths, areasForImprovement, specificExamples,
        recommendations, ratings.communication, ratings.teamwork, ratings.leadership,
        ratings.technicalSkills, ratings.overall, isAnonymous
      ]);

      res.status(201).json({
        success: true,
        message: 'Peer feedback submitted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get appraisal feedback
  static async getAppraisalFeedback(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        SELECT 
          af.*,
          CASE 
            WHEN af.is_anonymous THEN 'Anonymous'
            ELSE CONCAT(s.first_name, ' ', s.last_name)
          END as provider_name
        FROM appraisal_feedback af
        LEFT JOIN staff s ON af.feedback_provider_id = s.id
        WHERE af.appraisal_id = $1
        ORDER BY af.submitted_at DESC
      `, [id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ANALYTICS AND REPORTS
  // =============================================================================

  // Get appraisal analytics
  static async getAnalytics(req, res, next) {
    try {
      const { cycleId, department, startDate, endDate } = req.query;

      let whereClause = 'WHERE a.school_id = $1';
      const params = [req.user.schoolId];

      if (cycleId) {
        whereClause += ` AND a.cycle_id = $${params.length + 1}`;
        params.push(cycleId);
      }

      if (startDate) {
        whereClause += ` AND a.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND a.created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      const [overviewResult, statusBreakdownResult, scoreDistributionResult] = await Promise.all([
        query(`
          SELECT 
            COUNT(*) as total_appraisals,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appraisals,
            COUNT(CASE WHEN self_review_completed THEN 1 END) as self_reviews_completed,
            COUNT(CASE WHEN manager_review_completed THEN 1 END) as manager_reviews_completed,
            AVG(final_score) as average_final_score
          FROM appraisals a
          ${whereClause}
        `, params),

        query(`
          SELECT status, COUNT(*) as count
          FROM appraisals a
          ${whereClause}
          GROUP BY status
        `, params),

        query(`
          SELECT 
            CASE 
              WHEN final_score >= 4.5 THEN 'Excellent (4.5-5.0)'
              WHEN final_score >= 3.5 THEN 'Good (3.5-4.4)'
              WHEN final_score >= 2.5 THEN 'Satisfactory (2.5-3.4)'
              WHEN final_score >= 1.5 THEN 'Needs Improvement (1.5-2.4)'
              ELSE 'Poor (0-1.4)'
            END as score_range,
            COUNT(*) as count
          FROM appraisals a
          ${whereClause} AND final_score IS NOT NULL
          GROUP BY 
            CASE 
              WHEN final_score >= 4.5 THEN 'Excellent (4.5-5.0)'
              WHEN final_score >= 3.5 THEN 'Good (3.5-4.4)'
              WHEN final_score >= 2.5 THEN 'Satisfactory (2.5-3.4)'
              WHEN final_score >= 1.5 THEN 'Needs Improvement (1.5-2.4)'
              ELSE 'Poor (0-1.4)'
            END
          ORDER BY MIN(final_score) DESC
        `, params)
      ]);

      const analytics = {
        overview: overviewResult.rows[0],
        statusBreakdown: statusBreakdownResult.rows,
        scoreDistribution: scoreDistributionResult.rows
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // Complete appraisal
  static async completeAppraisal(req, res, next) {
    try {
      const { id } = req.params;
      const { hrComments } = req.body;

      const result = await query(`
        UPDATE appraisals 
        SET status = 'completed',
            hr_comments = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND school_id = $3
        RETURNING *
      `, [hrComments, id, req.user.schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Appraisal not found');
      }

      res.json({
        success: true,
        message: 'Appraisal completed successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AppraisalController;