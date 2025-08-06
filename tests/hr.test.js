const request = require('supertest');
const app = require('../server');
const TestSetup = require('./setup');

describe('HR Module Tests', () => {
  let testSchool, testUser, testToken, testEmployee;

  beforeAll(async () => {
    await TestSetup.setupTestDatabase();
    
    // Create test school and user
    testSchool = await TestSetup.createTestSchool();
    testUser = await TestSetup.createTestUser(testSchool.id, 'hr');
    testToken = TestSetup.generateJWTToken(testUser);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestDatabase();
  });

  describe('Employee Management', () => {
    test('should create an employee successfully', async () => {
      const employeeUser = await TestSetup.createTestUser(testSchool.id, 'teacher');
      
      const employeeData = {
        userId: employeeUser.id,
        employeeNumber: 'EMP001',
        position: 'Mathematics Teacher',
        employmentType: 'full_time',
        startDate: '2024-01-01',
        salary: 60000,
        benefits: {
          medical: true,
          transport: 5000
        },
        emergencyContact: {
          name: 'Jane Doe',
          phone: '+254700000000',
          relationship: 'spouse'
        }
      };

      const response = await request(app)
        .post('/api/hr/employees')
        .set('Authorization', `Bearer ${testToken}`)
        .send(employeeData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employee_number).toBe(employeeData.employeeNumber);
      expect(response.body.data.position).toBe(employeeData.position);
      
      testEmployee = response.body.data;
    });

    test('should get all employees', async () => {
      const response = await request(app)
        .get('/api/hr/employees')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should get employee by ID', async () => {
      const response = await request(app)
        .get(`/api/hr/employees/${testEmployee.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testEmployee.id);
    });

    test('should update employee information', async () => {
      const updateData = {
        position: 'Senior Mathematics Teacher',
        salary: 70000
      };

      const response = await request(app)
        .put(`/api/hr/employees/${testEmployee.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.position).toBe(updateData.position);
      expect(parseFloat(response.body.data.salary)).toBe(updateData.salary);
    });

    test('should filter employees by department', async () => {
      const response = await request(app)
        .get('/api/hr/employees?departmentId=test-dept-id')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should fail to create employee without required fields', async () => {
      const employeeData = {
        position: 'Teacher'
        // Missing userId and employeeNumber
      };

      const response = await request(app)
        .post('/api/hr/employees')
        .set('Authorization', `Bearer ${testToken}`)
        .send(employeeData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Payroll Management', () => {
    test('should create a payroll record', async () => {
      const payrollData = {
        employeeId: testEmployee.id,
        payPeriodStart: '2024-01-01',
        payPeriodEnd: '2024-01-31',
        basicSalary: 60000,
        allowances: {
          transport: 5000,
          housing: 10000
        },
        deductions: {
          nhif: 1700,
          nssf: 1800,
          paye: 8000
        },
        overtimeHours: 10,
        overtimeRate: 500,
        grossPay: 75000,
        netPay: 63500
      };

      const response = await request(app)
        .post('/api/hr/payroll')
        .set('Authorization', `Bearer ${testToken}`)
        .send(payrollData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employee_id).toBe(payrollData.employeeId);
      expect(parseFloat(response.body.data.basic_salary)).toBe(payrollData.basicSalary);
    });

    test('should get payroll records', async () => {
      const response = await request(app)
        .get('/api/hr/payroll')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter payroll by employee', async () => {
      const response = await request(app)
        .get(`/api/hr/payroll?employeeId=${testEmployee.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should generate payslip', async () => {
      // First create a payroll record
      const payrollResponse = await request(app)
        .post('/api/hr/payroll')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          employeeId: testEmployee.id,
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          basicSalary: 60000,
          grossPay: 60000,
          netPay: 52000
        });

      const payrollId = payrollResponse.body.data.id;

      const response = await request(app)
        .get(`/api/hr/payroll/${payrollId}/payslip`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(payrollId);
    });
  });

  describe('Leave Management', () => {
    test('should submit leave application', async () => {
      // First, ensure we have a leave type
      const leaveType = await TestSetup.query(`
        INSERT INTO leave_types (school_id, name, max_days_per_year, created_by)
        VALUES ($1, 'Annual Leave', 21, $2)
        RETURNING *
      `, [testSchool.id, testUser.id]);

      const leaveData = {
        employeeId: testEmployee.id,
        leaveTypeId: leaveType.rows[0].id,
        startDate: '2024-06-01',
        endDate: '2024-06-05',
        daysRequested: 5,
        reason: 'Family vacation'
      };

      const response = await request(app)
        .post('/api/hr/leave/apply')
        .set('Authorization', `Bearer ${testToken}`)
        .send(leaveData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employee_id).toBe(leaveData.employeeId);
      expect(response.body.data.days_requested).toBe(leaveData.daysRequested);
    });

    test('should get leave applications', async () => {
      const response = await request(app)
        .get('/api/hr/leave/applications')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should approve leave application', async () => {
      // First create a leave application
      const leaveType = await TestSetup.query(`
        SELECT * FROM leave_types WHERE school_id = $1 LIMIT 1
      `, [testSchool.id]);

      const leaveResponse = await request(app)
        .post('/api/hr/leave/apply')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          employeeId: testEmployee.id,
          leaveTypeId: leaveType.rows[0].id,
          startDate: '2024-07-01',
          endDate: '2024-07-03',
          daysRequested: 3,
          reason: 'Medical appointment'
        });

      const leaveId = leaveResponse.body.data.id;

      const response = await request(app)
        .put(`/api/hr/leave/applications/${leaveId}/process`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          action: 'approve',
          comments: 'Approved for medical reasons'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
    });

    test('should reject leave application', async () => {
      // First create a leave application
      const leaveType = await TestSetup.query(`
        SELECT * FROM leave_types WHERE school_id = $1 LIMIT 1
      `, [testSchool.id]);

      const leaveResponse = await request(app)
        .post('/api/hr/leave/apply')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          employeeId: testEmployee.id,
          leaveTypeId: leaveType.rows[0].id,
          startDate: '2024-08-01',
          endDate: '2024-08-10',
          daysRequested: 10,
          reason: 'Personal reasons'
        });

      const leaveId = leaveResponse.body.data.id;

      const response = await request(app)
        .put(`/api/hr/leave/applications/${leaveId}/process`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          action: 'reject',
          comments: 'Too many days requested'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
    });
  });

  describe('Performance Management', () => {
    test('should create performance review', async () => {
      const reviewData = {
        employeeId: testEmployee.id,
        reviewPeriodStart: '2024-01-01',
        reviewPeriodEnd: '2024-12-31',
        goals: [
          { title: 'Improve teaching methods', target: 'Complete training course' },
          { title: 'Student performance', target: '85% pass rate' }
        ],
        achievements: [
          { title: 'Completed training', description: 'Finished advanced pedagogy course' }
        ],
        ratings: {
          teaching: 4.5,
          communication: 4.0,
          leadership: 3.5
        },
        overallScore: 4.0,
        comments: 'Excellent performance this year'
      };

      const response = await request(app)
        .post('/api/hr/performance/reviews')
        .set('Authorization', `Bearer ${testToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employee_id).toBe(reviewData.employeeId);
      expect(parseFloat(response.body.data.overall_score)).toBe(reviewData.overallScore);
    });

    test('should get performance reviews', async () => {
      const response = await request(app)
        .get('/api/hr/performance/reviews')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter performance reviews by employee', async () => {
      const response = await request(app)
        .get(`/api/hr/performance/reviews?employeeId=${testEmployee.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Analytics and Reports', () => {
    test('should get HR dashboard', async () => {
      const response = await request(app)
        .get('/api/hr/dashboard')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employeeStats).toBeDefined();
      expect(response.body.data.leaveStats).toBeDefined();
    });

    test('should get HR analytics', async () => {
      const response = await request(app)
        .get('/api/hr/analytics')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payrollAnalytics).toBeDefined();
      expect(response.body.data.leaveTrends).toBeDefined();
      expect(response.body.data.performanceTrends).toBeDefined();
    });

    test('should get analytics with date filters', async () => {
      const response = await request(app)
        .get('/api/hr/analytics?startDate=2024-01-01&endDate=2024-12-31')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Authorization', () => {
    test('should require authentication for protected routes', async () => {
      await request(app)
        .get('/api/hr/employees')
        .expect(401);
    });

    test('should require HR role for employee management', async () => {
      const teacherUser = await TestSetup.createTestUser(testSchool.id, 'teacher');
      const teacherToken = TestSetup.generateJWTToken(teacherUser);

      await request(app)
        .post('/api/hr/employees')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          userId: teacherUser.id,
          employeeNumber: 'EMP002',
          position: 'Teacher'
        })
        .expect(403);
    });

    test('should allow employees to apply for leave', async () => {
      const employeeUser = await TestSetup.createTestUser(testSchool.id, 'teacher');
      const employeeToken = TestSetup.generateJWTToken(employeeUser);

      const leaveType = await TestSetup.query(`
        SELECT * FROM leave_types WHERE school_id = $1 LIMIT 1
      `, [testSchool.id]);

      const response = await request(app)
        .post('/api/hr/leave/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId: leaveType.rows[0].id,
          startDate: '2024-09-01',
          endDate: '2024-09-02',
          daysRequested: 2,
          reason: 'Personal matters'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});