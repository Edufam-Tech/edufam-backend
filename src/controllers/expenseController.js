const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class ExpenseController {
  // =============================================================================
  // EXPENSE REQUEST MANAGEMENT
  // =============================================================================

  static async getExpenseRequests(req, res) {
    try {
      const { status, category, priority, dateFrom, dateTo, amountMin, amountMax } = req.query;
      const schoolId = req.user.schoolId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE er.school_id = $1';
      const params = [schoolId];

      if (status) {
        whereClause += ' AND er.status = $2';
        params.push(status);
      }

      if (category) {
        whereClause += ` AND er.category = $${params.length + 1}`;
        params.push(category);
      }

      if (priority) {
        whereClause += ` AND er.priority = $${params.length + 1}`;
        params.push(priority);
      }

      if (dateFrom) {
        whereClause += ` AND er.created_at >= $${params.length + 1}`;
        params.push(dateFrom);
      }

      if (dateTo) {
        whereClause += ` AND er.created_at <= $${params.length + 1}`;
        params.push(dateTo);
      }

      if (amountMin) {
        whereClause += ` AND er.amount >= $${params.length + 1}`;
        params.push(amountMin);
      }

      if (amountMax) {
        whereClause += ` AND er.amount <= $${params.length + 1}`;
        params.push(amountMax);
      }

      const result = await query(`
        SELECT er.id, er.category, er.description, er.amount, er.budget_line,
               er.vendor, er.justification, er.priority, er.status,
               er.expected_date, er.created_at, er.updated_at,
               u.first_name || ' ' || u.last_name as requested_by_name,
               approver.first_name || ' ' || approver.last_name as approved_by_name
        FROM expense_requests er
        JOIN users u ON er.requested_by = u.id
        LEFT JOIN users approver ON er.approved_by = approver.id
        ${whereClause}
        ORDER BY er.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM expense_requests er
        ${whereClause}
      `, params);

      res.json({
        success: true,
        data: {
          expenses: result.rows,
          pagination: {
            page,
            limit,
            total: parseInt(countResult.rows[0].total),
            totalPages: Math.ceil(countResult.rows[0].total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get expense requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get expense requests'
      });
    }
  }

  static async createExpenseRequest(req, res) {
    try {
      const {
        category, description, amount, budgetLine, vendor,
        justification, attachments, expectedDate, priority
      } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      const result = await query(`
        INSERT INTO expense_requests (
          school_id, category, description, amount, budget_line, vendor,
          justification, attachments, expected_date, priority, status,
          requested_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, NOW())
        RETURNING id, category, description, amount, status, created_at
      `, [
        schoolId, category, description, amount, budgetLine, vendor,
        justification, JSON.stringify(attachments), expectedDate, priority, userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Expense request created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create expense request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create expense request'
      });
    }
  }

  static async updateExpenseRequest(req, res) {
    try {
      const { requestId } = req.params;
      const updateFields = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Check if request exists and belongs to school
      const existingRequest = await query(`
        SELECT id, status, requested_by 
        FROM expense_requests 
        WHERE id = $1 AND school_id = $2
      `, [requestId, schoolId]);

      if (existingRequest.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Expense request not found'
        });
      }

      const request = existingRequest.rows[0];

      // Check if user can update (own request and status is draft)
      if (request.requested_by !== userId && !['principal', 'school_director', 'finance'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this expense request'
        });
      }

      // Build dynamic update query
      const setClause = [];
      const params = [requestId, schoolId];
      let paramCount = 2;

      Object.keys(updateFields).forEach(field => {
        if (updateFields[field] !== undefined && field !== 'id') {
          paramCount++;
          if (field === 'attachments') {
            setClause.push(`${field} = $${paramCount}`);
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
        UPDATE expense_requests 
        SET ${setClause.join(', ')}
        WHERE id = $1 AND school_id = $2
        RETURNING id, category, description, amount, status, updated_at
      `, params);

      res.json({
        success: true,
        message: 'Expense request updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update expense request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update expense request'
      });
    }
  }

  static async submitExpenseRequest(req, res) {
    try {
      const { requestId } = req.params;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      const result = await query(`
        UPDATE expense_requests 
        SET status = 'submitted', submitted_at = NOW()
        WHERE id = $1 AND school_id = $2 AND requested_by = $3 AND status = 'draft'
        RETURNING id, category, description, amount, status, submitted_at
      `, [requestId, schoolId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Expense request not found or cannot be submitted'
        });
      }

      // Send notification to approvers (placeholder)
      console.log('Sending expense approval notification...');

      res.json({
        success: true,
        message: 'Expense request submitted for approval',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Submit expense request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit expense request'
      });
    }
  }

  // =============================================================================
  // EXPENSE APPROVAL WORKFLOW
  // =============================================================================

  static async getPendingApprovals(req, res) {
    try {
      const schoolId = req.user.schoolId;
      const userRole = req.user.role;

      // Only principals, school directors, and finance managers can see pending approvals
      if (!['principal', 'school_director', 'finance'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view pending approvals'
        });
      }

      const result = await query(`
        SELECT er.id, er.category, er.description, er.amount, er.budget_line,
               er.vendor, er.justification, er.priority, er.expected_date,
               er.submitted_at, er.created_at,
               u.first_name || ' ' || u.last_name as requested_by_name
        FROM expense_requests er
        JOIN users u ON er.requested_by = u.id
        WHERE er.school_id = $1 AND er.status = 'submitted'
        ORDER BY er.priority DESC, er.submitted_at ASC
      `, [schoolId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending approvals'
      });
    }
  }

  static async approveExpenseRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { comments, approvedAmount, conditions, paymentMethod } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Only principals and school directors can approve
      if (!['principal', 'school_director'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to approve expense requests'
        });
      }

      const result = await query(`
        UPDATE expense_requests 
        SET status = 'approved',
            approved_by = $1,
            approved_at = NOW(),
            approval_comments = $2,
            approved_amount = COALESCE($3, amount),
            approval_conditions = $4,
            payment_method = $5
        WHERE id = $6 AND school_id = $7 AND status = 'submitted'
        RETURNING id, category, description, amount, approved_amount, status, approved_at
      `, [userId, comments, approvedAmount, JSON.stringify(conditions), paymentMethod, requestId, schoolId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Expense request not found or cannot be approved'
        });
      }

      // Send notification to requester (placeholder)
      console.log('Sending expense approval notification...');

      res.json({
        success: true,
        message: 'Expense request approved successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Approve expense request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve expense request'
      });
    }
  }

  static async rejectExpenseRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { reason, comments } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Only principals and school directors can reject
      if (!['principal', 'school_director'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to reject expense requests'
        });
      }

      const result = await query(`
        UPDATE expense_requests 
        SET status = 'rejected',
            rejected_by = $1,
            rejected_at = NOW(),
            rejection_reason = $2,
            rejection_comments = $3
        WHERE id = $4 AND school_id = $5 AND status = 'submitted'
        RETURNING id, category, description, amount, status, rejected_at
      `, [userId, reason, comments, requestId, schoolId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Expense request not found or cannot be rejected'
        });
      }

      // Send notification to requester (placeholder)
      console.log('Sending expense rejection notification...');

      res.json({
        success: true,
        message: 'Expense request rejected',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Reject expense request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject expense request'
      });
    }
  }

  static async bulkApproveExpenseRequests(req, res) {
    try {
      const { requestIds, comments } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const userRole = req.user.role;

      if (!['principal', 'school_director'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to approve expense requests'
        });
      }

      const result = await query(`
        UPDATE expense_requests 
        SET status = 'approved',
            approved_by = $1,
            approved_at = NOW(),
            approval_comments = $2
        WHERE id = ANY($3) AND school_id = $4 AND status = 'submitted'
        RETURNING id, category, description, amount
      `, [userId, comments, requestIds, schoolId]);

      res.json({
        success: true,
        message: `${result.rows.length} expense requests approved successfully`,
        data: {
          approvedCount: result.rows.length,
          approvedRequests: result.rows
        }
      });
    } catch (error) {
      console.error('Bulk approve expense requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk approve expense requests'
      });
    }
  }

  // =============================================================================
  // BUDGET TRACKING & ANALYTICS
  // =============================================================================

  static async getBudgetTracking(req, res) {
    try {
      const { budgetLine, period } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE school_id = $1';
      const params = [schoolId];

      if (budgetLine) {
        whereClause += ' AND budget_line = $2';
        params.push(budgetLine);
      }

      // Get budget tracking data
      const result = await query(`
        SELECT 
          budget_line,
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'approved' THEN approved_amount ELSE 0 END) as approved_amount,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
          SUM(CASE WHEN status = 'paid' THEN approved_amount ELSE 0 END) as paid_amount,
          AVG(CASE WHEN status = 'approved' THEN approved_amount ELSE NULL END) as avg_expense
        FROM expense_requests 
        ${whereClause}
        GROUP BY budget_line
        ORDER BY approved_amount DESC
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get budget tracking error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get budget tracking data'
      });
    }
  }

  static async getSpendingPatterns(req, res) {
    try {
      const { startDate, endDate, groupBy } = req.query;
      const schoolId = req.user.schoolId;

      let groupByClause = 'category';
      if (groupBy === 'month') {
        groupByClause = "DATE_TRUNC('month', created_at)";
      } else if (groupBy === 'week') {
        groupByClause = "DATE_TRUNC('week', created_at)";
      }

      let whereClause = 'WHERE school_id = $1';
      const params = [schoolId];

      if (startDate) {
        whereClause += ' AND created_at >= $2';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      const result = await query(`
        SELECT 
          ${groupByClause} as period,
          COUNT(*) as total_requests,
          SUM(approved_amount) as total_approved,
          AVG(approved_amount) as avg_amount,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority_count
        FROM expense_requests 
        ${whereClause} AND status = 'approved'
        GROUP BY ${groupByClause}
        ORDER BY ${groupByClause}
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get spending patterns error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get spending patterns'
      });
    }
  }

  static async getVarianceAnalysis(req, res) {
    try {
      const schoolId = req.user.schoolId;

      // Placeholder variance analysis
      const analysis = {
        budgetLines: [
          {
            name: 'Maintenance',
            budgeted: 50000,
            spent: 45000,
            variance: -5000,
            variancePercent: -10
          },
          {
            name: 'Utilities',
            budgeted: 30000,
            spent: 35000,
            variance: 5000,
            variancePercent: 16.67
          }
        ],
        summary: {
          totalBudgeted: 80000,
          totalSpent: 80000,
          totalVariance: 0,
          overBudgetLines: 1,
          underBudgetLines: 1
        }
      };

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Get variance analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get variance analysis'
      });
    }
  }

  static async getExpenseSummary(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE school_id = $1';
      const params = [schoolId];

      if (startDate) {
        whereClause += ' AND created_at >= $2';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          SUM(CASE WHEN status = 'approved' THEN approved_amount ELSE 0 END) as total_approved_amount,
          AVG(CASE WHEN status = 'approved' THEN approved_amount ELSE NULL END) as avg_approved_amount,
          MAX(CASE WHEN status = 'approved' THEN approved_amount ELSE NULL END) as max_approved_amount
        FROM expense_requests 
        ${whereClause}
      `, params);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get expense summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get expense summary'
      });
    }
  }

  // =============================================================================
  // EXPENSE CATEGORIES
  // =============================================================================

  static async getExpenseCategories(req, res) {
    try {
      const schoolId = req.user.schoolId;

      // Get categories with usage statistics
      const result = await query(`
        SELECT 
          category,
          COUNT(*) as usage_count,
          SUM(CASE WHEN status = 'approved' THEN approved_amount ELSE 0 END) as total_amount
        FROM expense_requests 
        WHERE school_id = $1
        GROUP BY category
        ORDER BY usage_count DESC
      `, [schoolId]);

      // Add default categories if none exist
      const defaultCategories = [
        'maintenance', 'utilities', 'supplies', 'transport', 'equipment',
        'services', 'insurance', 'training', 'marketing', 'administration'
      ];

      const existingCategories = result.rows.map(row => row.category);
      const missingCategories = defaultCategories.filter(cat => !existingCategories.includes(cat));

      const categories = [
        ...result.rows,
        ...missingCategories.map(cat => ({ category: cat, usage_count: 0, total_amount: 0 }))
      ];

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Get expense categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get expense categories'
      });
    }
  }

  static async createExpenseCategory(req, res) {
    try {
      const { name, description, budgetLimit } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      const result = await query(`
        INSERT INTO expense_categories (
          school_id, name, description, budget_limit, is_active, created_by, created_at
        ) VALUES ($1, $2, $3, $4, true, $5, NOW())
        RETURNING id, name, description, budget_limit, is_active
      `, [schoolId, name, description, budgetLimit, userId]);

      res.status(201).json({
        success: true,
        message: 'Expense category created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create expense category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create expense category'
      });
    }
  }
}

module.exports = ExpenseController;