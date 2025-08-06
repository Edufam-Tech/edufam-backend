const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class School {
  // Create new school
  static async create(schoolData, createdBy) {
    try {
      const {
        name,
        code,
        address,
        phone,
        email,
        website,
        logoUrl,
        subscriptionType = 'monthly',
        pricePerStudent = 100.00,
        currency = 'KES',
        maxStudents,
        billingCycleStart = new Date(),
        autoBilling = true,
        trialEndDate
      } = schoolData;

      // Validate required fields
      if (!name || !code || !email) {
        throw new ValidationError('School name, code, and email are required');
      }

      // Check if school code already exists
      const existingSchool = await query(
        'SELECT id FROM schools WHERE code = $1',
        [code]
      );

      if (existingSchool.rows.length > 0) {
        throw new ConflictError('School code already exists');
      }

      // Check if email already exists
      const existingEmail = await query(
        'SELECT id FROM schools WHERE email = $1',
        [email]
      );

      if (existingEmail.rows.length > 0) {
        throw new ConflictError('School email already exists');
      }

      // Calculate next billing date
      const nextBillingDate = new Date(billingCycleStart);
      switch (subscriptionType) {
        case 'monthly':
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          break;
        case 'termly':
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
          break;
        case 'yearly':
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
          break;
      }

      // Insert school
      const result = await query(`
        INSERT INTO schools (
          name, code, address, phone, email, website, logo_url,
          subscription_type, price_per_student, currency, max_students,
          billing_cycle_start, next_billing_date, auto_billing,
          trial_end_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING *
      `, [
        name, code, address, phone, email, website, logoUrl,
        subscriptionType, pricePerStudent, currency, maxStudents,
        billingCycleStart, nextBillingDate, autoBilling, trialEndDate
      ]);

      const newSchool = result.rows[0];

      // Log school creation
      await this.logSchoolActivity(newSchool.id, 'SCHOOL_CREATED', {
        createdBy,
        schoolData: { name, code, email, subscriptionType }
      });

      return newSchool;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create school');
    }
  }

  // Get school by ID
  static async findById(schoolId) {
    try {
      const result = await query(`
        SELECT * FROM schools WHERE id = $1 AND is_active = true
      `, [schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find school');
    }
  }

  // Get school by code
  static async findByCode(code) {
    try {
      const result = await query(`
        SELECT * FROM schools WHERE code = $1 AND is_active = true
      `, [code]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find school');
    }
  }

  // Get all schools with pagination and filters
  static async findAll(filters = {}, pagination = {}) {
    try {
      const {
        search,
        subscriptionStatus,
        subscriptionType,
        isActive = true
      } = filters;

      const { page = 1, limit = 10 } = pagination;
      const offset = (page - 1) * limit;

      let whereConditions = ['is_active = $1'];
      let params = [isActive];
      let paramIndex = 2;

      if (search) {
        whereConditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (subscriptionStatus) {
        whereConditions.push(`subscription_status = $${paramIndex}`);
        params.push(subscriptionStatus);
        paramIndex++;
      }

      if (subscriptionType) {
        whereConditions.push(`subscription_type = $${paramIndex}`);
        params.push(subscriptionType);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM schools WHERE ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get schools
      const result = await query(`
        SELECT * FROM schools 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      return {
        schools: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to fetch schools');
    }
  }

  // Update school
  static async update(schoolId, updateData, updatedBy) {
    try {
      const {
        name,
        address,
        phone,
        email,
        website,
        logoUrl,
        subscriptionType,
        pricePerStudent,
        currency,
        maxStudents,
        autoBilling,
        subscriptionStatus
      } = updateData;

      // Check if school exists
      const existingSchool = await this.findById(schoolId);

      // Check if email is being changed and if it already exists
      if (email && email !== existingSchool.email) {
        const emailExists = await query(
          'SELECT id FROM schools WHERE email = $1 AND id != $2',
          [email, schoolId]
        );

        if (emailExists.rows.length > 0) {
          throw new ConflictError('Email already exists');
        }
      }

      // Build update query dynamically
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        params.push(name);
      }

      if (address !== undefined) {
        updateFields.push(`address = $${paramIndex++}`);
        params.push(address);
      }

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex++}`);
        params.push(phone);
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        params.push(email);
      }

      if (website !== undefined) {
        updateFields.push(`website = $${paramIndex++}`);
        params.push(website);
      }

      if (logoUrl !== undefined) {
        updateFields.push(`logo_url = $${paramIndex++}`);
        params.push(logoUrl);
      }

      if (subscriptionType !== undefined) {
        updateFields.push(`subscription_type = $${paramIndex++}`);
        params.push(subscriptionType);
      }

      if (pricePerStudent !== undefined) {
        updateFields.push(`price_per_student = $${paramIndex++}`);
        params.push(pricePerStudent);
      }

      if (currency !== undefined) {
        updateFields.push(`currency = $${paramIndex++}`);
        params.push(currency);
      }

      if (maxStudents !== undefined) {
        updateFields.push(`max_students = $${paramIndex++}`);
        params.push(maxStudents);
      }

      if (autoBilling !== undefined) {
        updateFields.push(`auto_billing = $${paramIndex++}`);
        params.push(autoBilling);
      }

      if (subscriptionStatus !== undefined) {
        updateFields.push(`subscription_status = $${paramIndex++}`);
        params.push(subscriptionStatus);
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(schoolId);

      const result = await query(`
        UPDATE schools 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      const updatedSchool = result.rows[0];

      // Log school update
      await this.logSchoolActivity(schoolId, 'SCHOOL_UPDATED', {
        updatedBy,
        updatedFields: Object.keys(updateData)
      });

      return updatedSchool;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to update school');
    }
  }

  // Deactivate school
  static async deactivate(schoolId, deactivatedBy) {
    try {
      const result = await query(`
        UPDATE schools 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      // Log school deactivation
      await this.logSchoolActivity(schoolId, 'SCHOOL_DEACTIVATED', {
        deactivatedBy
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to deactivate school');
    }
  }

  // Reactivate school
  static async reactivate(schoolId, reactivatedBy) {
    try {
      const result = await query(`
        UPDATE schools 
        SET is_active = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      // Log school reactivation
      await this.logSchoolActivity(schoolId, 'SCHOOL_REACTIVATED', {
        reactivatedBy
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to reactivate school');
    }
  }

  // Get school statistics
  static async getStatistics(schoolId) {
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = true) as total_students,
          (SELECT COUNT(*) FROM staff WHERE school_id = $1 AND is_active = true) as total_staff,
          (SELECT COUNT(*) FROM users WHERE school_id = $1 AND user_type = 'school_user' AND is_active = true) as total_users,
          (SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = true AND created_at > NOW() - INTERVAL '30 days') as new_students_month,
          (SELECT COUNT(*) FROM staff WHERE school_id = $1 AND is_active = true AND created_at > NOW() - INTERVAL '30 days') as new_staff_month
      `, [schoolId]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get school statistics');
    }
  }

  // Update subscription details
  static async updateSubscription(schoolId, subscriptionData, updatedBy) {
    try {
      const {
        subscriptionType,
        pricePerStudent,
        currency,
        maxStudents,
        autoBilling,
        subscriptionStatus
      } = subscriptionData;

      const result = await query(`
        UPDATE schools 
        SET 
          subscription_type = COALESCE($1, subscription_type),
          price_per_student = COALESCE($2, price_per_student),
          currency = COALESCE($3, currency),
          max_students = COALESCE($4, max_students),
          auto_billing = COALESCE($5, auto_billing),
          subscription_status = COALESCE($6, subscription_status),
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [subscriptionType, pricePerStudent, currency, maxStudents, autoBilling, subscriptionStatus, schoolId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      // Log subscription update
      await this.logSchoolActivity(schoolId, 'SUBSCRIPTION_UPDATED', {
        updatedBy,
        subscriptionData
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update subscription');
    }
  }

  // Log school activity
  static async logSchoolActivity(schoolId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.deactivatedBy || details.reactivatedBy,
        action,
        'schools',
        schoolId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      // Don't throw error for audit logging failures
      console.error('Failed to log school activity:', error);
    }
  }

  // Validate school data
  static validateSchoolData(schoolData) {
    const errors = [];

    if (!schoolData.name || schoolData.name.trim().length < 2) {
      errors.push('School name must be at least 2 characters long');
    }

    if (!schoolData.code || schoolData.code.trim().length < 3) {
      errors.push('School code must be at least 3 characters long');
    }

    if (!schoolData.email || !this.isValidEmail(schoolData.email)) {
      errors.push('Valid email is required');
    }

    if (schoolData.phone && !this.isValidPhone(schoolData.phone)) {
      errors.push('Valid phone number is required');
    }

    if (schoolData.pricePerStudent && schoolData.pricePerStudent < 0) {
      errors.push('Price per student cannot be negative');
    }

    if (schoolData.maxStudents && schoolData.maxStudents < 1) {
      errors.push('Maximum students must be at least 1');
    }

    return errors;
  }

  // Email validation helper
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Phone validation helper
  static isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }
}

module.exports = School; 