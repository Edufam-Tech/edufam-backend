const express = require('express');

// Import corrected authentication middleware
const {
  schoolAuth,
  adminAuth,
  optionalAuthenticate
} = require('../middleware/auth');

// Import core route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const uploadRoutes = require('./upload');
const schoolRoutes = require('./school');
const studentRoutes = require('./studentRoutes');
const staffRoutes = require('./staffRoutes');
const departmentRoutes = require('./departmentRoutes');
const academicRoutes = require('./academic');
const financialRoutes = require('./financial');
const transportRoutes = require('./transport');
const reportsRoutes = require('./reports');
const communicationRoutes = require('./communication');
const hrRoutes = require('./hr');
const timetableRoutes = require('./timetable');



const router = express.Router();
const { checkMaintenanceMode } = require('../middleware/security');

// API version and info
router.get('/', (req, res) => {
  res.json({
    name: 'Edufam Backend API',
    version: '1.0.0',
    description: 'Education Management Platform Backend API',
    documentation: '/api/docs',
    endpoints: {
      authentication: '/api/auth',
      users: '/api/users',
      upload: '/api/upload',
      school: '/api/school',
      students: '/api/students',
      staff: '/api/staff',
      departments: '/api/departments',
      academic: '/api/academic',
      financial: '/api/financial',
      transport: '/api/transport',
      reports: '/api/reports',
      communication: '/api/communication',
      hr: '/api/hr',
      timetable: '/api/timetable',
      health: '/health'
    },
    modules: {
      academic: {
        assessments: '/api/academic/assessments',
        grades: '/api/academic/grades',
        attendance: '/api/academic/attendance',
        grading_scales: '/api/academic/grading-scales',
        analytics: '/api/academic/academic/analytics'
      },
      financial: {
        fee_structures: '/api/financial/fee-structures',
        payments: '/api/financial/payments',
        mpesa: '/api/financial/payments/mpesa',
        invoices: '/api/financial/invoices',
        receipts: '/api/financial/receipts',
        analytics: '/api/financial/financial/analytics'
      },
      transport: {
        vehicles: '/api/transport/vehicles',
        routes: '/api/transport/routes',
        assignments: '/api/transport/assign',
        attendance: '/api/transport/attendance',
        incidents: '/api/transport/incidents',
        fees: '/api/transport/fees',
        statistics: '/api/transport/statistics'
      },
      reports: {
        templates: '/api/reports/templates',
        custom: '/api/reports/custom',
        dashboards: '/api/reports/dashboards',
        analytics: '/api/reports/analytics',
        exports: '/api/reports/exports',
        scheduled: '/api/reports/scheduled',
        kpi: '/api/reports/kpi'
      },
      communication: {
        messages: '/api/communication/messages',
        announcements: '/api/communication/announcements',
        notifications: '/api/communication/notifications',
        settings: '/api/communication/settings'
      },
      hr: {
        employees: '/api/hr/employees',
        payroll: '/api/hr/payroll',
        leave: '/api/hr/leave',
        performance: '/api/hr/performance',
        analytics: '/api/hr/analytics'
      },
      timetable: {
        generate: '/api/timetable/generate',
        configurations: '/api/timetable/configurations',
        publish: '/api/timetable/publish',
        conflicts: '/api/timetable/conflicts',
        published: '/api/timetable/published',
        analytics: '/api/timetable/analytics'
      },
      certificates: {
        templates: '/api/certificates/templates',
        generate: '/api/certificates/generate',
        bulkGenerate: '/api/certificates/bulk-generate',
        verify: '/api/verify-certificate',
        analytics: '/api/certificates/analytics'
      },
      invoices: {
        templates: '/api/invoices/templates',
        generate: '/api/invoices/generate',
        recurring: '/api/invoices/recurring',
        creditNotes: '/api/invoices/credit-notes',
        analytics: '/api/invoices/analytics'
      },
      appraisals: {
        cycles: '/api/appraisals/cycles',
        templates: '/api/appraisals/templates',
        initiate: '/api/appraisals/initiate',
        myAppraisals: '/api/appraisals/my-appraisals',
        reports: '/api/appraisals/reports'
      },
      trips: {
        upcoming: '/api/trips/upcoming',
        types: '/api/trips/types',
        permissions: '/api/trips/permissions',
        vendors: '/api/trips/vendors',
        feedback: '/api/trips/:id/feedback'
      }
    },
    security: {
      authentication: 'JWT Bearer Token',
      rateLimit: 'Active',
      cors: 'Configured'
    }
  });
});

/**
 * ===========================
 * PUBLIC ROUTES (No Authentication)
 * ===========================
 */
router.use('/auth', authRoutes); // Auth routes handle their own authentication

// Public job postings route for landing page
router.get('/public/job-postings', async (req, res) => {
  try {
    const { query } = require('../config/database');
    
    // Get all active job postings from all schools
    const postings = await query(`
      SELECT 
        jp.*,
        s.name as school_name,
        d.name as department_name
      FROM job_postings jp
      JOIN schools s ON jp.school_id = s.id
      LEFT JOIN departments d ON jp.department_id = d.id
      WHERE jp.status = 'active'
      ORDER BY jp.created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: postings.rows,
      message: 'Job postings retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching public job postings:', error);
    if (error.code === '42P01') {
      // Table missing – return empty list instead of 500
      return res.status(200).json({ success: true, data: [], message: 'No job postings available yet' });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch job postings', message: error.message });
  }
});

// Public job application submission (for ATS intake)
router.post('/public/job-applications', async (req, res) => {
  try {
    const { query } = require('../config/database');
    const {
      job_posting_id,
      applicant_name,
      applicant_email,
      applicant_phone,
      resume_url,
      cover_letter
    } = req.body || {};

    if (!job_posting_id || !applicant_name || !applicant_email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Derive school_id from job_posting
    const posting = await query('SELECT id, school_id FROM job_postings WHERE id = $1 AND status = $2', [job_posting_id, 'active']);
    if (posting.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job posting not found or not active' });
    }

    const insert = await query(`
      INSERT INTO job_applications (
        school_id, job_posting_id, applicant_name, applicant_email, applicant_phone,
        resume_url, cover_letter, application_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted')
      RETURNING *
    `, [
      posting.rows[0].school_id,
      job_posting_id,
      applicant_name,
      applicant_email,
      applicant_phone || null,
      resume_url || null,
      cover_letter || null,
    ]);

    res.status(201).json({ success: true, data: insert.rows[0], message: 'Application submitted' });
  } catch (error) {
    console.error('Error submitting public job application:', error);
    res.status(500).json({ success: false, error: 'Failed to submit application', message: error.message });
  }
});

router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    server: 'Edufam Backend API'
  });
});

/**
 * ===========================
 * SCHOOL APPLICATION ROUTES
 * All routes use schoolAuth which:
 * 1. Authenticates users
 * 2. Blocks support staff (driver, cleaner, chef, etc.)
 * 3. Only allows dashboard users (school_director, principal, teacher, parent, hr, finance)
 * ===========================
 */

// Core school routes with authentication
// Enforce maintenance mode for school app APIs only
router.use('/users', checkMaintenanceMode, schoolAuth, userRoutes);
router.use('/upload', checkMaintenanceMode, schoolAuth, uploadRoutes);
router.use('/school', checkMaintenanceMode, schoolAuth, schoolRoutes);
router.use('/students', checkMaintenanceMode, schoolAuth, studentRoutes);
router.use('/staff', checkMaintenanceMode, schoolAuth, staffRoutes);
router.use('/departments', checkMaintenanceMode, schoolAuth, departmentRoutes);

// Academic management routes
router.use('/academic', checkMaintenanceMode, schoolAuth, academicRoutes);
router.use('/timetable', checkMaintenanceMode, schoolAuth, timetableRoutes);

// Financial management routes
router.use('/financial', checkMaintenanceMode, schoolAuth, financialRoutes);

// Operations management routes
router.use('/transport', checkMaintenanceMode, schoolAuth, transportRoutes);
router.use('/hr', checkMaintenanceMode, schoolAuth, hrRoutes);

// Communication and reporting routes
router.use('/communication', checkMaintenanceMode, schoolAuth, communicationRoutes);
router.use('/reports', checkMaintenanceMode, schoolAuth, reportsRoutes);


/**
 * ===========================
 * ERROR HANDLING FOR BLOCKED ACCESS
 * ===========================
 */

// Import access control monitoring
const { logSupportStaffAccess } = require('../middleware/auth');

// Log support staff access attempts (monitoring)
router.use(logSupportStaffAccess);

// Catch-all for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      type: 'RouteNotFoundError',
      message: 'The requested endpoint does not exist',
      path: req.originalUrl
    }
  });
});

// Global error handler
router.use((error, req, res, next) => {
  console.error('API Error:', error);

  // Prefer status codes from our AppError classes
  const status = error.statusCode
    || (error.name === 'UnauthorizedError' ? 401
    : error.name === 'AccessDeniedError' ? 403
    : error.name === 'ValidationError' ? 400
    : error.name === 'AuthenticationError' ? 401
    : 500);

  // Map error type/name for client readability
  const type = error.name
    || (status === 401 ? 'AuthenticationError'
    : status === 403 ? 'AccessDeniedError'
    : status === 400 ? 'ValidationError'
    : 'InternalServerError');

  // Build base response
  const payload = {
    success: false,
    error: {
      type,
      message: (process.env.NODE_ENV === 'production' && status >= 500)
        ? 'An unexpected error occurred'
        : (error.message || 'Request failed'),
    },
  };

  // Attach validation details when present
  if (type === 'ValidationError' && (error.errors || error.details)) {
    payload.error.details = error.errors || error.details;
  }

  res.status(status).json(payload);
});

module.exports = router; 