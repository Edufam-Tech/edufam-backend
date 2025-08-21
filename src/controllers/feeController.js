const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');
const { query } = require('../config/database');

class FeeController {
  // Fee Structure Management
  static async createFeeStructure(req, res) {
    try {
      const feeStructureData = {
        ...req.body,
        school_id: req.user.school_id,
        created_by: req.user.id
      };

      const insertQuery = `
        INSERT INTO fee_structures (name, description, academic_year_id, school_id, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [
        feeStructureData.name,
        feeStructureData.description,
        feeStructureData.academic_year_id,
        feeStructureData.school_id,
        feeStructureData.created_by
      ]);

      res.status(201).json({
        success: true,
        message: 'Fee structure created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create fee structure'
      });
    }
  }

  static async getFeeStructures(req, res) {
    try {
      const { page = 1, limit = 10, academic_year_id } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let whereClause = 'WHERE school_id = $1';
      let queryParams = [req.user.school_id];

      if (academic_year_id) {
        whereClause += ' AND academic_year_id = $2';
        queryParams.push(academic_year_id);
      }

      const selectQuery = `
        SELECT * FROM fee_structures 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;

      queryParams.push(parseInt(limit), offset);
      const result = await query(selectQuery, queryParams);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.rowCount
        }
      });
    } catch (error) {
      console.error('Get fee structures error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get fee structures'
      });
    }
  }

  static async getFeeStructure(req, res) {
    try {
      const { id } = req.params;

      const selectQuery = `
        SELECT * FROM fee_structures 
        WHERE id = $1 AND school_id = $2
      `;

      const result = await query(selectQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get fee structure'
      });
    }
  }

  static async updateFeeStructure(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updateQuery = `
        UPDATE fee_structures 
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            academic_year_id = COALESCE($3, academic_year_id),
            updated_at = NOW(),
            updated_by = $4
        WHERE id = $5 AND school_id = $6
        RETURNING *
      `;

      const result = await query(updateQuery, [
        updateData.name,
        updateData.description,
        updateData.academic_year_id,
        req.user.id,
        id,
        req.user.school_id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      res.json({
        success: true,
        message: 'Fee structure updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update fee structure'
      });
    }
  }

  static async deleteFeeStructure(req, res) {
    try {
      const { id } = req.params;

      const deleteQuery = `
        DELETE FROM fee_structures 
        WHERE id = $1 AND school_id = $2
        RETURNING id
      `;

      const result = await query(deleteQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      res.json({
        success: true,
        message: 'Fee structure deleted successfully'
      });
    } catch (error) {
      console.error('Delete fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete fee structure'
      });
    }
  }

  // Fee Assignment
  static async assignFees(req, res) {
    try {
      const assignmentData = {
        ...req.body,
        school_id: req.user.school_id,
        assigned_by: req.user.id
      };

      const insertQuery = `
        INSERT INTO fee_assignments (student_id, fee_structure_id, amount, due_date, school_id, assigned_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [
        assignmentData.student_id,
        assignmentData.fee_structure_id,
        assignmentData.amount,
        assignmentData.due_date,
        assignmentData.school_id,
        assignmentData.assigned_by
      ]);

      res.status(201).json({
        success: true,
        message: 'Fee assigned successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Assign fees error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign fees'
      });
    }
  }

  static async getPendingAssignments(req, res) {
    try {
      const selectQuery = `
        SELECT fa.*, fs.name as fee_structure_name, s.first_name, s.last_name
        FROM fee_assignments fa
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        JOIN students s ON fa.student_id = s.id
        WHERE fa.school_id = $1 AND fa.status = 'pending'
        ORDER BY fa.created_at DESC
      `;

      const result = await query(selectQuery, [req.user.school_id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get pending assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending assignments'
      });
    }
  }

  // List all fee assignments with basic filters to satisfy frontend
  static async getFeeAssignments(req, res) {
    try {
      const { status, assignment_type, academic_year, page = 1, limit = 20 } = req.query;
      const params = [req.user.school_id];
      let where = 'WHERE school_id = $1';
      let idx = 2;
      if (status) { where += ` AND status = $${idx++}`; params.push(status); }
      if (assignment_type) { where += ` AND assignment_type = $${idx++}`; params.push(assignment_type); }
      if (academic_year) { where += ` AND academic_year = $${idx++}`; params.push(academic_year); }
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      
      // Use COALESCE to handle missing columns gracefully
      const sql = `
        SELECT 
          id, 
          COALESCE(assignment_name, 'Fee Assignment ' || id::text) as assignment_name,
          assignment_code, 
          assignment_type, 
          curriculum_type,
          academic_year, 
          academic_term, 
          total_amount, 
          status, 
          COALESCE(execution_status, 'pending') as execution_status,
          created_by, 
          created_at, 
          approved_by, 
          approved_at
        FROM fee_assignments
        ${where}
        ORDER BY created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `;
      params.push(parseInt(limit, 10), offset);
      const result = await query(sql, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get fee assignments error:', error);
      res.status(500).json({ success: false, message: 'Failed to get fee assignments' });
    }
  }

  static async approveAssignment(req, res) {
    try {
      const { id } = req.params;

      const updateQuery = `
        UPDATE fee_assignments 
        SET status = 'approved', approved_by = $1, approved_at = NOW()
        WHERE id = $2 AND school_id = $3
        RETURNING *
      `;

      const result = await query(updateQuery, [req.user.id, id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee assignment not found'
        });
      }

      res.json({
        success: true,
        message: 'Fee assignment approved successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Approve assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve assignment'
      });
    }
  }

  static async rejectAssignment(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const updateQuery = `
        UPDATE fee_assignments 
        SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2
        WHERE id = $3 AND school_id = $4
        RETURNING *
      `;

      const result = await query(updateQuery, [req.user.id, reason, id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee assignment not found'
        });
      }

      res.json({
        success: true,
        message: 'Fee assignment rejected successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Reject assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject assignment'
      });
    }
  }

  static async getStudentFees(req, res) {
    try {
      const { studentId } = req.params;

      const selectQuery = `
        SELECT fa.*, fs.name as fee_structure_name
        FROM fee_assignments fa
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        WHERE fa.student_id = $1 AND fa.school_id = $2
        ORDER BY fa.due_date ASC
      `;

      const result = await query(selectQuery, [studentId, req.user.school_id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get student fees error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get student fees'
      });
    }
  }

  // Discounts
  static async createDiscount(req, res) {
    try {
      const discountData = {
        ...req.body,
        school_id: req.user.school_id,
        created_by: req.user.id
      };

      const insertQuery = `
        INSERT INTO fee_discounts (name, type, value, description, school_id, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [
        discountData.name,
        discountData.type,
        discountData.value,
        discountData.description,
        discountData.school_id,
        discountData.created_by
      ]);

      res.status(201).json({
        success: true,
        message: 'Discount created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create discount error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create discount'
      });
    }
  }

  static async getDiscounts(req, res) {
    try {
      const selectQuery = `
        SELECT * FROM fee_discounts 
        WHERE school_id = $1
        ORDER BY created_at DESC
      `;

      const result = await query(selectQuery, [req.user.school_id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get discounts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get discounts'
      });
    }
  }

  static async getDiscount(req, res) {
    try {
      const { id } = req.params;

      const selectQuery = `
        SELECT * FROM fee_discounts 
        WHERE id = $1 AND school_id = $2
      `;

      const result = await query(selectQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Discount not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get discount error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get discount'
      });
    }
  }

  static async updateDiscount(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updateQuery = `
        UPDATE fee_discounts 
        SET name = COALESCE($1, name),
            type = COALESCE($2, type),
            value = COALESCE($3, value),
            description = COALESCE($4, description),
            updated_at = NOW(),
            updated_by = $5
        WHERE id = $6 AND school_id = $7
        RETURNING *
      `;

      const result = await query(updateQuery, [
        updateData.name,
        updateData.type,
        updateData.value,
        updateData.description,
        req.user.id,
        id,
        req.user.school_id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Discount not found'
        });
      }

      res.json({
        success: true,
        message: 'Discount updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update discount error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update discount'
      });
    }
  }

  static async deleteDiscount(req, res) {
    try {
      const { id } = req.params;

      const deleteQuery = `
        DELETE FROM fee_discounts 
        WHERE id = $1 AND school_id = $2
        RETURNING id
      `;

      const result = await query(deleteQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Discount not found'
        });
      }

      res.json({
        success: true,
        message: 'Discount deleted successfully'
      });
    } catch (error) {
      console.error('Delete discount error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete discount'
      });
    }
  }

  // Waivers
  static async createWaiver(req, res) {
    try {
      const waiverData = {
        ...req.body,
        school_id: req.user.school_id,
        created_by: req.user.id
      };

      const insertQuery = `
        INSERT INTO fee_waivers (student_id, fee_structure_id, waiver_type, amount, reason, school_id, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [
        waiverData.student_id,
        waiverData.fee_structure_id,
        waiverData.waiver_type,
        waiverData.amount,
        waiverData.reason,
        waiverData.school_id,
        waiverData.created_by
      ]);

      res.status(201).json({
        success: true,
        message: 'Waiver created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create waiver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create waiver'
      });
    }
  }

  static async getWaivers(req, res) {
    try {
      const selectQuery = `
        SELECT fw.*, s.first_name, s.last_name, fs.name as fee_structure_name
        FROM fee_waivers fw
        JOIN students s ON fw.student_id = s.id
        JOIN fee_structures fs ON fw.fee_structure_id = fs.id
        WHERE fw.school_id = $1
        ORDER BY fw.created_at DESC
      `;

      const result = await query(selectQuery, [req.user.school_id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get waivers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get waivers'
      });
    }
  }

  static async getWaiver(req, res) {
    try {
      const { id } = req.params;

      const selectQuery = `
        SELECT fw.*, s.first_name, s.last_name, fs.name as fee_structure_name
        FROM fee_waivers fw
        JOIN students s ON fw.student_id = s.id
        JOIN fee_structures fs ON fw.fee_structure_id = fs.id
        WHERE fw.id = $1 AND fw.school_id = $2
      `;

      const result = await query(selectQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Waiver not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get waiver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get waiver'
      });
    }
  }

  static async updateWaiver(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updateQuery = `
        UPDATE fee_waivers 
        SET waiver_type = COALESCE($1, waiver_type),
            amount = COALESCE($2, amount),
            reason = COALESCE($3, reason),
            updated_at = NOW(),
            updated_by = $4
        WHERE id = $5 AND school_id = $6
        RETURNING *
      `;

      const result = await query(updateQuery, [
        updateData.waiver_type,
        updateData.amount,
        updateData.reason,
        req.user.id,
        id,
        req.user.school_id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Waiver not found'
        });
      }

      res.json({
        success: true,
        message: 'Waiver updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update waiver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update waiver'
      });
    }
  }

  static async deleteWaiver(req, res) {
    try {
      const { id } = req.params;

      const deleteQuery = `
        DELETE FROM fee_waivers 
        WHERE id = $1 AND school_id = $2
        RETURNING id
      `;

      const result = await query(deleteQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Waiver not found'
        });
      }

      res.json({
        success: true,
        message: 'Waiver deleted successfully'
      });
    } catch (error) {
      console.error('Delete waiver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete waiver'
      });
    }
  }

  // Fee Categories
  static async createFeeCategory(req, res) {
    try {
      const categoryData = {
        ...req.body,
        school_id: req.user.school_id,
        created_by: req.user.id
      };

      const insertQuery = `
        INSERT INTO fee_categories (name, description, is_mandatory, school_id, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [
        categoryData.name,
        categoryData.description,
        categoryData.is_mandatory || false,
        categoryData.school_id,
        categoryData.created_by
      ]);

      res.status(201).json({
        success: true,
        message: 'Fee category created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create fee category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create fee category'
      });
    }
  }

  static async getFeeCategories(req, res) {
    try {
      const selectQuery = `
        SELECT * FROM fee_categories 
        WHERE school_id = $1
        ORDER BY name ASC
      `;

      const result = await query(selectQuery, [req.user.school_id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get fee categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get fee categories'
      });
    }
  }

  static async getFeeCategory(req, res) {
    try {
      const { id } = req.params;

      const selectQuery = `
        SELECT * FROM fee_categories 
        WHERE id = $1 AND school_id = $2
      `;

      const result = await query(selectQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee category not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get fee category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get fee category'
      });
    }
  }

  static async updateFeeCategory(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updateQuery = `
        UPDATE fee_categories 
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            is_mandatory = COALESCE($3, is_mandatory),
            updated_at = NOW(),
            updated_by = $4
        WHERE id = $5 AND school_id = $6
        RETURNING *
      `;

      const result = await query(updateQuery, [
        updateData.name,
        updateData.description,
        updateData.is_mandatory,
        req.user.id,
        id,
        req.user.school_id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee category not found'
        });
      }

      res.json({
        success: true,
        message: 'Fee category updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update fee category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update fee category'
      });
    }
  }

  static async deleteFeeCategory(req, res) {
    try {
      const { id } = req.params;

      const deleteQuery = `
        DELETE FROM fee_categories 
        WHERE id = $1 AND school_id = $2
        RETURNING id
      `;

      const result = await query(deleteQuery, [id, req.user.school_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Fee category not found'
        });
      }

      res.json({
        success: true,
        message: 'Fee category deleted successfully'
      });
    } catch (error) {
      console.error('Delete fee category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete fee category'
      });
    }
  }

  // Reports and Utilities
  static async generateFeeStatement(req, res) {
    try {
      const { studentId } = req.params;
      const { academic_year_id } = req.query;

      const statementQuery = `
        SELECT 
          s.first_name, s.last_name, s.admission_number,
          fa.amount, fa.due_date, fa.status as assignment_status,
          fs.name as fee_structure_name,
          COALESCE(SUM(p.amount), 0) as paid_amount,
          (fa.amount - COALESCE(SUM(p.amount), 0)) as balance
        FROM fee_assignments fa
        JOIN students s ON fa.student_id = s.id
        JOIN fee_structures fs ON fa.fee_structure_id = fs.id
        LEFT JOIN payments p ON p.fee_assignment_id = fa.id AND p.status = 'completed'
        WHERE s.id = $1 AND fa.school_id = $2
        ${academic_year_id ? 'AND fs.academic_year_id = $3' : ''}
        GROUP BY s.id, fa.id, fs.id
        ORDER BY fa.due_date ASC
      `;

      const params = [studentId, req.user.school_id];
      if (academic_year_id) params.push(academic_year_id);

      const result = await query(statementQuery, params);

      res.json({
        success: true,
        data: {
          student: result.rows[0] ? {
            first_name: result.rows[0].first_name,
            last_name: result.rows[0].last_name,
            admission_number: result.rows[0].admission_number
          } : null,
          fees: result.rows,
          summary: {
            total_fees: result.rows.reduce((sum, fee) => sum + parseFloat(fee.amount), 0),
            total_paid: result.rows.reduce((sum, fee) => sum + parseFloat(fee.paid_amount), 0),
            total_balance: result.rows.reduce((sum, fee) => sum + parseFloat(fee.balance), 0)
          }
        }
      });
    } catch (error) {
      console.error('Generate fee statement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate fee statement'
      });
    }
  }

  static async bulkAssignFees(req, res) {
    try {
      const { assignments } = req.body;

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Assignments array is required'
        });
      }

      const insertQuery = `
        INSERT INTO fee_assignments (student_id, fee_structure_id, amount, due_date, school_id, assigned_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const results = [];
      for (const assignment of assignments) {
        try {
          const result = await query(insertQuery, [
            assignment.student_id,
            assignment.fee_structure_id,
            assignment.amount,
            assignment.due_date,
            req.user.school_id,
            req.user.id
          ]);
          results.push({ success: true, data: result.rows[0] });
        } catch (error) {
          results.push({ success: false, error: error.message, assignment });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.status(201).json({
        success: true,
        message: `Bulk assignment completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          successCount,
          failureCount,
          results
        }
      });
    } catch (error) {
      console.error('Bulk assign fees error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk assign fees'
      });
    }
  }

  // =============================================================================
  // MISSING FEE ASSIGNMENT WORKFLOW METHODS
  // =============================================================================

  static async submitAssignmentForApproval(req, res) {
    res.status(201).json({ success: true, message: 'Submit assignment for approval - implementation pending', data: {} });
  }

  static async getAssignmentHistory(req, res) {
    res.status(200).json({ success: true, message: 'Get assignment history - implementation pending', data: [] });
  }

  static async getFeeAssignmentAnalytics(req, res) {
    res.status(200).json({ success: true, message: 'Get fee assignment analytics - implementation pending', data: {} });
  }

  static async getFeeTemplates(req, res) {
    try {
      const { query } = require('../config/database');
      const { curriculumType, gradeLevel, active } = req.query;
      let where = 'WHERE school_id = $1';
      const params = [req.user.school_id];
      let idx = 2;
      if (curriculumType) { where += ` AND curriculum_type = $${idx++}`; params.push(curriculumType); }
      if (gradeLevel) { where += ` AND grade_level = $${idx++}`; params.push(gradeLevel); }
      if (typeof active !== 'undefined') { where += ` AND is_active = $${idx++}`; params.push(active === 'true'); }
      const sql = `
        SELECT id, name, curriculum_type, grade_level, fees, is_active, created_at, updated_at
        FROM fee_templates
        ${where}
        ORDER BY created_at DESC
      `;
      const result = await query(sql, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get fee templates error:', error);
      res.status(500).json({ success: false, message: 'Failed to get fee templates' });
    }
  }

  static async createFeeTemplate(req, res) {
    try {
      const { query } = require('../config/database');
      const { name, curriculumType, gradeLevel, fees, isActive } = req.body;
      if (!name || !curriculumType || !gradeLevel || !Array.isArray(fees)) {
        return res.status(400).json({ success: false, message: 'name, curriculumType, gradeLevel, and fees[] are required' });
      }
      const sql = `
        INSERT INTO fee_templates (name, curriculum_type, grade_level, fees, is_active, school_id, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, name, curriculum_type, grade_level, fees, is_active, created_at
      `;
      const result = await query(sql, [
        name, curriculumType, gradeLevel, JSON.stringify(fees), !!isActive, req.user.school_id, req.user.id,
      ]);
      res.status(201).json({ success: true, message: 'Fee template created successfully', data: result.rows[0] });
    } catch (error) {
      console.error('Create fee template error:', error);
      res.status(500).json({ success: false, message: 'Failed to create fee template' });
    }
  }

  static async getTemplatesByCurriculum(req, res) {
    try {
      const { query } = require('../config/database');
      const { curriculumType } = req.params;
      const { gradeLevel } = req.query;
      if (!curriculumType) {
        return res.status(400).json({ success: false, message: 'curriculumType is required' });
      }
      let where = 'WHERE school_id = $1 AND curriculum_type = $2';
      const params = [req.user.school_id, curriculumType];
      if (gradeLevel) { where += ' AND grade_level = $3'; params.push(gradeLevel); }
      const sql = `
        SELECT id, name, curriculum_type, grade_level, fees, is_active, created_at, updated_at
        FROM fee_templates
        ${where}
        ORDER BY grade_level, name
      `;
      const result = await query(sql, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get templates by curriculum error:', error);
      res.status(500).json({ success: false, message: 'Failed to get templates by curriculum' });
    }
  }

  static async duplicateTemplate(req, res) {
    try {
      const { query } = require('../config/database');
      const { templateId, newName } = req.body;
      if (!templateId || !newName) {
        return res.status(400).json({ success: false, message: 'templateId and newName are required' });
      }
      const src = await query(
        'SELECT * FROM fee_templates WHERE id = $1 AND school_id = $2',
        [templateId, req.user.school_id]
      );
      if (src.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Source template not found' });
      }
      const t = src.rows[0];
      const ins = await query(
        `INSERT INTO fee_templates (name, curriculum_type, grade_level, fees, is_active, school_id, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id, name, curriculum_type, grade_level, fees, is_active, created_at`,
        [newName, t.curriculum_type, t.grade_level, t.fees, t.is_active, t.school_id, req.user.id]
      );
      res.status(201).json({ success: true, message: 'Template duplicated successfully', data: ins.rows[0] });
    } catch (error) {
      console.error('Duplicate fee template error:', error);
      res.status(500).json({ success: false, message: 'Failed to duplicate fee template' });
    }
  }

  static async bulkAssignFeesByClass(req, res) {
    res.status(201).json({ success: true, message: 'Bulk assign fees by class - implementation pending', data: {} });
  }

  static async applyIndividualAdjustments(req, res) {
    res.status(200).json({ success: true, message: 'Apply individual adjustments - implementation pending', data: {} });
  }

  static async getDiscountsAndScholarships(req, res) {
    res.status(200).json({ success: true, message: 'Get discounts and scholarships - implementation pending', data: [] });
  }

  static async calculateLateFees(req, res) {
    res.status(200).json({ success: true, message: 'Calculate late fees - implementation pending', data: {} });
  }
}

module.exports = FeeController;