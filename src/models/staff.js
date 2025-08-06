const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Staff {
  // Create new staff member
  static async create(staffData, createdBy) {
    try {
      const {
        schoolId,
        employeeNumber,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        email,
        phone,
        address,
        staffType = 'teacher',
        departmentId,
        employmentDate,
        contractType = 'permanent',
        salary,
        emergencyContact,
        bankDetails,
        qualifications,
        skills,
        isActive = true
      } = staffData;

      // Validate required fields
      if (!schoolId || !firstName || !lastName || !dateOfBirth || !gender || !email) {
        throw new ValidationError('School ID, first name, last name, date of birth, gender, and email are required');
      }

      // Check if email already exists for this school
      const existingEmail = await query(
        'SELECT id FROM staff WHERE school_id = $1 AND email = $2 AND is_active = true',
        [schoolId, email]
      );

      if (existingEmail.rows.length > 0) {
        throw new ConflictError('Email already exists for this school');
      }

      // Check if employee number already exists for this school
      if (employeeNumber) {
        const existingEmployeeNumber = await query(
          'SELECT id FROM staff WHERE school_id = $1 AND employee_number = $2 AND is_active = true',
          [schoolId, employeeNumber]
        );

        if (existingEmployeeNumber.rows.length > 0) {
          throw new ConflictError('Employee number already exists for this school');
        }
      }

      // Insert staff member
      const result = await query(`
        INSERT INTO staff (
          school_id, employee_number, first_name, last_name, date_of_birth, gender,
          email, phone, address, staff_type, department_id, employment_date,
          contract_type, salary, emergency_contact, bank_details, qualifications,
          skills, is_active, created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, employeeNumber, firstName, lastName, dateOfBirth, gender,
        email, phone, address, staffType, departmentId, employmentDate,
        contractType, salary, JSON.stringify(emergencyContact), JSON.stringify(bankDetails),
        JSON.stringify(qualifications), JSON.stringify(skills), isActive, createdBy, createdBy
      ]);

      const newStaff = result.rows[0];

      // Log staff creation
      await this.logStaffActivity(newStaff.id, 'STAFF_CREATED', {
        createdBy,
        schoolId,
        staffData: { firstName, lastName, email, staffType }
      });

      return newStaff;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create staff member');
    }
  }

  // Get staff by ID
  static async findById(staffId) {
    try {
      const result = await query(`
        SELECT s.*, 
               sch.name as school_name,
               d.name as department_name
        FROM staff s
        LEFT JOIN schools sch ON s.school_id = sch.id
        LEFT JOIN staff_departments d ON s.department_id = d.id
        WHERE s.id = $1 AND s.is_active = true
      `, [staffId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Staff member not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find staff member');
    }
  }

  // Get staff by employee number
  static async findByEmployeeNumber(schoolId, employeeNumber) {
    try {
      const result = await query(`
        SELECT s.*, 
               sch.name as school_name,
               d.name as department_name
        FROM staff s
        LEFT JOIN schools sch ON s.school_id = sch.id
        LEFT JOIN staff_departments d ON s.department_id = d.id
        WHERE s.school_id = $1 AND s.employee_number = $2 AND s.is_active = true
      `, [schoolId, employeeNumber]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Staff member not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find staff member');
    }
  }

  // Get all staff with pagination and filters
  static async findAll(filters = {}, pagination = {}) {
    try {
      const {
        schoolId,
        staffType,
        departmentId,
        contractType,
        isActive = true,
        search
      } = filters;

      const { page = 1, limit = 10 } = pagination;
      const offset = (page - 1) * limit;

      let whereConditions = ['s.is_active = $1'];
      let params = [isActive];
      let paramIndex = 2;

      if (schoolId) {
        whereConditions.push(`s.school_id = $${paramIndex++}`);
        params.push(schoolId);
      }

      if (staffType) {
        whereConditions.push(`s.staff_type = $${paramIndex++}`);
        params.push(staffType);
      }

      if (departmentId) {
        whereConditions.push(`s.department_id = $${paramIndex++}`);
        params.push(departmentId);
      }

      if (contractType) {
        whereConditions.push(`s.contract_type = $${paramIndex++}`);
        params.push(contractType);
      }

      if (search) {
        whereConditions.push(`(
          s.first_name ILIKE $${paramIndex} OR 
          s.last_name ILIKE $${paramIndex} OR 
          s.email ILIKE $${paramIndex} OR 
          s.employee_number ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM staff s WHERE ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get staff with related data
      const result = await query(`
        SELECT s.*, 
               sch.name as school_name,
               d.name as department_name,
               (SELECT COUNT(*) FROM staff_qualifications WHERE staff_id = s.id) as qualification_count,
               (SELECT COUNT(*) FROM staff_documents WHERE staff_id = s.id) as document_count
        FROM staff s
        LEFT JOIN schools sch ON s.school_id = sch.id
        LEFT JOIN staff_departments d ON s.department_id = d.id
        WHERE ${whereClause}
        ORDER BY s.first_name, s.last_name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      return {
        staff: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to fetch staff members');
    }
  }

  // Update staff member
  static async update(staffId, updateData, updatedBy) {
    try {
      const {
        firstName,
        lastName,
        dateOfBirth,
        gender,
        email,
        phone,
        address,
        staffType,
        departmentId,
        employmentDate,
        contractType,
        salary,
        emergencyContact,
        bankDetails,
        qualifications,
        skills
      } = updateData;

      // Check if staff exists
      const existingStaff = await this.findById(staffId);

      // Check if email is being changed and if it already exists
      if (email && email !== existingStaff.email) {
        const emailExists = await query(
          'SELECT id FROM staff WHERE school_id = $1 AND email = $2 AND id != $3 AND is_active = true',
          [existingStaff.school_id, email, staffId]
        );

        if (emailExists.rows.length > 0) {
          throw new ConflictError('Email already exists for this school');
        }
      }

      // Build update query dynamically
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (firstName !== undefined) {
        updateFields.push(`first_name = $${paramIndex++}`);
        params.push(firstName);
      }

      if (lastName !== undefined) {
        updateFields.push(`last_name = $${paramIndex++}`);
        params.push(lastName);
      }

      if (dateOfBirth !== undefined) {
        updateFields.push(`date_of_birth = $${paramIndex++}`);
        params.push(dateOfBirth);
      }

      if (gender !== undefined) {
        updateFields.push(`gender = $${paramIndex++}`);
        params.push(gender);
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        params.push(email);
      }

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex++}`);
        params.push(phone);
      }

      if (address !== undefined) {
        updateFields.push(`address = $${paramIndex++}`);
        params.push(address);
      }

      if (staffType !== undefined) {
        updateFields.push(`staff_type = $${paramIndex++}`);
        params.push(staffType);
      }

      if (departmentId !== undefined) {
        updateFields.push(`department_id = $${paramIndex++}`);
        params.push(departmentId);
      }

      if (employmentDate !== undefined) {
        updateFields.push(`employment_date = $${paramIndex++}`);
        params.push(employmentDate);
      }

      if (contractType !== undefined) {
        updateFields.push(`contract_type = $${paramIndex++}`);
        params.push(contractType);
      }

      if (salary !== undefined) {
        updateFields.push(`salary = $${paramIndex++}`);
        params.push(salary);
      }

      if (emergencyContact !== undefined) {
        updateFields.push(`emergency_contact = $${paramIndex++}`);
        params.push(JSON.stringify(emergencyContact));
      }

      if (bankDetails !== undefined) {
        updateFields.push(`bank_details = $${paramIndex++}`);
        params.push(JSON.stringify(bankDetails));
      }

      if (qualifications !== undefined) {
        updateFields.push(`qualifications = $${paramIndex++}`);
        params.push(JSON.stringify(qualifications));
      }

      if (skills !== undefined) {
        updateFields.push(`skills = $${paramIndex++}`);
        params.push(JSON.stringify(skills));
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push(`updated_by = $${paramIndex++}`);
      updateFields.push(`updated_at = NOW()`);
      params.push(updatedBy);
      params.push(staffId);

      const result = await query(`
        UPDATE staff 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Staff member not found');
      }

      const updatedStaff = result.rows[0];

      // Log staff update
      await this.logStaffActivity(staffId, 'STAFF_UPDATED', {
        updatedBy,
        updatedFields: Object.keys(updateData)
      });

      return updatedStaff;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to update staff member');
    }
  }

  // Deactivate staff member
  static async deactivate(staffId, deactivatedBy) {
    try {
      const result = await query(`
        UPDATE staff 
        SET is_active = false, updated_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [deactivatedBy, staffId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Staff member not found');
      }

      const deactivatedStaff = result.rows[0];

      // Log staff deactivation
      await this.logStaffActivity(staffId, 'STAFF_DEACTIVATED', {
        deactivatedBy
      });

      return deactivatedStaff;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to deactivate staff member');
    }
  }

  // Reactivate staff member
  static async reactivate(staffId, reactivatedBy) {
    try {
      const result = await query(`
        UPDATE staff 
        SET is_active = true, updated_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [reactivatedBy, staffId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Staff member not found');
      }

      const reactivatedStaff = result.rows[0];

      // Log staff reactivation
      await this.logStaffActivity(staffId, 'STAFF_REACTIVATED', {
        reactivatedBy
      });

      return reactivatedStaff;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to reactivate staff member');
    }
  }

  // Get staff statistics
  static async getStatistics(schoolId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_staff,
          COUNT(CASE WHEN staff_type = 'teacher' THEN 1 END) as teachers,
          COUNT(CASE WHEN staff_type = 'admin' THEN 1 END) as admin_staff,
          COUNT(CASE WHEN staff_type = 'support' THEN 1 END) as support_staff,
          COUNT(CASE WHEN contract_type = 'permanent' THEN 1 END) as permanent_staff,
          COUNT(CASE WHEN contract_type = 'contract' THEN 1 END) as contract_staff,
          COUNT(CASE WHEN contract_type = 'part_time' THEN 1 END) as part_time_staff,
          COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_staff,
          COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_staff,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_staff_month,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_staff_week
        FROM staff
        WHERE school_id = $1 AND is_active = true
      `, [schoolId]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get staff statistics');
    }
  }

  // Get upcoming birthdays
  static async getUpcomingBirthdays(schoolId, days = 30) {
    try {
      const result = await query(`
        SELECT 
          id, first_name, last_name, date_of_birth, email, phone,
          EXTRACT(DOY FROM date_of_birth) as day_of_year,
          EXTRACT(DOY FROM CURRENT_DATE) as current_day_of_year
        FROM staff
        WHERE school_id = $1 AND is_active = true
        AND (
          EXTRACT(DOY FROM date_of_birth) BETWEEN 
          EXTRACT(DOY FROM CURRENT_DATE) AND 
          EXTRACT(DOY FROM CURRENT_DATE + INTERVAL '$2 days')
        )
        ORDER BY EXTRACT(DOY FROM date_of_birth)
      `, [schoolId, days]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get upcoming birthdays');
    }
  }

  // Generate employee number
  static async generateEmployeeNumber(schoolId, year = null) {
    try {
      const currentYear = year || new Date().getFullYear();
      const schoolCode = await query(
        'SELECT code FROM schools WHERE id = $1',
        [schoolId]
      );

      if (schoolCode.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      const schoolCodeValue = schoolCode.rows[0].code;
      
      // Get the last employee number for this school and year
      const lastEmployee = await query(
        'SELECT employee_number FROM staff WHERE school_id = $1 AND employee_number LIKE $2 ORDER BY employee_number DESC LIMIT 1',
        [schoolId, `${schoolCodeValue}${currentYear}%`]
      );

      let sequence = 1;
      if (lastEmployee.rows.length > 0) {
        const lastNumber = lastEmployee.rows[0].employee_number;
        const lastSequence = parseInt(lastNumber.slice(-3));
        sequence = lastSequence + 1;
      }

      return `${schoolCodeValue}${currentYear}${sequence.toString().padStart(3, '0')}`;
    } catch (error) {
      throw new DatabaseError('Failed to generate employee number');
    }
  }

  // Log staff activity
  static async logStaffActivity(staffId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.deactivatedBy || details.reactivatedBy,
        action,
        'staff',
        staffId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log staff activity:', error);
    }
  }

  // Validate staff data
  static validateStaffData(staffData) {
    const errors = [];

    if (!staffData.firstName || staffData.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }

    if (!staffData.lastName || staffData.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }

    if (!staffData.dateOfBirth) {
      errors.push('Date of birth is required');
    } else {
      const birthDate = new Date(staffData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18 || age > 70) {
        errors.push('Staff member must be between 18 and 70 years old');
      }
    }

    if (!staffData.gender || !['male', 'female', 'other'].includes(staffData.gender)) {
      errors.push('Gender must be male, female, or other');
    }

    if (!staffData.email || !this.isValidEmail(staffData.email)) {
      errors.push('Valid email address is required');
    }

    if (staffData.phone && !this.isValidPhone(staffData.phone)) {
      errors.push('Phone number must be a valid Kenyan format');
    }

    if (staffData.staffType && !['teacher', 'admin', 'support', 'management'].includes(staffData.staffType)) {
      errors.push('Staff type must be teacher, admin, support, or management');
    }

    if (staffData.contractType && !['permanent', 'contract', 'part_time', 'probation'].includes(staffData.contractType)) {
      errors.push('Contract type must be permanent, contract, part_time, or probation');
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
    const phoneRegex = /^(\+254|0)[17]\d{8}$/;
    return phoneRegex.test(phone);
  }
}

module.exports = Staff; 