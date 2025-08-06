const { query } = require('../src/config/database');

// Test database setup and teardown utilities
class TestSetup {
  static async setupTestDatabase() {
    try {
      // Create test tables if they don't exist (for isolated testing)
      console.log('Setting up test database...');
      
      // You might want to use a separate test database
      // or use transactions for test isolation
      
      console.log('Test database setup completed');
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }

  static async cleanupTestDatabase() {
    try {
      console.log('Cleaning up test database...');
      
      // Clean up test data
      await this.truncateTestTables();
      
      console.log('Test database cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup test database:', error);
      throw error;
    }
  }

  static async truncateTestTables() {
    const tables = [
      // HR module tables
      'employee_attendance',
      'disciplinary_actions',
      'training_records',
      'performance_goals',
      'performance_reviews',
      'payroll',
      'leave_balances',
      'leave_applications',
      'leave_types',
      'employees',
      
      // Communication module tables
      'communication_group_members',
      'communication_groups',
      'parent_communication_preferences',
      'communication_logs',
      'scheduled_communications',
      'communication_templates',
      'notification_recipients',
      'notifications',
      'announcements',
      'thread_participants',
      'message_threads',
      'message_recipients',
      'messages',
      
      // M-Pesa tables
      'mpesa_callbacks',
      'mpesa_transactions',
      
      // Academic tables
      'grades',
      'assessments',
      'attendance',
      
      // Financial tables
      'payments',
      'fee_assignments',
      'fee_structures',
      
      // Core tables (be careful with these)
      'students',
      'staff',
      'departments',
      'users'
    ];

    for (const table of tables) {
      try {
        await query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      } catch (error) {
        // Table might not exist, continue
        console.warn(`Could not truncate table ${table}:`, error.message);
      }
    }
  }

  static async createTestSchool() {
    try {
      const result = await query(`
        INSERT INTO schools (
          name, address, phone_number, email, license_number,
          principal_name, establishment_date, created_at
        ) VALUES (
          'Test School',
          '123 Test Street, Test City',
          '+254700000000',
          'test@testschool.edu',
          'TEST001',
          'Test Principal',
          '2020-01-01',
          NOW()
        ) RETURNING *
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create test school:', error);
      throw error;
    }
  }

  static async createTestUser(schoolId, role = 'teacher', userData = {}) {
    try {
      const defaultUser = {
        firstName: 'Test',
        lastName: 'User',
        email: `test.user.${Date.now()}@test.com`,
        phoneNumber: '+254700000001',
        role: role,
        schoolId: schoolId,
        password: 'hashedTestPassword123'
      };

      const user = { ...defaultUser, ...userData };

      const result = await query(`
        INSERT INTO users (
          first_name, last_name, email, phone_number, role,
          school_id, password_hash, is_verified, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
        RETURNING *
      `, [
        user.firstName,
        user.lastName,
        user.email,
        user.phoneNumber,
        user.role,
        user.schoolId,
        user.password
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create test user:', error);
      throw error;
    }
  }

  static async createTestStudent(schoolId, classId, userData = {}) {
    try {
      const defaultStudent = {
        firstName: 'Test',
        lastName: 'Student',
        studentNumber: `TS${Date.now()}`,
        dateOfBirth: '2010-01-01',
        gender: 'male',
        classId: classId,
        schoolId: schoolId
      };

      const student = { ...defaultStudent, ...userData };

      const result = await query(`
        INSERT INTO students (
          first_name, last_name, student_number, date_of_birth,
          gender, class_id, school_id, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
        RETURNING *
      `, [
        student.firstName,
        student.lastName,
        student.studentNumber,
        student.dateOfBirth,
        student.gender,
        student.classId,
        student.schoolId
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create test student:', error);
      throw error;
    }
  }

  static async createTestClass(schoolId, userData = {}) {
    try {
      const defaultClass = {
        name: 'Test Class',
        level: '10',
        capacity: 30,
        schoolId: schoolId
      };

      const classData = { ...defaultClass, ...userData };

      const result = await query(`
        INSERT INTO classes (
          name, level, capacity, school_id, status, created_at
        ) VALUES ($1, $2, $3, $4, 'active', NOW())
        RETURNING *
      `, [
        classData.name,
        classData.level,
        classData.capacity,
        classData.schoolId
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create test class:', error);
      throw error;
    }
  }

  static async createTestEmployee(schoolId, userId, userData = {}) {
    try {
      const defaultEmployee = {
        employeeNumber: `EMP${Date.now()}`,
        position: 'Teacher',
        employmentType: 'full_time',
        startDate: '2023-01-01',
        salary: 50000,
        schoolId: schoolId,
        userId: userId
      };

      const employee = { ...defaultEmployee, ...userData };

      const result = await query(`
        INSERT INTO employees (
          school_id, user_id, employee_number, position,
          employment_type, start_date, salary, status, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $2, NOW())
        RETURNING *
      `, [
        employee.schoolId,
        employee.userId,
        employee.employeeNumber,
        employee.position,
        employee.employmentType,
        employee.startDate,
        employee.salary
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create test employee:', error);
      throw error;
    }
  }

  static generateJWTToken(user) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        school_id: user.school_id 
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  }

  static async waitForDatabase() {
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        await query('SELECT 1');
        console.log('Database connection established');
        return;
      } catch (error) {
        retries++;
        console.log(`Database connection attempt ${retries}/${maxRetries} failed`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Could not establish database connection');
  }
}

module.exports = TestSetup;