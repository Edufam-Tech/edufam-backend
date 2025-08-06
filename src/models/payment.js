const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Payment {
  // Create new payment
  static async create(paymentData, createdBy) {
    try {
      const {
        schoolId,
        studentId,
        feeAssignmentId,
        amount,
        currency,
        paymentMethodId,
        referenceNumber,
        transactionId,
        paymentDate
      } = paymentData;

      // Validate required fields
      if (!schoolId || !studentId || !amount || !paymentMethodId || !paymentDate) {
        throw new ValidationError('School ID, student ID, amount, payment method ID, and payment date are required');
      }

      // Validate amount
      if (amount <= 0) {
        throw new ValidationError('Payment amount must be greater than 0');
      }

      // Validate currency
      if (currency && !['KES', 'USD', 'EUR'].includes(currency)) {
        throw new ValidationError('Invalid currency');
      }

      // Check if payment method exists and is active
      const paymentMethod = await query(
        'SELECT * FROM payment_methods WHERE id = $1 AND is_active = true',
        [paymentMethodId]
      );

      if (paymentMethod.rows.length === 0) {
        throw new NotFoundError('Payment method not found or inactive');
      }

      // Insert payment
      const result = await query(`
        INSERT INTO payments (
          school_id, student_id, fee_assignment_id, amount, currency,
          payment_method_id, reference_number, transaction_id, payment_date,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, studentId, feeAssignmentId, amount, currency || 'KES',
        paymentMethodId, referenceNumber, transactionId, paymentDate, createdBy
      ]);

      const newPayment = result.rows[0];

      // Log payment creation
      await this.logActivity(newPayment.id, 'PAYMENT_CREATED', {
        createdBy,
        schoolId,
        paymentData: { amount, currency, paymentMethodId }
      });

      return newPayment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to create payment');
    }
  }

  // Get payment by ID
  static async findById(paymentId) {
    try {
      const result = await query(`
        SELECT 
          p.*,
          s.name as school_name,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number,
          pm.name as payment_method_name,
          pm.method_type as payment_method_type,
          u.first_name || ' ' || u.last_name as created_by_name,
          r.first_name || ' ' || r.last_name as reconciled_by_name
        FROM payments p
        JOIN schools s ON p.school_id = s.id
        JOIN students st ON p.student_id = st.id
        JOIN payment_methods pm ON p.payment_method_id = pm.id
        JOIN users u ON p.created_by = u.id
        LEFT JOIN users r ON p.reconciled_by = r.id
        WHERE p.id = $1
      `, [paymentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Payment not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find payment');
    }
  }

  // Get payments for a student
  static async findByStudent(studentId, filters = {}) {
    try {
      let sql = `
        SELECT 
          p.*,
          pm.name as payment_method_name,
          pm.method_type as payment_method_type,
          u.first_name || ' ' || u.last_name as created_by_name,
          r.first_name || ' ' || r.last_name as reconciled_by_name
        FROM payments p
        JOIN payment_methods pm ON p.payment_method_id = pm.id
        JOIN users u ON p.created_by = u.id
        LEFT JOIN users r ON p.reconciled_by = r.id
        WHERE p.student_id = $1
      `;
      
      const params = [studentId];
      let paramCount = 1;

      // Apply filters
      if (filters.status) {
        paramCount++;
        sql += ` AND p.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.paymentMethodId) {
        paramCount++;
        sql += ` AND p.payment_method_id = $${paramCount}`;
        params.push(filters.paymentMethodId);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND p.payment_date >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND p.payment_date <= $${paramCount}`;
        params.push(filters.endDate);
      }

      if (filters.isReconciled !== undefined) {
        paramCount++;
        sql += ` AND p.is_reconciled = $${paramCount}`;
        params.push(filters.isReconciled);
      }

      // Add ordering
      sql += ` ORDER BY p.payment_date DESC, p.created_at DESC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to find student payments');
    }
  }

  // Get payments for a school
  static async findBySchool(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          p.*,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number,
          pm.name as payment_method_name,
          pm.method_type as payment_method_type,
          u.first_name || ' ' || u.last_name as created_by_name,
          r.first_name || ' ' || r.last_name as reconciled_by_name
        FROM payments p
        JOIN students st ON p.student_id = st.id
        JOIN payment_methods pm ON p.payment_method_id = pm.id
        JOIN users u ON p.created_by = u.id
        LEFT JOIN users r ON p.reconciled_by = r.id
        WHERE p.school_id = $1
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      // Apply filters
      if (filters.status) {
        paramCount++;
        sql += ` AND p.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.paymentMethodId) {
        paramCount++;
        sql += ` AND p.payment_method_id = $${paramCount}`;
        params.push(filters.paymentMethodId);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND p.payment_date >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND p.payment_date <= $${paramCount}`;
        params.push(filters.endDate);
      }

      if (filters.isReconciled !== undefined) {
        paramCount++;
        sql += ` AND p.is_reconciled = $${paramCount}`;
        params.push(filters.isReconciled);
      }

      // Add ordering
      sql += ` ORDER BY p.payment_date DESC, p.created_at DESC`;

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
      throw new DatabaseError('Failed to find school payments');
    }
  }

  // Update payment status
  static async updateStatus(paymentId, newStatus, updatedBy) {
    try {
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'];
      
      if (!validStatuses.includes(newStatus)) {
        throw new ValidationError('Invalid payment status');
      }

      const payment = await this.findById(paymentId);

      // Validate status transitions
      if (payment.status === 'completed' && newStatus !== 'refunded') {
        throw new ValidationError('Completed payments can only be refunded');
      }

      if (payment.status === 'cancelled' && newStatus !== 'cancelled') {
        throw new ValidationError('Cancelled payments cannot be modified');
      }

      const result = await query(`
        UPDATE payments 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [newStatus, paymentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Payment not found');
      }

      // Log status change
      await this.logActivity(paymentId, 'PAYMENT_STATUS_CHANGED', {
        updatedBy,
        oldStatus: payment.status,
        newStatus
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update payment status');
    }
  }

  // Reconcile payment
  static async reconcile(paymentId, reconciledBy, reconciliationNotes) {
    try {
      const payment = await this.findById(paymentId);

      if (payment.is_reconciled) {
        throw new ValidationError('Payment is already reconciled');
      }

      if (payment.status !== 'completed') {
        throw new ValidationError('Only completed payments can be reconciled');
      }

      const result = await query(`
        UPDATE payments 
        SET is_reconciled = true, reconciled_by = $1, reconciled_at = NOW(), 
            reconciliation_notes = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [reconciledBy, reconciliationNotes, paymentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Payment not found');
      }

      // Log reconciliation
      await this.logActivity(paymentId, 'PAYMENT_RECONCILED', {
        reconciledBy,
        reconciliationNotes
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to reconcile payment');
    }
  }

  // Get pending reconciliation payments
  static async getPendingReconciliation(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          p.*,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number,
          pm.name as payment_method_name,
          pm.method_type as payment_method_type,
          u.first_name || ' ' || u.last_name as created_by_name
        FROM payments p
        JOIN students st ON p.student_id = st.id
        JOIN payment_methods pm ON p.payment_method_id = pm.id
        JOIN users u ON p.created_by = u.id
        WHERE p.school_id = $1 AND p.status = 'completed' AND p.is_reconciled = false
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      // Apply filters
      if (filters.paymentMethodId) {
        paramCount++;
        sql += ` AND p.payment_method_id = $${paramCount}`;
        params.push(filters.paymentMethodId);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND p.payment_date >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND p.payment_date <= $${paramCount}`;
        params.push(filters.endDate);
      }

      // Add ordering
      sql += ` ORDER BY p.payment_date ASC, p.created_at ASC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get pending reconciliation payments');
    }
  }

  // Get payment statistics for a school
  static async getSchoolStatistics(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          COUNT(p.id) as total_payments,
          COUNT(p.id) FILTER (WHERE p.status = 'completed') as completed_payments,
          COUNT(p.id) FILTER (WHERE p.status = 'pending') as pending_payments,
          COUNT(p.id) FILTER (WHERE p.status = 'failed') as failed_payments,
          COUNT(p.id) FILTER (WHERE p.is_reconciled = true) as reconciled_payments,
          SUM(p.amount) FILTER (WHERE p.status = 'completed') as total_amount,
          AVG(p.amount) FILTER (WHERE p.status = 'completed') as average_amount,
          MIN(p.amount) FILTER (WHERE p.status = 'completed') as min_amount,
          MAX(p.amount) FILTER (WHERE p.status = 'completed') as max_amount
        FROM payments p
        WHERE p.school_id = $1
      `;
      
      const params = [schoolId];

      if (filters.startDate) {
        sql += ' AND p.payment_date >= $2';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND p.payment_date <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get payment statistics');
    }
  }

  // Get payment statistics for a student
  static async getStudentStatistics(studentId, filters = {}) {
    try {
      let sql = `
        SELECT 
          COUNT(p.id) as total_payments,
          COUNT(p.id) FILTER (WHERE p.status = 'completed') as completed_payments,
          COUNT(p.id) FILTER (WHERE p.status = 'pending') as pending_payments,
          COUNT(p.id) FILTER (WHERE p.status = 'failed') as failed_payments,
          SUM(p.amount) FILTER (WHERE p.status = 'completed') as total_amount,
          AVG(p.amount) FILTER (WHERE p.status = 'completed') as average_amount,
          MIN(p.payment_date) FILTER (WHERE p.status = 'completed') as first_payment_date,
          MAX(p.payment_date) FILTER (WHERE p.status = 'completed') as last_payment_date
        FROM payments p
        WHERE p.student_id = $1
      `;
      
      const params = [studentId];

      if (filters.startDate) {
        sql += ' AND p.payment_date >= $2';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND p.payment_date <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get student payment statistics');
    }
  }

  // Get payment methods for a school
  static async getPaymentMethods(schoolId) {
    try {
      const result = await query(`
        SELECT * FROM payment_methods 
        WHERE school_id = $1 AND is_active = true 
        ORDER BY name
      `, [schoolId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get payment methods');
    }
  }

  // Create payment method
  static async createPaymentMethod(methodData, createdBy) {
    try {
      const {
        schoolId,
        name,
        description,
        methodType,
        requiresReference,
        autoReconcile,
        config
      } = methodData;

      // Validate required fields
      if (!schoolId || !name || !methodType) {
        throw new ValidationError('School ID, name, and method type are required');
      }

      // Validate method type
      const validMethodTypes = ['mpesa', 'bank', 'cash', 'card', 'other'];
      if (!validMethodTypes.includes(methodType)) {
        throw new ValidationError('Invalid payment method type');
      }

      // Check if method already exists
      const existingMethod = await query(
        'SELECT id FROM payment_methods WHERE school_id = $1 AND name = $2',
        [schoolId, name]
      );

      if (existingMethod.rows.length > 0) {
        throw new ConflictError('Payment method with this name already exists');
      }

      // Insert payment method
      const result = await query(`
        INSERT INTO payment_methods (
          school_id, name, description, method_type, requires_reference,
          auto_reconcile, config, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, name, description, methodType, requiresReference || false,
        autoReconcile || false, config || '{}'
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create payment method');
    }
  }

  // Update payment method
  static async updatePaymentMethod(methodId, updateData) {
    try {
      const updateFields = [];
      const params = [];
      let paramCount = 0;

      // Build update query dynamically
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          paramCount++;
          updateFields.push(`${key} = $${paramCount}`);
          params.push(updateData[key]);
        }
      });

      if (updateFields.length === 0) {
        throw new ValidationError('No update data provided');
      }

      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      params.push(new Date());

      paramCount++;
      params.push(methodId);

      const result = await query(`
        UPDATE payment_methods 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Payment method not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update payment method');
    }
  }

  // Log payment activity
  static async logActivity(paymentId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.reconciledBy,
        action,
        'payments',
        paymentId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log payment activity:', error);
    }
  }

  // Validate payment data
  static validatePaymentData(paymentData) {
    const errors = [];

    if (!paymentData.schoolId) {
      errors.push('School ID is required');
    }

    if (!paymentData.studentId) {
      errors.push('Student ID is required');
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      errors.push('Payment amount must be greater than 0');
    }

    if (!paymentData.paymentMethodId) {
      errors.push('Payment method ID is required');
    }

    if (!paymentData.paymentDate) {
      errors.push('Payment date is required');
    }

    if (paymentData.currency && !['KES', 'USD', 'EUR'].includes(paymentData.currency)) {
      errors.push('Invalid currency');
    }

    return errors;
  }
}

module.exports = Payment; 