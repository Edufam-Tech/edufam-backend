const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class PerformanceController {
  // =============================================================================
  // APPRAISAL CYCLE MANAGEMENT
  // =============================================================================

  static async getAppraisalCycles(req, res) {
    try {
      const { year, status } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE school_id = $1';
      const params = [schoolId];

      if (year) {
        whereClause += ' AND year = $2';
        params.push(year);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT id, name, year, start_date, end_date, appraisal_type,
               description, status, auto_reminders, created_at,
               (SELECT COUNT(*) FROM performance_appraisals WHERE cycle_id = ac.id) as total_appraisals,
               (SELECT COUNT(*) FROM performance_appraisals WHERE cycle_id = ac.id AND status = 'completed') as completed_appraisals
        FROM appraisal_cycles ac
        ${whereClause}
        ORDER BY year DESC, start_date DESC
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get appraisal cycles error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appraisal cycles'
      });
    }
  }

  static async createAppraisalCycle(req, res) {
    try {
      const {
        name, year, startDate, endDate, appraisalType, description,
        targetEmployees, autoReminders
      } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Check if cycle already exists for this year
      const existingCycle = await query(`
        SELECT id FROM appraisal_cycles 
        WHERE school_id = $1 AND year = $2 AND appraisal_type = $3
      `, [schoolId, year, appraisalType]);

      if (existingCycle.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `${appraisalType} appraisal cycle already exists for ${year}`
        });
      }

      const result = await query(`
        INSERT INTO appraisal_cycles (
          school_id, name, year, start_date, end_date, appraisal_type,
          description, target_employees, auto_reminders, status,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, NOW())
        RETURNING id, name, year, start_date, end_date, status
      `, [
        schoolId, name, year, startDate, endDate, appraisalType,
        description, JSON.stringify(targetEmployees), autoReminders !== false, userId
      ]);

      // Create individual appraisals for target employees
      if (targetEmployees && targetEmployees.length > 0) {
        const cycleId = result.rows[0].id;
        
        for (const employeeId of targetEmployees) {
          await query(`
            INSERT INTO performance_appraisals (
              cycle_id, employee_id, status, created_at
            ) VALUES ($1, $2, 'pending', NOW())
          `, [cycleId, employeeId]);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Appraisal cycle created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create appraisal cycle error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create appraisal cycle'
      });
    }
  }

  static async updateAppraisalCycle(req, res) {
    try {
      const { cycleId } = req.params;
      const updateFields = req.body;
      const schoolId = req.user.schoolId;

      const setClause = [];
      const params = [cycleId, schoolId];
      let paramCount = 2;

      Object.keys(updateFields).forEach(field => {
        if (updateFields[field] !== undefined && field !== 'id') {
          paramCount++;
          if (field === 'targetEmployees') {
            setClause.push(`target_employees = $${paramCount}`);
            params.push(JSON.stringify(updateFields[field]));
          } else {
            setClause.push(`${field} = $${paramCount}`);
            params.push(updateFields[field]);
          }
        }
      });

      if (setClause.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      setClause.push('updated_at = NOW()');

      const result = await query(`
        UPDATE appraisal_cycles 
        SET ${setClause.join(', ')}
        WHERE id = $1 AND school_id = $2
        RETURNING id, name, year, status, updated_at
      `, params);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Appraisal cycle not found'
        });
      }

      res.json({
        success: true,
        message: 'Appraisal cycle updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update appraisal cycle error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update appraisal cycle'
      });
    }
  }

  // =============================================================================
  // APPRAISAL TEMPLATES
  // =============================================================================

  static async getAppraisalTemplates(req, res) {
    try {
      const { templateType } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE school_id = $1';
      const params = [schoolId];

      if (templateType) {
        whereClause += ' AND template_type = $2';
        params.push(templateType);
      }

      const result = await query(`
        SELECT id, name, template_type, description, assessment_areas,
               rating_scale, is_active, created_at, updated_at
        FROM appraisal_templates 
        ${whereClause}
        ORDER BY template_type, name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get appraisal templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appraisal templates'
      });
    }
  }

  static async createAppraisalTemplate(req, res) {
    try {
      const {
        name, templateType, description, assessmentAreas, ratingScale
      } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      const result = await query(`
        INSERT INTO appraisal_templates (
          school_id, name, template_type, description, assessment_areas,
          rating_scale, is_active, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW())
        RETURNING id, name, template_type, description
      `, [
        schoolId, name, templateType, description,
        JSON.stringify(assessmentAreas), JSON.stringify(ratingScale), userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Appraisal template created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create appraisal template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create appraisal template'
      });
    }
  }

  // =============================================================================
  // INDIVIDUAL APPRAISALS
  // =============================================================================

  static async getAppraisals(req, res) {
    try {
      const { cycleId, employeeId, status } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE ac.school_id = $1';
      const params = [schoolId];

      if (cycleId) {
        whereClause += ' AND pa.cycle_id = $2';
        params.push(cycleId);
      }

      if (employeeId) {
        whereClause += ` AND pa.employee_id = $${params.length + 1}`;
        params.push(employeeId);
      }

      if (status) {
        whereClause += ` AND pa.status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT pa.id, pa.cycle_id, pa.employee_id, pa.status,
               pa.self_assessment_completed, pa.supervisor_review_completed,
               pa.peer_feedback_completed, pa.overall_rating, pa.created_at,
               u.first_name || ' ' || u.last_name as employee_name,
               COALESCE(e.position, 'Not Assigned') as position,
               ac.name as cycle_name, ac.year
        FROM performance_appraisals pa
        JOIN appraisal_cycles ac ON pa.cycle_id = ac.id
        JOIN employees e ON pa.employee_id = e.id
        LEFT JOIN users u ON e.user_id = u.id
        ${whereClause}
        ORDER BY ac.year DESC, u.first_name, u.last_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get appraisals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get appraisals'
      });
    }
  }

  static async initiateAppraisal(req, res) {
    try {
      const { cycleId, employeeId, templateId, dueDate } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Verify cycle belongs to school
      const cycle = await query(`
        SELECT id FROM appraisal_cycles 
        WHERE id = $1 AND school_id = $2
      `, [cycleId, schoolId]);

      if (cycle.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Appraisal cycle not found'
        });
      }

      // Check if appraisal already exists
      const existingAppraisal = await query(`
        SELECT id FROM performance_appraisals 
        WHERE cycle_id = $1 AND employee_id = $2
      `, [cycleId, employeeId]);

      if (existingAppraisal.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Appraisal already exists for this employee and cycle'
        });
      }

      const result = await query(`
        INSERT INTO performance_appraisals (
          cycle_id, employee_id, template_id, status, due_date,
          initiated_by, created_at
        ) VALUES ($1, $2, $3, 'pending', $4, $5, NOW())
        RETURNING id, cycle_id, employee_id, status, due_date
      `, [cycleId, employeeId, templateId, dueDate, userId]);

      res.status(201).json({
        success: true,
        message: 'Appraisal initiated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Initiate appraisal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate appraisal'
      });
    }
  }

  static async submitSelfAssessment(req, res) {
    try {
      const { appraisalId } = req.params;
      const { assessmentData, comments } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Verify appraisal exists and employee has access
      const appraisal = await query(`
        SELECT pa.id, pa.employee_id, pa.status
        FROM performance_appraisals pa
        JOIN appraisal_cycles ac ON pa.cycle_id = ac.id
        WHERE pa.id = $1 AND ac.school_id = $2
      `, [appraisalId, schoolId]);

      if (appraisal.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Appraisal not found'
        });
      }

      // Check if user is the employee being appraised
      if (appraisal.rows[0].employee_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to submit self-assessment for this appraisal'
        });
      }

      const result = await query(`
        UPDATE performance_appraisals 
        SET self_assessment_data = $1,
            self_assessment_comments = $2,
            self_assessment_completed = true,
            self_assessment_date = NOW(),
            status = CASE WHEN status = 'pending' THEN 'self_assessment_completed' ELSE status END
        WHERE id = $3
        RETURNING id, status, self_assessment_completed, self_assessment_date
      `, [JSON.stringify(assessmentData), comments, appraisalId]);

      res.json({
        success: true,
        message: 'Self-assessment submitted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Submit self-assessment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit self-assessment'
      });
    }
  }

  static async submitSupervisorReview(req, res) {
    try {
      const { appraisalId } = req.params;
      const { reviewData, rating, comments, recommendations } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Verify appraisal exists and user can review
      const appraisal = await query(`
        SELECT pa.id, pa.status
        FROM performance_appraisals pa
        JOIN appraisal_cycles ac ON pa.cycle_id = ac.id
        WHERE pa.id = $1 AND ac.school_id = $2
      `, [appraisalId, schoolId]);

      if (appraisal.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Appraisal not found'
        });
      }

      // Check if user has supervisor role
      if (!['principal', 'school_director', 'hr'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to submit supervisor review'
        });
      }

      const result = await query(`
        UPDATE performance_appraisals 
        SET supervisor_review_data = $1,
            supervisor_rating = $2,
            supervisor_comments = $3,
            supervisor_recommendations = $4,
            supervisor_review_completed = true,
            supervisor_review_date = NOW(),
            reviewed_by = $5,
            status = 'supervisor_review_completed'
        WHERE id = $6
        RETURNING id, status, supervisor_review_completed, supervisor_review_date
      `, [JSON.stringify(reviewData), rating, comments, recommendations, userId, appraisalId]);

      res.json({
        success: true,
        message: 'Supervisor review submitted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Submit supervisor review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit supervisor review'
      });
    }
  }

  static async submitPeerFeedback(req, res) {
    try {
      const { appraisalId } = req.params;
      const { feedbackData, comments } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Verify appraisal exists
      const appraisal = await query(`
        SELECT pa.id, pa.employee_id
        FROM performance_appraisals pa
        JOIN appraisal_cycles ac ON pa.cycle_id = ac.id
        WHERE pa.id = $1 AND ac.school_id = $2
      `, [appraisalId, schoolId]);

      if (appraisal.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Appraisal not found'
        });
      }

      // Ensure user is not providing feedback for themselves
      if (appraisal.rows[0].employee_id === userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot provide peer feedback for yourself'
        });
      }

      // Check if peer feedback already exists from this user
      const existingFeedback = await query(`
        SELECT id FROM peer_feedback 
        WHERE appraisal_id = $1 AND feedback_by = $2
      `, [appraisalId, userId]);

      if (existingFeedback.rows.length > 0) {
        // Update existing feedback
        await query(`
          UPDATE peer_feedback 
          SET feedback_data = $1, comments = $2, updated_at = NOW()
          WHERE appraisal_id = $3 AND feedback_by = $4
        `, [JSON.stringify(feedbackData), comments, appraisalId, userId]);
      } else {
        // Create new feedback
        await query(`
          INSERT INTO peer_feedback (
            appraisal_id, feedback_by, feedback_data, comments, created_at
          ) VALUES ($1, $2, $3, $4, NOW())
        `, [appraisalId, userId, JSON.stringify(feedbackData), comments]);
      }

      // Update appraisal status
      await query(`
        UPDATE performance_appraisals 
        SET peer_feedback_completed = true,
            peer_feedback_date = NOW()
        WHERE id = $1
      `, [appraisalId]);

      res.json({
        success: true,
        message: 'Peer feedback submitted successfully'
      });
    } catch (error) {
      console.error('Submit peer feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit peer feedback'
      });
    }
  }

  static async finalizeAppraisal(req, res) {
    try {
      const { appraisalId } = req.params;
      const { finalRating, finalComments, developmentPlan, nextReviewDate } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Verify appraisal exists and user can finalize
      const appraisal = await query(`
        SELECT pa.id, pa.status
        FROM performance_appraisals pa
        JOIN appraisal_cycles ac ON pa.cycle_id = ac.id
        WHERE pa.id = $1 AND ac.school_id = $2
      `, [appraisalId, schoolId]);

      if (appraisal.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Appraisal not found'
        });
      }

      // Check if user has authority to finalize
      if (!['hr', 'principal', 'school_director'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to finalize appraisal'
        });
      }

      const result = await query(`
        UPDATE performance_appraisals 
        SET overall_rating = $1,
            final_comments = $2,
            development_plan = $3,
            next_review_date = $4,
            status = 'completed',
            finalized_by = $5,
            finalized_at = NOW()
        WHERE id = $6
        RETURNING id, overall_rating, status, finalized_at
      `, [finalRating, finalComments, JSON.stringify(developmentPlan), nextReviewDate, userId, appraisalId]);

      res.json({
        success: true,
        message: 'Appraisal finalized successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Finalize appraisal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to finalize appraisal'
      });
    }
  }

  // =============================================================================
  // GOAL MANAGEMENT
  // =============================================================================

  static async getGoals(req, res) {
    try {
      const { employeeId, status, year } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE e.school_id = $1';
      const params = [schoolId];

      if (employeeId) {
        whereClause += ' AND pg.employee_id = $2';
        params.push(employeeId);
      }

      if (status) {
        whereClause += ` AND pg.status = $${params.length + 1}`;
        params.push(status);
      }

      if (year) {
        whereClause += ` AND EXTRACT(YEAR FROM pg.target_date) = $${params.length + 1}`;
        params.push(year);
      }

      const result = await query(`
        SELECT pg.id, pg.employee_id, pg.goal_title, pg.description,
               pg.target_date, pg.status, pg.progress_percentage,
               pg.created_at, pg.updated_at,
               e.first_name || ' ' || e.last_name as employee_name
        FROM performance_goals pg
        JOIN employees e ON pg.employee_id = e.id
        ${whereClause}
        ORDER BY pg.target_date DESC
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get goals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get goals'
      });
    }
  }

  static async createGoal(req, res) {
    try {
      const {
        employeeId, goalTitle, description, targetDate, metrics, priority
      } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Verify employee belongs to school
      const employee = await query(`
        SELECT id FROM employees WHERE id = $1 AND school_id = $2
      `, [employeeId, schoolId]);

      if (employee.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const result = await query(`
        INSERT INTO performance_goals (
          employee_id, goal_title, description, target_date, metrics,
          priority, status, progress_percentage, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active', 0, $7, NOW())
        RETURNING id, goal_title, target_date, status
      `, [employeeId, goalTitle, description, targetDate, JSON.stringify(metrics), priority, userId]);

      res.status(201).json({
        success: true,
        message: 'Goal created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create goal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create goal'
      });
    }
  }

  static async updateGoalProgress(req, res) {
    try {
      const { goalId } = req.params;
      const { progressPercentage, statusUpdate, notes } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Verify goal exists and belongs to school
      const goal = await query(`
        SELECT pg.id, pg.employee_id
        FROM performance_goals pg
        JOIN employees e ON pg.employee_id = e.id
        WHERE pg.id = $1 AND e.school_id = $2
      `, [goalId, schoolId]);

      if (goal.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Goal not found'
        });
      }

      // Determine new status based on progress
      let newStatus = 'active';
      if (progressPercentage >= 100) {
        newStatus = 'completed';
      } else if (progressPercentage >= 75) {
        newStatus = 'on_track';
      } else if (new Date() > new Date()) { // Past due date logic would go here
        newStatus = 'at_risk';
      }

      const result = await query(`
        UPDATE performance_goals 
        SET progress_percentage = $1,
            status = $2,
            progress_notes = $3,
            updated_by = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING id, progress_percentage, status, updated_at
      `, [progressPercentage, statusUpdate || newStatus, notes, userId, goalId]);

      res.json({
        success: true,
        message: 'Goal progress updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update goal progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update goal progress'
      });
    }
  }

  // =============================================================================
  // DEVELOPMENT PLANS
  // =============================================================================

  static async getDevelopmentPlans(req, res) {
    try {
      const { employeeId, status } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE e.school_id = $1';
      const params = [schoolId];

      if (employeeId) {
        whereClause += ' AND dp.employee_id = $2';
        params.push(employeeId);
      }

      if (status) {
        whereClause += ` AND dp.status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT dp.id, dp.employee_id, dp.plan_title, dp.description,
               dp.development_areas, dp.action_items, dp.target_completion_date,
               dp.status, dp.created_at,
               e.first_name || ' ' || e.last_name as employee_name
        FROM development_plans dp
        JOIN employees e ON dp.employee_id = e.id
        ${whereClause}
        ORDER BY dp.created_at DESC
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get development plans error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get development plans'
      });
    }
  }

  static async createDevelopmentPlan(req, res) {
    try {
      const {
        employeeId, planTitle, description, developmentAreas,
        actionItems, targetCompletionDate
      } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Verify employee belongs to school
      const employee = await query(`
        SELECT id FROM employees WHERE id = $1 AND school_id = $2
      `, [employeeId, schoolId]);

      if (employee.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const result = await query(`
        INSERT INTO development_plans (
          employee_id, plan_title, description, development_areas,
          action_items, target_completion_date, status, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW())
        RETURNING id, plan_title, target_completion_date, status
      `, [
        employeeId, planTitle, description, JSON.stringify(developmentAreas),
        JSON.stringify(actionItems), targetCompletionDate, userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Development plan created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create development plan error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create development plan'
      });
    }
  }

  // =============================================================================
  // PERFORMANCE ANALYTICS
  // =============================================================================

  static async getPerformanceTrends(req, res) {
    try {
      const { startYear, endYear, department } = req.query;
      const schoolId = req.user.schoolId;

      // Placeholder analytics data
      const trends = {
        yearlyTrends: [
          { year: 2023, averageRating: 4.2, completionRate: 85 },
          { year: 2024, averageRating: 4.4, completionRate: 92 }
        ],
        departmentComparison: [
          { department: 'Teaching', averageRating: 4.3, employeeCount: 25 },
          { department: 'Administration', averageRating: 4.1, employeeCount: 8 }
        ],
        ratingDistribution: [
          { rating: '5', count: 12, percentage: 36 },
          { rating: '4', count: 15, percentage: 45 },
          { rating: '3', count: 6, percentage: 18 },
          { rating: '2', count: 0, percentage: 0 },
          { rating: '1', count: 0, percentage: 0 }
        ]
      };

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      console.error('Get performance trends error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get performance trends'
      });
    }
  }

  static async getRatingDistribution(req, res) {
    try {
      const { cycleId, department } = req.query;
      const schoolId = req.user.schoolId;

      // Get actual rating distribution from database
      let whereClause = 'WHERE ac.school_id = $1 AND pa.overall_rating IS NOT NULL';
      const params = [schoolId];

      if (cycleId) {
        whereClause += ' AND pa.cycle_id = $2';
        params.push(cycleId);
      }

      const result = await query(`
        SELECT 
          pa.overall_rating as rating,
          COUNT(*) as count
        FROM performance_appraisals pa
        JOIN appraisal_cycles ac ON pa.cycle_id = ac.id
        ${whereClause}
        GROUP BY pa.overall_rating
        ORDER BY pa.overall_rating DESC
      `, params);

      const totalCount = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      const distribution = result.rows.map(row => ({
        rating: row.rating,
        count: parseInt(row.count),
        percentage: totalCount > 0 ? Math.round((parseInt(row.count) / totalCount) * 100) : 0
      }));

      res.json({
        success: true,
        data: {
          distribution,
          totalAppraisals: totalCount
        }
      });
    } catch (error) {
      console.error('Get rating distribution error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get rating distribution'
      });
    }
  }

  static async getIndividualReport(req, res) {
    try {
      const { employeeId } = req.params;
      const { startYear, endYear } = req.query;
      const schoolId = req.user.schoolId;

      // Get employee performance history
      const result = await query(`
        SELECT pa.id, pa.overall_rating, pa.finalized_at,
               ac.name as cycle_name, ac.year,
               COUNT(pg.id) as total_goals,
               COUNT(CASE WHEN pg.status = 'completed' THEN 1 END) as completed_goals
        FROM performance_appraisals pa
        JOIN appraisal_cycles ac ON pa.cycle_id = ac.id
        LEFT JOIN performance_goals pg ON pg.employee_id = pa.employee_id 
          AND EXTRACT(YEAR FROM pg.target_date) = ac.year
        WHERE pa.employee_id = $1 AND ac.school_id = $2
          AND pa.status = 'completed'
        GROUP BY pa.id, pa.overall_rating, pa.finalized_at, ac.name, ac.year
        ORDER BY ac.year DESC
      `, [employeeId, schoolId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get individual report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get individual performance report'
      });
    }
  }

  static async getDepartmentReport(req, res) {
    try {
      const { department, year } = req.query;
      const schoolId = req.user.schoolId;

      // Placeholder department report
      const report = {
        department: department || 'All Departments',
        year: year || new Date().getFullYear(),
        summary: {
          totalEmployees: 25,
          appraisalsCompleted: 23,
          completionRate: 92,
          averageRating: 4.3
        },
        topPerformers: [
          { name: 'John Doe', position: 'Math Teacher', rating: 4.8 },
          { name: 'Jane Smith', position: 'English Teacher', rating: 4.7 }
        ],
        improvementAreas: [
          { area: 'Communication Skills', employeesNeedingImprovement: 3 },
          { area: 'Technology Integration', employeesNeedingImprovement: 5 }
        ]
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Get department report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get department performance report'
      });
    }
  }

  // =============================================================================
  // MISSING PERFORMANCE METHODS
  // =============================================================================

  static async updateAppraisalTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const { name, assessmentAreas, weightings, instructions } = req.body;

      const result = await query(`
        UPDATE appraisal_templates 
        SET name = $1, assessment_areas = $2, weightings = $3,
            instructions = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 AND school_id = $6
        RETURNING *
      `, [
        name, JSON.stringify(assessmentAreas), JSON.stringify(weightings),
        instructions, templateId, req.user.school_id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Appraisal template not found');
      }

      res.json({
        success: true,
        message: 'Appraisal template updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update appraisal template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update appraisal template'
      });
    }
  }

  static async getPerformanceGoals(req, res) {
    try {
      const { employee_id, status, goal_type } = req.query;

      let whereClause = 'WHERE pg.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (employee_id) {
        paramCount++;
        whereClause += ` AND pg.employee_id = $${paramCount}`;
        params.push(employee_id);
      }

      if (status) {
        paramCount++;
        whereClause += ` AND pg.status = $${paramCount}`;
        params.push(status);
      }

      if (goal_type) {
        paramCount++;
        whereClause += ` AND pg.goal_type = $${paramCount}`;
        params.push(goal_type);
      }

      const goals = await query(`
        SELECT 
          pg.*, u.first_name, u.last_name, e.employee_number,
          d.name as department_name
        FROM performance_goals pg
        JOIN employees e ON pg.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        ${whereClause}
        ORDER BY pg.target_date, pg.priority DESC
      `, params);

      res.json({
        success: true,
        data: goals.rows
      });
    } catch (error) {
      console.error('Get performance goals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get performance goals'
      });
    }
  }

  static async createPerformanceGoal(req, res) {
    try {
      const { 
        employee_id, title, description, goal_type, priority,
        target_date, success_criteria, measurable_outcomes 
      } = req.body;

      const result = await query(`
        INSERT INTO performance_goals (
          school_id, employee_id, title, description, goal_type,
          priority, target_date, success_criteria, measurable_outcomes,
          status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
        RETURNING *
      `, [
        req.user.school_id, employee_id, title, description, goal_type,
        priority, target_date, JSON.stringify(success_criteria), 
        JSON.stringify(measurable_outcomes), req.user.userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Performance goal created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create performance goal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create performance goal'
      });
    }
  }

  static async getPerformanceDistribution(req, res) {
    try {
      const { cycle_id, department_id } = req.query;

      let whereClause = 'WHERE a.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (cycle_id) {
        paramCount++;
        whereClause += ` AND a.cycle_id = $${paramCount}`;
        params.push(cycle_id);
      }

      if (department_id) {
        paramCount++;
        whereClause += ` AND e.department_id = $${paramCount}`;
        params.push(department_id);
      }

      const distribution = await query(`
        SELECT 
          a.overall_rating,
          COUNT(*) as employee_count,
          ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
        FROM appraisals a
        JOIN employees e ON a.employee_id = e.id
        ${whereClause}
        AND a.status = 'finalized'
        GROUP BY a.overall_rating
        ORDER BY a.overall_rating DESC
      `, params);

      res.json({
        success: true,
        data: distribution.rows
      });
    } catch (error) {
      console.error('Get performance distribution error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get performance distribution'
      });
    }
  }

  static async getGoalAchievementAnalytics(req, res) {
    try {
      const { department_id, time_period } = req.query;

      let whereClause = 'WHERE pg.school_id = $1';
      let params = [req.user.school_id];
      let paramCount = 1;

      if (department_id) {
        paramCount++;
        whereClause += ` AND e.department_id = $${paramCount}`;
        params.push(department_id);
      }

      if (time_period) {
        paramCount++;
        whereClause += ` AND pg.created_at >= CURRENT_DATE - INTERVAL '${time_period} months'`;
      }

      const analytics = await query(`
        SELECT 
          COUNT(*) as total_goals,
          COUNT(CASE WHEN pg.status = 'completed' THEN 1 END) as completed_goals,
          COUNT(CASE WHEN pg.status = 'in_progress' THEN 1 END) as in_progress_goals,
          COUNT(CASE WHEN pg.status = 'overdue' THEN 1 END) as overdue_goals,
          ROUND(
            (COUNT(CASE WHEN pg.status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 2
          ) as completion_rate,
          AVG(pg.progress_percentage) as average_progress
        FROM performance_goals pg
        JOIN employees e ON pg.employee_id = e.id
        ${whereClause}
      `, params);

      // Goal type breakdown
      const goalTypes = await query(`
        SELECT 
          pg.goal_type,
          COUNT(*) as total_count,
          COUNT(CASE WHEN pg.status = 'completed' THEN 1 END) as completed_count,
          ROUND(
            (COUNT(CASE WHEN pg.status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 2
          ) as completion_rate
        FROM performance_goals pg
        JOIN employees e ON pg.employee_id = e.id
        ${whereClause}
        GROUP BY pg.goal_type
        ORDER BY completion_rate DESC
      `, params);

      res.json({
        success: true,
        data: {
          overall: analytics.rows[0],
          by_goal_type: goalTypes.rows
        }
      });
    } catch (error) {
      console.error('Get goal achievement analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get goal achievement analytics'
      });
    }
  }

  static async generateIndividualReport(req, res) {
    try {
      const { employee_id, cycle_id } = req.query;

      if (!employee_id) {
        throw new ValidationError('Employee ID is required');
      }

      // Get employee details
      const employee = await query(`
        SELECT 
          u.first_name, u.last_name, e.employee_number, e.position,
          d.name as department_name
        FROM employees e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.id = $1 AND e.school_id = $2
      `, [employee_id, req.user.school_id]);

      if (employee.rows.length === 0) {
        throw new NotFoundError('Employee not found');
      }

      // Get appraisal data
      let appraisalQuery = `
        SELECT * FROM appraisals 
        WHERE employee_id = $1 AND school_id = $2
      `;
      let appraisalParams = [employee_id, req.user.school_id];

      if (cycle_id) {
        appraisalQuery += ' AND cycle_id = $3';
        appraisalParams.push(cycle_id);
      }

      appraisalQuery += ' ORDER BY created_at DESC LIMIT 1';

      const appraisal = await query(appraisalQuery, appraisalParams);

      // Get performance goals
      const goals = await query(`
        SELECT * FROM performance_goals 
        WHERE employee_id = $1 AND school_id = $2
        ORDER BY created_at DESC
      `, [employee_id, req.user.school_id]);

      res.json({
        success: true,
        data: {
          employee: employee.rows[0],
          latest_appraisal: appraisal.rows[0] || null,
          performance_goals: goals.rows,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Generate individual report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate individual performance report'
      });
    }
  }

  static async generateSchoolWideReport(req, res) {
    try {
      const { cycle_id } = req.query;

      let whereClause = 'WHERE a.school_id = $1';
      let params = [req.user.school_id];

      if (cycle_id) {
        whereClause += ' AND a.cycle_id = $2';
        params.push(cycle_id);
      }

      // Overall statistics
      const overall = await query(`
        SELECT 
          COUNT(DISTINCT a.employee_id) as total_employees_appraised,
          AVG(a.overall_rating) as average_rating,
          COUNT(CASE WHEN a.overall_rating >= 4 THEN 1 END) as high_performers,
          COUNT(CASE WHEN a.overall_rating <= 2 THEN 1 END) as needs_improvement
        FROM appraisals a
        ${whereClause}
        AND a.status = 'finalized'
      `, params);

      // Department breakdown
      const departments = await query(`
        SELECT 
          d.name as department_name,
          COUNT(DISTINCT a.employee_id) as employees_count,
          AVG(a.overall_rating) as average_rating,
          COUNT(CASE WHEN a.overall_rating >= 4 THEN 1 END) as high_performers
        FROM appraisals a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        ${whereClause}
        AND a.status = 'finalized'
        GROUP BY d.id, d.name
        ORDER BY average_rating DESC
      `, params);

      res.json({
        success: true,
        data: {
          overall_statistics: overall.rows[0],
          department_breakdown: departments.rows,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Generate school-wide report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate school-wide performance report'
      });
    }
  }

  static async generateDepartmentReport(req, res) {
    try {
      const { departmentId, cycleId, format } = req.query;

      if (!departmentId || !cycleId) {
        throw new ValidationError('Department ID and Cycle ID are required');
      }

      // Get department info
      const department = await query(`
        SELECT name FROM departments 
        WHERE id = $1 AND school_id = $2
      `, [departmentId, req.user.school_id]);

      if (department.rows.length === 0) {
        throw new NotFoundError('Department not found');
      }

      // Get department performance data
      const performanceData = await query(`
        SELECT 
          u.first_name, u.last_name, e.employee_number,
          a.overall_rating, a.status as appraisal_status,
          a.created_at as appraisal_date
        FROM appraisals a
        JOIN employees e ON a.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE e.department_id = $1 AND a.cycle_id = $2 
        AND a.school_id = $3
        ORDER BY a.overall_rating DESC
      `, [departmentId, cycleId, req.user.school_id]);

      // Calculate statistics
      const stats = await query(`
        SELECT 
          COUNT(*) as total_employees,
          AVG(a.overall_rating) as average_rating,
          COUNT(CASE WHEN a.overall_rating >= 4 THEN 1 END) as high_performers,
          COUNT(CASE WHEN a.overall_rating <= 2 THEN 1 END) as needs_improvement
        FROM appraisals a
        JOIN employees e ON a.employee_id = e.id
        WHERE e.department_id = $1 AND a.cycle_id = $2 
        AND a.school_id = $3 AND a.status = 'finalized'
      `, [departmentId, cycleId, req.user.school_id]);

      const report = {
        department: department.rows[0],
        cycle_id: cycleId,
        statistics: stats.rows[0],
        employees: performanceData.rows,
        generated_at: new Date().toISOString(),
        format: format || 'json'
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Generate department report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate department performance report'
      });
    }
  }
}

module.exports = PerformanceController;