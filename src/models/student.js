const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class Student {
  // Create new student
  static async create(studentData, createdBy) {
    try {
      const {
        schoolId,
        admissionNumber,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone,
        email,
        address,
        parentId,
        classId,
        curriculumType = '8-4-4',
        enrollmentDate = new Date(),
        enrollmentStatus = 'active',
        profilePictureUrl,
        emergencyContact,
        medicalInfo,
        academicInfo
      } = studentData;

      // Validate required fields
      if (!schoolId || !admissionNumber || !firstName || !lastName || !dateOfBirth || !gender) {
        throw new ValidationError('School ID, admission number, first name, last name, date of birth, and gender are required');
      }

      // Check if admission number already exists for this school
      const existingStudent = await query(
        'SELECT id FROM students WHERE school_id = $1 AND admission_number = $2',
        [schoolId, admissionNumber]
      );

      if (existingStudent.rows.length > 0) {
        throw new ConflictError('Admission number already exists for this school');
      }

      // Check if email already exists for this school
      if (email) {
        const existingEmail = await query(
          'SELECT id FROM students WHERE school_id = $1 AND email = $2',
          [schoolId, email]
        );

        if (existingEmail.rows.length > 0) {
          throw new ConflictError('Email already exists for this school');
        }
      }

      // Validate date of birth (student should be between 3 and 25 years old)
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 3 || age > 25) {
        throw new ValidationError('Student age must be between 3 and 25 years');
      }

      // Insert student
      const result = await query(`
        INSERT INTO students (
          school_id, admission_number, first_name, last_name, date_of_birth, gender,
          phone, email, address, parent_id, class_id, curriculum_type,
          enrollment_date, enrollment_status, profile_picture_url,
          emergency_contact, medical_info, academic_info,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
        RETURNING *
      `, [
        schoolId, admissionNumber, firstName, lastName, dateOfBirth, gender,
        phone, email, address, parentId, classId, curriculumType,
        enrollmentDate, enrollmentStatus, profilePictureUrl,
        JSON.stringify(emergencyContact), JSON.stringify(medicalInfo), JSON.stringify(academicInfo)
      ]);

      const newStudent = result.rows[0];

      // Log student creation
      await this.logStudentActivity(newStudent.id, 'STUDENT_CREATED', {
        createdBy,
        schoolId,
        studentData: { admissionNumber, firstName, lastName, curriculumType }
      });

      return newStudent;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create student');
    }
  }

  // Get student by ID
  static async findById(studentId) {
    try {
      const result = await query(`
        SELECT s.*, 
               u.first_name as parent_first_name, u.last_name as parent_last_name, u.email as parent_email,
               c.name as class_name, c.grade_level,
               sch.name as school_name
        FROM students s
        LEFT JOIN users u ON s.parent_id = u.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN schools sch ON s.school_id = sch.id
        WHERE s.id = $1 AND s.is_active = true
      `, [studentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Student not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find student');
    }
  }

  // Get student by admission number
  static async findByAdmissionNumber(schoolId, admissionNumber) {
    try {
      const result = await query(`
        SELECT s.*, 
               u.first_name as parent_first_name, u.last_name as parent_last_name, u.email as parent_email,
               c.name as class_name, c.grade_level
        FROM students s
        LEFT JOIN users u ON s.parent_id = u.id
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE s.school_id = $1 AND s.admission_number = $2 AND s.is_active = true
      `, [schoolId, admissionNumber]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Student not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find student');
    }
  }

  // Get all students with pagination and filters
  static async findAll(filters = {}, pagination = {}) {
    try {
      const {
        schoolId,
        search,
        classId,
        curriculumType,
        enrollmentStatus,
        gender,
        isActive = true
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

      if (search) {
        whereConditions.push(`(
          s.first_name ILIKE $${paramIndex} OR 
          s.last_name ILIKE $${paramIndex} OR 
          s.admission_number ILIKE $${paramIndex} OR
          s.email ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (classId) {
        whereConditions.push(`s.class_id = $${paramIndex++}`);
        params.push(classId);
      }

      if (curriculumType) {
        whereConditions.push(`s.curriculum_type = $${paramIndex++}`);
        params.push(curriculumType);
      }

      if (enrollmentStatus) {
        whereConditions.push(`s.enrollment_status = $${paramIndex++}`);
        params.push(enrollmentStatus);
      }

      if (gender) {
        whereConditions.push(`s.gender = $${paramIndex++}`);
        params.push(gender);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM students s WHERE ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get students with related data
      const result = await query(`
        SELECT s.*, 
               u.first_name as parent_first_name, u.last_name as parent_last_name, u.email as parent_email,
               c.name as class_name, c.grade_level,
               sch.name as school_name
        FROM students s
        LEFT JOIN users u ON s.parent_id = u.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN schools sch ON s.school_id = sch.id
        WHERE ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      return {
        students: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to fetch students');
    }
  }

  // Update student
  static async update(studentId, updateData, updatedBy) {
    try {
      const {
        admissionNumber,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone,
        email,
        address,
        parentId,
        classId,
        curriculumType,
        enrollmentStatus,
        profilePictureUrl,
        emergencyContact,
        medicalInfo,
        academicInfo
      } = updateData;

      // Check if student exists
      const existingStudent = await this.findById(studentId);

      // Validate date of birth if being updated
      if (dateOfBirth) {
        const birthDate = new Date(dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < 3 || age > 25) {
          throw new ValidationError('Student age must be between 3 and 25 years');
        }
      }

      // Check if admission number is being changed and if it already exists
      if (admissionNumber && admissionNumber !== existingStudent.admission_number) {
        const admissionExists = await query(
          'SELECT id FROM students WHERE school_id = $1 AND admission_number = $2 AND id != $3',
          [existingStudent.school_id, admissionNumber, studentId]
        );

        if (admissionExists.rows.length > 0) {
          throw new ConflictError('Admission number already exists');
        }
      }

      // Check if email is being changed and if it already exists
      if (email && email !== existingStudent.email) {
        const emailExists = await query(
          'SELECT id FROM students WHERE school_id = $1 AND email = $2 AND id != $3',
          [existingStudent.school_id, email, studentId]
        );

        if (emailExists.rows.length > 0) {
          throw new ConflictError('Email already exists');
        }
      }

      // Build update query dynamically
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (admissionNumber !== undefined) {
        updateFields.push(`admission_number = $${paramIndex++}`);
        params.push(admissionNumber);
      }

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

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex++}`);
        params.push(phone);
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        params.push(email);
      }

      if (address !== undefined) {
        updateFields.push(`address = $${paramIndex++}`);
        params.push(address);
      }

      if (parentId !== undefined) {
        updateFields.push(`parent_id = $${paramIndex++}`);
        params.push(parentId);
      }

      if (classId !== undefined) {
        updateFields.push(`class_id = $${paramIndex++}`);
        params.push(classId);
      }

      if (curriculumType !== undefined) {
        updateFields.push(`curriculum_type = $${paramIndex++}`);
        params.push(curriculumType);
      }

      if (enrollmentStatus !== undefined) {
        updateFields.push(`enrollment_status = $${paramIndex++}`);
        params.push(enrollmentStatus);
      }

      if (profilePictureUrl !== undefined) {
        updateFields.push(`profile_picture_url = $${paramIndex++}`);
        params.push(profilePictureUrl);
      }

      if (emergencyContact !== undefined) {
        updateFields.push(`emergency_contact = $${paramIndex++}`);
        params.push(JSON.stringify(emergencyContact));
      }

      if (medicalInfo !== undefined) {
        updateFields.push(`medical_info = $${paramIndex++}`);
        params.push(JSON.stringify(medicalInfo));
      }

      if (academicInfo !== undefined) {
        updateFields.push(`academic_info = $${paramIndex++}`);
        params.push(JSON.stringify(academicInfo));
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(studentId);

      const result = await query(`
        UPDATE students 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      if (result.rows.length === 0) {
        throw new NotFoundError('Student not found');
      }

      const updatedStudent = result.rows[0];

      // Log student update
      await this.logStudentActivity(studentId, 'STUDENT_UPDATED', {
        updatedBy,
        updatedFields: Object.keys(updateData)
      });

      return updatedStudent;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to update student');
    }
  }

  // Deactivate student
  static async deactivate(studentId, deactivatedBy) {
    try {
      const result = await query(`
        UPDATE students 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [studentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Student not found');
      }

      // Log student deactivation
      await this.logStudentActivity(studentId, 'STUDENT_DEACTIVATED', {
        deactivatedBy
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to deactivate student');
    }
  }

  // Reactivate student
  static async reactivate(studentId, reactivatedBy) {
    try {
      const result = await query(`
        UPDATE students 
        SET is_active = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [studentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Student not found');
      }

      // Log student reactivation
      await this.logStudentActivity(studentId, 'STUDENT_REACTIVATED', {
        reactivatedBy
      });

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to reactivate student');
    }
  }

  // Get students by class
  static async findByClass(classId, filters = {}) {
    try {
      const { enrollmentStatus, isActive = true } = filters;
      
      let whereConditions = ['s.class_id = $1', 's.is_active = $2'];
      let params = [classId, isActive];
      let paramIndex = 3;

      if (enrollmentStatus) {
        whereConditions.push(`s.enrollment_status = $${paramIndex++}`);
        params.push(enrollmentStatus);
      }

      const whereClause = whereConditions.join(' AND ');

      const result = await query(`
        SELECT s.*, 
               u.first_name as parent_first_name, u.last_name as parent_last_name, u.email as parent_email
        FROM students s
        LEFT JOIN users u ON s.parent_id = u.id
        WHERE ${whereClause}
        ORDER BY s.first_name, s.last_name
      `, params);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to fetch students by class');
    }
  }

  // Get students by parent
  static async findByParent(parentId, filters = {}) {
    try {
      const { enrollmentStatus, isActive = true } = filters;
      
      let whereConditions = ['s.parent_id = $1', 's.is_active = $2'];
      let params = [parentId, isActive];
      let paramIndex = 3;

      if (enrollmentStatus) {
        whereConditions.push(`s.enrollment_status = $${paramIndex++}`);
        params.push(enrollmentStatus);
      }

      const whereClause = whereConditions.join(' AND ');

      const result = await query(`
        SELECT s.*, 
               c.name as class_name, c.grade_level,
               sch.name as school_name
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN schools sch ON s.school_id = sch.id
        WHERE ${whereClause}
        ORDER BY s.first_name, s.last_name
      `, params);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to fetch students by parent');
    }
  }

  // Get student statistics
  static async getStatistics(schoolId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_students,
          COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_students,
          COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_students,
          COUNT(CASE WHEN enrollment_status = 'active' THEN 1 END) as active_students,
          COUNT(CASE WHEN enrollment_status = 'inactive' THEN 1 END) as inactive_students,
          COUNT(CASE WHEN curriculum_type = 'CBC' THEN 1 END) as cbc_students,
          COUNT(CASE WHEN curriculum_type = 'IGCSE' THEN 1 END) as igcse_students,
          COUNT(CASE WHEN curriculum_type = '8-4-4' THEN 1 END) as kcse_students,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_students_month,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_students_week
        FROM students 
        WHERE school_id = $1 AND is_active = true
      `, [schoolId]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get student statistics');
    }
  }

  // Generate student ID card data
  static async generateIdCard(studentId) {
    try {
      const student = await this.findById(studentId);
      
      // Generate ID card number (format: SCHOOLCODE/YEAR/ADMISSIONNUMBER)
      const schoolCode = student.school_name?.substring(0, 3).toUpperCase() || 'SCH';
      const currentYear = new Date().getFullYear();
      const idCardNumber = `${schoolCode}/${currentYear}/${student.admission_number}`;
      
      // Calculate age
      const birthDate = new Date(student.date_of_birth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
      
      return {
        student,
        idCardNumber,
        age: calculatedAge,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  // Bulk import students
  static async bulkImport(schoolId, studentsData, createdBy) {
    try {
      const results = {
        created: [],
        errors: [],
        successCount: 0,
        errorCount: 0
      };

      for (let i = 0; i < studentsData.length; i++) {
        try {
          const studentData = {
            ...studentsData[i],
            schoolId
          };

          const student = await this.create(studentData, createdBy);
          results.created.push(student);
          results.successCount++;
        } catch (error) {
          results.errors.push({
            index: i,
            data: studentsData[i],
            error: error.message
          });
          results.errorCount++;
        }
      }

      return results;
    } catch (error) {
      throw new DatabaseError('Failed to bulk import students');
    }
  }

  // Log student activity
  static async logStudentActivity(studentId, action, details = {}) {
    try {
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        details.updatedBy || details.createdBy || details.deactivatedBy || details.reactivatedBy,
        action,
        'students',
        studentId,
        JSON.stringify(details)
      ]);
    } catch (error) {
      // Don't throw error for audit logging failures
      console.error('Failed to log student activity:', error);
    }
  }

  // Validate student data
  static validateStudentData(studentData) {
    const errors = [];

    if (!studentData.firstName || studentData.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }

    if (!studentData.lastName || studentData.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }

    if (!studentData.admissionNumber || studentData.admissionNumber.trim().length < 3) {
      errors.push('Admission number must be at least 3 characters long');
    }

    if (!studentData.dateOfBirth) {
      errors.push('Date of birth is required');
    } else {
      const birthDate = new Date(studentData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
      
      if (calculatedAge < 3 || calculatedAge > 25) {
        errors.push('Student age must be between 3 and 25 years');
      }
    }

    if (!studentData.gender || !['male', 'female', 'other'].includes(studentData.gender)) {
      errors.push('Gender must be male, female, or other');
    }

    if (studentData.email && !this.isValidEmail(studentData.email)) {
      errors.push('Valid email is required');
    }

    if (studentData.phone && !this.isValidPhone(studentData.phone)) {
      errors.push('Valid phone number is required');
    }

    if (studentData.curriculumType && !['CBC', 'IGCSE', '8-4-4'].includes(studentData.curriculumType)) {
      errors.push('Curriculum type must be CBC, IGCSE, or 8-4-4');
    }

    if (studentData.enrollmentStatus && !['active', 'inactive', 'suspended', 'graduated', 'transferred'].includes(studentData.enrollmentStatus)) {
      errors.push('Invalid enrollment status');
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

  // Generate admission number
  static async generateAdmissionNumber(schoolId, year = null) {
    try {
      const currentYear = year || new Date().getFullYear();
      
      // Get the last admission number for this school and year
      const result = await query(`
        SELECT admission_number 
        FROM students 
        WHERE school_id = $1 
          AND admission_number LIKE $2 
          AND is_active = true
        ORDER BY admission_number DESC 
        LIMIT 1
      `, [schoolId, `${currentYear}%`]);

      let nextNumber = 1;
      
      if (result.rows.length > 0) {
        const lastNumber = result.rows[0].admission_number;
        const lastSequence = parseInt(lastNumber.split('/')[1] || lastNumber.split('-')[1] || '0');
        nextNumber = lastSequence + 1;
      }

      // Format: YYYY/NNNNN (e.g., 2024/00001)
      const admissionNumber = `${currentYear}/${nextNumber.toString().padStart(5, '0')}`;
      
      return admissionNumber;
    } catch (error) {
      throw new DatabaseError('Failed to generate admission number');
    }
  }
}

module.exports = Student; 