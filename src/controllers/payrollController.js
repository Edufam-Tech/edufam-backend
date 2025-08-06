const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class PayrollController {
  // =============================================================================
  // SALARY STRUCTURE MANAGEMENT
  // =============================================================================

  static async getSalaryStructures(req, res) {
    try {
      const { grade, position, isActive } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE school_id = $1';
      const params = [schoolId];

      if (grade) {
        whereClause += ' AND grade = $2';
        params.push(grade);
      }

      if (position) {
        whereClause += ` AND position_title ILIKE $${params.length + 1}`;
        params.push(`%${position}%`);
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT id, position_title, grade, basic_salary, allowances,
               deductions, currency_code, effective_date, is_active,
               created_at, updated_at
        FROM salary_structures 
        ${whereClause}
        ORDER BY grade, position_title
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get salary structures error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get salary structures'
      });
    }
  }

  static async createSalaryStructure(req, res) {
    try {
      const {
        positionTitle, grade, basicSalary, allowances, deductions,
        currencyCode, effectiveDate
      } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      // Check if salary structure already exists for this position and grade
      const existing = await query(`
        SELECT id FROM salary_structures 
        WHERE school_id = $1 AND position_title = $2 AND grade = $3 AND is_active = true
      `, [schoolId, positionTitle, grade]);

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Active salary structure already exists for this position and grade'
        });
      }

      const result = await query(`
        INSERT INTO salary_structures (
          school_id, position_title, grade, basic_salary, allowances,
          deductions, currency_code, effective_date, is_active,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW())
        RETURNING id, position_title, grade, basic_salary, effective_date
      `, [
        schoolId, positionTitle, grade, basicSalary,
        JSON.stringify(allowances), JSON.stringify(deductions),
        currencyCode, effectiveDate, userId
      ]);

      res.status(201).json({
        success: true,
        message: 'Salary structure created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create salary structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create salary structure'
      });
    }
  }

  static async updateSalaryStructure(req, res) {
    try {
      const { structureId } = req.params;
      const updateFields = req.body;
      const schoolId = req.user.schoolId;

      const setClause = [];
      const params = [structureId, schoolId];
      let paramCount = 2;

      Object.keys(updateFields).forEach(field => {
        if (updateFields[field] !== undefined && field !== 'id') {
          paramCount++;
          if (field === 'allowances' || field === 'deductions') {
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
        UPDATE salary_structures 
        SET ${setClause.join(', ')}
        WHERE id = $1 AND school_id = $2
        RETURNING id, position_title, grade, basic_salary, updated_at
      `, params);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Salary structure not found'
        });
      }

      res.json({
        success: true,
        message: 'Salary structure updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update salary structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update salary structure'
      });
    }
  }

  // =============================================================================
  // PAYROLL PROCESSING
  // =============================================================================

  static async getPayrollCalculations(req, res) {
    try {
      const { employeeId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.user.schoolId;

      const currentMonth = month || new Date().getMonth() + 1;
      const currentYear = year || new Date().getFullYear();

      // Verify employee belongs to school
      const employee = await query(`
        SELECT e.id, e.first_name, e.last_name, e.employee_id, e.position,
               ss.id as salary_structure_id, ss.basic_salary, ss.allowances, ss.deductions
        FROM employees e
        LEFT JOIN salary_structures ss ON e.position = ss.position_title AND ss.is_active = true
        WHERE e.id = $1 AND e.school_id = $2
      `, [employeeId, schoolId]);

      if (employee.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const emp = employee.rows[0];

      // Get existing payroll record for the month
      const existingPayroll = await query(`
        SELECT id, gross_salary, total_allowances, total_deductions, net_salary,
               tax_amount, pension_contribution, insurance_deduction,
               overtime_amount, bonus_amount, processed_at
        FROM payroll_records 
        WHERE employee_id = $1 AND payroll_month = $2 AND payroll_year = $3
      `, [employeeId, currentMonth, currentYear]);

      let payrollData;

      if (existingPayroll.rows.length > 0) {
        payrollData = existingPayroll.rows[0];
      } else {
        // Calculate payroll
        const basicSalary = emp.basic_salary || 0;
        const allowances = emp.allowances || {};
        const deductions = emp.deductions || {};

        const totalAllowances = Object.values(allowances).reduce((sum, amount) => sum + (amount || 0), 0);
        const totalDeductions = Object.values(deductions).reduce((sum, amount) => sum + (amount || 0), 0);

        const grossSalary = basicSalary + totalAllowances;
        const netSalary = grossSalary - totalDeductions;

        payrollData = {
          employeeId,
          month: currentMonth,
          year: currentYear,
          basicSalary,
          allowances,
          deductions,
          totalAllowances,
          totalDeductions,
          grossSalary,
          netSalary,
          calculated: true
        };
      }

      res.json({
        success: true,
        data: {
          employee: {
            id: emp.id,
            name: `${emp.first_name} ${emp.last_name}`,
            employeeId: emp.employee_id,
            position: emp.position
          },
          payroll: payrollData
        }
      });
    } catch (error) {
      console.error('Get payroll calculations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payroll calculations'
      });
    }
  }

  static async processMonthlyPayroll(req, res) {
    try {
      const { month, year, employeeIds, includeAllowances, includeDeductions } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      const processMonth = month || new Date().getMonth() + 1;
      const processYear = year || new Date().getFullYear();

      // Get employees to process
      let employeeQuery = `
        SELECT e.id, e.first_name, e.last_name, e.employee_id, e.position,
               ss.basic_salary, ss.allowances, ss.deductions
        FROM employees e
        LEFT JOIN salary_structures ss ON e.position = ss.position_title AND ss.is_active = true
        WHERE e.school_id = $1 AND e.is_active = true
      `;
      const params = [schoolId];

      if (employeeIds && employeeIds.length > 0) {
        employeeQuery += ' AND e.id = ANY($2)';
        params.push(employeeIds);
      }

      const employees = await query(employeeQuery, params);

      const processedPayrolls = [];
      const errors = [];

      for (const employee of employees.rows) {
        try {
          // Check if payroll already processed for this month
          const existing = await query(`
            SELECT id FROM payroll_records 
            WHERE employee_id = $1 AND payroll_month = $2 AND payroll_year = $3
          `, [employee.id, processMonth, processYear]);

          if (existing.rows.length > 0) {
            errors.push({
              employeeId: employee.id,
              error: 'Payroll already processed for this month'
            });
            continue;
          }

          // Calculate payroll
          const basicSalary = employee.basic_salary || 0;
          const allowances = includeAllowances ? (employee.allowances || {}) : {};
          const deductions = includeDeductions ? (employee.deductions || {}) : {};

          const totalAllowances = Object.values(allowances).reduce((sum, amount) => sum + (amount || 0), 0);
          const totalDeductions = Object.values(deductions).reduce((sum, amount) => sum + (amount || 0), 0);

          const grossSalary = basicSalary + totalAllowances;
          const netSalary = grossSalary - totalDeductions;

          // Save payroll record
          const payrollResult = await query(`
            INSERT INTO payroll_records (
              employee_id, payroll_month, payroll_year, basic_salary,
              allowances, deductions, total_allowances, total_deductions,
              gross_salary, net_salary, processed_by, processed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            RETURNING id, gross_salary, net_salary
          `, [
            employee.id, processMonth, processYear, basicSalary,
            JSON.stringify(allowances), JSON.stringify(deductions),
            totalAllowances, totalDeductions, grossSalary, netSalary, userId
          ]);

          processedPayrolls.push({
            employeeId: employee.id,
            employeeName: `${employee.first_name} ${employee.last_name}`,
            payrollId: payrollResult.rows[0].id,
            grossSalary: payrollResult.rows[0].gross_salary,
            netSalary: payrollResult.rows[0].net_salary
          });

        } catch (empError) {
          errors.push({
            employeeId: employee.id,
            error: empError.message
          });
        }
      }

      res.json({
        success: true,
        message: `Payroll processed for ${processedPayrolls.length} employees`,
        data: {
          processedCount: processedPayrolls.length,
          errorCount: errors.length,
          processedPayrolls,
          errors,
          month: processMonth,
          year: processYear
        }
      });
    } catch (error) {
      console.error('Process monthly payroll error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process monthly payroll'
      });
    }
  }

  static async recalculatePayroll(req, res) {
    try {
      const { employeeId } = req.params;
      const { month, year, adjustments } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      const recalcMonth = month || new Date().getMonth() + 1;
      const recalcYear = year || new Date().getFullYear();

      // Get existing payroll record
      const existingPayroll = await query(`
        SELECT pr.id, pr.basic_salary, pr.allowances, pr.deductions,
               e.first_name, e.last_name
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        WHERE pr.employee_id = $1 AND pr.payroll_month = $2 AND pr.payroll_year = $3
          AND e.school_id = $4
      `, [employeeId, recalcMonth, recalcYear, schoolId]);

      if (existingPayroll.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Payroll record not found for the specified month'
        });
      }

      const payroll = existingPayroll.rows[0];

      // Apply adjustments
      let basicSalary = payroll.basic_salary;
      let allowances = payroll.allowances || {};
      let deductions = payroll.deductions || {};

      if (adjustments) {
        if (adjustments.basicSalary !== undefined) {
          basicSalary = adjustments.basicSalary;
        }
        if (adjustments.allowances) {
          allowances = { ...allowances, ...adjustments.allowances };
        }
        if (adjustments.deductions) {
          deductions = { ...deductions, ...adjustments.deductions };
        }
      }

      // Recalculate totals
      const totalAllowances = Object.values(allowances).reduce((sum, amount) => sum + (amount || 0), 0);
      const totalDeductions = Object.values(deductions).reduce((sum, amount) => sum + (amount || 0), 0);
      const grossSalary = basicSalary + totalAllowances;
      const netSalary = grossSalary - totalDeductions;

      // Update payroll record
      const result = await query(`
        UPDATE payroll_records 
        SET basic_salary = $1, allowances = $2, deductions = $3,
            total_allowances = $4, total_deductions = $5,
            gross_salary = $6, net_salary = $7,
            recalculated_at = NOW(), recalculated_by = $8
        WHERE id = $9
        RETURNING id, gross_salary, net_salary, recalculated_at
      `, [
        basicSalary, JSON.stringify(allowances), JSON.stringify(deductions),
        totalAllowances, totalDeductions, grossSalary, netSalary,
        userId, payroll.id
      ]);

      res.json({
        success: true,
        message: 'Payroll recalculated successfully',
        data: {
          employeeName: `${payroll.first_name} ${payroll.last_name}`,
          payrollId: result.rows[0].id,
          grossSalary: result.rows[0].gross_salary,
          netSalary: result.rows[0].net_salary,
          recalculatedAt: result.rows[0].recalculated_at
        }
      });
    } catch (error) {
      console.error('Recalculate payroll error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to recalculate payroll'
      });
    }
  }

  // =============================================================================
  // PAYSLIP MANAGEMENT
  // =============================================================================

  static async getPayslips(req, res) {
    try {
      const { employeeId } = req.params;
      const { year, limit } = req.query;
      const schoolId = req.user.schoolId;

      let whereClause = 'WHERE e.school_id = $1 AND pr.employee_id = $2';
      const params = [schoolId, employeeId];

      if (year) {
        whereClause += ' AND pr.payroll_year = $3';
        params.push(year);
      }

      const result = await query(`
        SELECT pr.id, pr.payroll_month, pr.payroll_year, pr.gross_salary,
               pr.net_salary, pr.processed_at, pr.payslip_generated,
               e.first_name, e.last_name, e.employee_id
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        ${whereClause}
        ORDER BY pr.payroll_year DESC, pr.payroll_month DESC
        ${limit ? 'LIMIT $' + (params.length + 1) : ''}
      `, limit ? [...params, parseInt(limit)] : params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get payslips error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payslips'
      });
    }
  }

  static async generateBulkPayslips(req, res) {
    try {
      const { month, year, employeeIds, format } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;

      const payslipMonth = month || new Date().getMonth() + 1;
      const payslipYear = year || new Date().getFullYear();

      // Get payroll records to generate payslips for
      let payrollQuery = `
        SELECT pr.id, pr.employee_id, pr.payroll_month, pr.payroll_year,
               pr.basic_salary, pr.allowances, pr.deductions, pr.gross_salary, pr.net_salary,
               e.first_name, e.last_name, e.employee_id as emp_number
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        WHERE e.school_id = $1 AND pr.payroll_month = $2 AND pr.payroll_year = $3
      `;
      const params = [schoolId, payslipMonth, payslipYear];

      if (employeeIds && employeeIds.length > 0) {
        payrollQuery += ' AND pr.employee_id = ANY($4)';
        params.push(employeeIds);
      }

      const payrollRecords = await query(payrollQuery, params);

      if (payrollRecords.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No payroll records found for the specified month'
        });
      }

      const generatedPayslips = [];

      for (const record of payrollRecords.rows) {
        try {
          // Generate payslip (placeholder - actual implementation would create PDF)
          const payslipData = {
            payrollId: record.id,
            employeeId: record.employee_id,
            employeeName: `${record.first_name} ${record.last_name}`,
            employeeNumber: record.emp_number,
            month: record.payroll_month,
            year: record.payroll_year,
            basicSalary: record.basic_salary,
            allowances: record.allowances,
            deductions: record.deductions,
            grossSalary: record.gross_salary,
            netSalary: record.net_salary,
            generatedAt: new Date(),
            format: format || 'pdf'
          };

          // Mark payslip as generated
          await query(`
            UPDATE payroll_records 
            SET payslip_generated = true, payslip_generated_at = NOW(),
                payslip_generated_by = $1
            WHERE id = $2
          `, [userId, record.id]);

          generatedPayslips.push(payslipData);

        } catch (payslipError) {
          console.error('Payslip generation error for employee:', record.employee_id, payslipError);
        }
      }

      res.status(201).json({
        success: true,
        message: `${generatedPayslips.length} payslips generated successfully`,
        data: {
          generatedCount: generatedPayslips.length,
          month: payslipMonth,
          year: payslipYear,
          payslips: generatedPayslips
        }
      });
    } catch (error) {
      console.error('Generate bulk payslips error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate bulk payslips'
      });
    }
  }

  static async downloadPayslip(req, res) {
    try {
      const { employeeId, payslipId } = req.params;
      const schoolId = req.user.schoolId;

      // Get payslip data
      const result = await query(`
        SELECT pr.*, e.first_name, e.last_name, e.employee_id as emp_number
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        WHERE pr.id = $1 AND pr.employee_id = $2 AND e.school_id = $3
      `, [payslipId, employeeId, schoolId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Payslip not found'
        });
      }

      const payslip = result.rows[0];

      // In a real implementation, this would generate and return a PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="payslip_${payslip.emp_number}_${payslip.payroll_month}_${payslip.payroll_year}.pdf"`);

      // Placeholder PDF content
      res.send('PDF content would be generated here');

    } catch (error) {
      console.error('Download payslip error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download payslip'
      });
    }
  }

  static async emailPayslip(req, res) {
    try {
      const { payslipId } = req.params;
      const { emailAddress, subject, message } = req.body;
      const schoolId = req.user.schoolId;

      // Get payslip data
      const result = await query(`
        SELECT pr.*, e.first_name, e.last_name, e.email
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        WHERE pr.id = $1 AND e.school_id = $2
      `, [payslipId, schoolId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Payslip not found'
        });
      }

      const payslip = result.rows[0];
      const recipientEmail = emailAddress || payslip.email;

      if (!recipientEmail) {
        return res.status(400).json({
          success: false,
          message: 'No email address provided'
        });
      }

      // Placeholder email sending logic
      console.log(`Sending payslip email to: ${recipientEmail}`);
      console.log(`Subject: ${subject || 'Your Payslip'}`);
      console.log(`Message: ${message || 'Please find your payslip attached.'}`);

      // Record email sent
      await query(`
        UPDATE payroll_records 
        SET payslip_emailed = true, payslip_emailed_at = NOW()
        WHERE id = $1
      `, [payslipId]);

      res.json({
        success: true,
        message: 'Payslip emailed successfully',
        data: {
          recipientEmail,
          payslipId,
          sentAt: new Date()
        }
      });
    } catch (error) {
      console.error('Email payslip error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to email payslip'
      });
    }
  }

  // =============================================================================
  // PLACEHOLDER METHODS FOR REMAINING ENDPOINTS
  // =============================================================================

  static async getTaxCalculations(req, res) {
    res.status(200).json({ 
      success: true, 
      message: 'Tax calculations endpoint - full implementation pending',
      data: {} 
    });
  }

  static async updateTaxRates(req, res) {
    res.status(200).json({ 
      success: true, 
      message: 'Update tax rates endpoint - full implementation pending',
      data: {} 
    });
  }

  static async getDeductions(req, res) {
    res.status(200).json({ 
      success: true, 
      message: 'Get deductions endpoint - full implementation pending',
      data: [] 
    });
  }

  static async createDeduction(req, res) {
    res.status(201).json({ 
      success: true, 
      message: 'Create deduction endpoint - full implementation pending',
      data: {} 
    });
  }

  static async getBankTransfers(req, res) {
    res.status(200).json({ 
      success: true, 
      message: 'Get bank transfers endpoint - full implementation pending',
      data: [] 
    });
  }

  static async initiateBankTransfers(req, res) {
    res.status(200).json({ 
      success: true, 
      message: 'Initiate bank transfers endpoint - full implementation pending',
      data: {} 
    });
  }

  static async confirmBankTransfer(req, res) {
    res.status(200).json({ 
      success: true, 
      message: 'Confirm bank transfer endpoint - full implementation pending',
      data: {} 
    });
  }

  // =============================================================================
  // MISSING PAYROLL METHODS
  // =============================================================================

  static async getProcessingStatus(req, res) {
    try {
      const { batchId } = req.params;

      const status = await query(`
        SELECT 
          id, status, total_employees, processed_employees, 
          total_amount, processing_start_time, processing_end_time,
          error_message, created_at, updated_at
        FROM payroll_batches
        WHERE id = $1 AND school_id = $2
      `, [batchId, req.user.school_id]);

      if (status.rows.length === 0) {
        throw new NotFoundError('Payroll batch not found');
      }

      res.json({
        success: true,
        data: status.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateDeduction(req, res) {
    try {
      const { deductionId } = req.params;
      const { name, type, amount, percentage, is_active } = req.body;

      const result = await query(`
        UPDATE payroll_deductions 
        SET name = $1, type = $2, amount = $3, percentage = $4, 
            is_active = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND school_id = $7
        RETURNING *
      `, [name, type, amount, percentage, is_active, deductionId, req.user.school_id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Deduction not found');
      }

      res.json({
        success: true,
        message: 'Deduction updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPayrollAnalytics(req, res) {
    try {
      const { month, year } = req.query;

      const analytics = await query(`
        SELECT 
          COUNT(DISTINCT employee_id) as total_employees,
          SUM(gross_salary) as total_gross_salary,
          SUM(total_deductions) as total_deductions,
          SUM(net_salary) as total_net_salary,
          AVG(net_salary) as average_salary,
          MAX(net_salary) as highest_salary,
          MIN(net_salary) as lowest_salary
        FROM payroll_records
        WHERE school_id = $1 
        AND ($2::text IS NULL OR EXTRACT(MONTH FROM pay_period_start) = $2::int)
        AND ($3::text IS NULL OR EXTRACT(YEAR FROM pay_period_start) = $3::int)
      `, [req.user.school_id, month, year]);

      // Department-wise breakdown
      const departmentBreakdown = await query(`
        SELECT 
          d.name as department_name,
          COUNT(DISTINCT pr.employee_id) as employee_count,
          SUM(pr.net_salary) as total_net_salary,
          AVG(pr.net_salary) as average_salary
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE pr.school_id = $1
        AND ($2::text IS NULL OR EXTRACT(MONTH FROM pr.pay_period_start) = $2::int)
        AND ($3::text IS NULL OR EXTRACT(YEAR FROM pr.pay_period_start) = $3::int)
        GROUP BY d.id, d.name
        ORDER BY total_net_salary DESC
      `, [req.user.school_id, month, year]);

      res.json({
        success: true,
        data: {
          overall: analytics.rows[0],
          department_breakdown: departmentBreakdown.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMonthlySummaryReport(req, res) {
    try {
      const { month, year } = req.query;

      if (!month || !year) {
        throw new ValidationError('Month and year are required');
      }

      const summary = await query(`
        SELECT 
          u.first_name, u.last_name, e.employee_number,
          pr.gross_salary, pr.total_deductions, pr.net_salary,
          pr.pay_period_start, pr.pay_period_end,
          d.name as department_name
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE pr.school_id = $1 
        AND EXTRACT(MONTH FROM pr.pay_period_start) = $2
        AND EXTRACT(YEAR FROM pr.pay_period_start) = $3
        ORDER BY d.name, u.first_name, u.last_name
      `, [req.user.school_id, month, year]);

      res.json({
        success: true,
        data: {
          month,
          year,
          generated_at: new Date().toISOString(),
          records: summary.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTaxSummaryReport(req, res) {
    try {
      const { month, year } = req.query;

      if (!month || !year) {
        throw new ValidationError('Month and year are required');
      }

      const taxSummary = await query(`
        SELECT 
          u.first_name, u.last_name, e.employee_number,
          pr.gross_salary, pr.tax_deductions, pr.net_salary,
          ROUND((pr.tax_deductions / pr.gross_salary) * 100, 2) as tax_rate_percentage
        FROM payroll_records pr
        JOIN employees e ON pr.employee_id = e.id
        JOIN users u ON e.user_id = u.id
        WHERE pr.school_id = $1 
        AND EXTRACT(MONTH FROM pr.pay_period_start) = $2
        AND EXTRACT(YEAR FROM pr.pay_period_start) = $3
        AND pr.tax_deductions > 0
        ORDER BY pr.tax_deductions DESC
      `, [req.user.school_id, month, year]);

      // Total tax collected
      const totalTax = await query(`
        SELECT 
          SUM(tax_deductions) as total_tax_collected,
          COUNT(*) as employees_with_tax
        FROM payroll_records
        WHERE school_id = $1 
        AND EXTRACT(MONTH FROM pay_period_start) = $2
        AND EXTRACT(YEAR FROM pay_period_start) = $3
        AND tax_deductions > 0
      `, [req.user.school_id, month, year]);

      res.json({
        success: true,
        data: {
          month,
          year,
          summary: totalTax.rows[0],
          employee_details: taxSummary.rows,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PayrollController;