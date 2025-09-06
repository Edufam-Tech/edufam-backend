const express = require('express');

// Import corrected authentication middleware
const {
  schoolAuth,
  adminAuth,
  optionalAuthenticate
} = require('../middleware/auth');

// Import all route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const uploadRoutes = require('./upload');
const schoolRoutesOld = require('./schoolRoutes');
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
const certificateRoutes = require('./certificates');
const invoiceRoutes = require('./invoices');
const appraisalRoutes = require('./appraisals');
const tripsRoutes = require('./trips');
const realtimeRoutes = require('./realtime');
const curriculumRoutes = require('./curriculum');
const securityRoutes = require('./security');
const complianceRoutes = require('./compliance');
const calendarRoutes = require('./calendar');
const trainingRoutes = require('./training');
const marketplaceRoutes = require('./marketplace');
const analyticsRoutes = require('./analytics');
const mobileRoutes = require('./mobile');
const i18nRoutes = require('./i18n');
const cloudRoutes = require('./cloud');
const examinationRoutes = require('./examinations');
const expenseRoutes = require('./expenses');
const payrollRoutes = require('./payroll');
const performanceRoutes = require('./performance');
const inventoryRoutes = require('./inventory');
const aiTimetableRoutes = require('./ai-timetable');
// Web dashboard routes
const directorWebRoutes = require('./web/directorRoutes');
const principalWebRoutes = require('./web/principalRoutes');
const teacherWebRoutes = require('./web/teacherRoutes');
const hrWebRoutes = require('./web/hrRoutes');
const financeWebRoutes = require('./web/financeRoutes');
const parentWebRoutes = require('./web/parentRoutes');

// Admin routes
const multiSchoolRoutes = require('./admin/multiSchool');
const subscriptionRoutes = require('./admin/subscriptions');
const platformAnalyticsRoutes = require('./admin/platformAnalytics');
const adminHrRoutes = require('./admin/hr');
const adminTripRoutes = require('./admin/trips');
const adminUserRoutes = require('./admin/adminUsers');
const adminCrmRoutes = require('./admin/crm');
const systemConfigRoutes = require('./admin/systemConfig');
const regionalRoutes = require('./admin/regional');
const monitoringRoutes = require('./admin/monitoring');
const dataMigrationRoutes = require('./admin/dataMigration');
const integrationRoutes = require('./admin/integrations');
const adminComplianceRoutes = require('./admin/compliance');
const adminCommunicationRoutes = require('./admin/communication');
const adminSupportRoutes = require('./admin/support');



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
      schools: '/api/schools',
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
      certificates: '/api/certificates',
      invoices: '/api/invoices',
      appraisals: '/api/appraisals',
      trips: '/api/trips',
      health: '/health',
      // Admin endpoints
      adminMultiSchool: '/api/admin/multi-school',
      adminSubscriptions: '/api/admin/subscriptions',
      adminAnalytics: '/api/admin/analytics',
      adminUsers: '/api/admin/users',
      adminConfig: '/api/admin/config',
      adminRegional: '/api/admin/regional',
      adminMonitoring: '/api/admin/monitoring',
      adminCommunication: '/api/admin/communication',
      adminMigration: '/api/admin/migration',
      adminIntegrations: '/api/admin/integrations',
      adminCompliance: '/api/admin/compliance',
      // Mobile endpoints
      mobile: '/api/mobile'
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
router.use('/schools', checkMaintenanceMode, schoolAuth, schoolRoutesOld);
router.use('/school', checkMaintenanceMode, schoolAuth, schoolRoutes);
router.use('/students', checkMaintenanceMode, schoolAuth, studentRoutes);
router.use('/staff', checkMaintenanceMode, schoolAuth, staffRoutes);
router.use('/departments', checkMaintenanceMode, schoolAuth, departmentRoutes);

// Academic management routes
router.use('/academic', checkMaintenanceMode, schoolAuth, academicRoutes);
router.use('/examinations', checkMaintenanceMode, schoolAuth, examinationRoutes);
router.use('/curriculum', checkMaintenanceMode, schoolAuth, curriculumRoutes);
router.use('/timetable', checkMaintenanceMode, schoolAuth, timetableRoutes);
router.use('/ai-timetable', checkMaintenanceMode, schoolAuth, aiTimetableRoutes);

// Financial management routes
router.use('/financial', checkMaintenanceMode, schoolAuth, financialRoutes);
router.use('/expenses', checkMaintenanceMode, schoolAuth, expenseRoutes);
router.use('/payroll', checkMaintenanceMode, schoolAuth, payrollRoutes);

// Operations management routes
router.use('/transport', checkMaintenanceMode, schoolAuth, transportRoutes);
router.use('/hr', checkMaintenanceMode, schoolAuth, hrRoutes);
router.use('/performance', checkMaintenanceMode, schoolAuth, performanceRoutes);
router.use('/inventory', checkMaintenanceMode, schoolAuth, inventoryRoutes);

// Communication and reporting routes
router.use('/communication', checkMaintenanceMode, schoolAuth, communicationRoutes);
router.use('/reports', checkMaintenanceMode, schoolAuth, reportsRoutes);
router.use('/certificates', checkMaintenanceMode, schoolAuth, certificateRoutes);
router.use('/invoices', checkMaintenanceMode, schoolAuth, invoiceRoutes);
router.use('/appraisals', checkMaintenanceMode, schoolAuth, appraisalRoutes);
router.use('/calendar', checkMaintenanceMode, schoolAuth, calendarRoutes);

// Trip and training management
router.use('/trips', checkMaintenanceMode, schoolAuth, tripsRoutes);
router.use('/training', checkMaintenanceMode, schoolAuth, trainingRoutes);

// Real-time and marketplace
router.use('/realtime', checkMaintenanceMode, schoolAuth, realtimeRoutes);
router.use('/marketplace', checkMaintenanceMode, schoolAuth, marketplaceRoutes);

// Analytics and business intelligence
router.use('/analytics', checkMaintenanceMode, schoolAuth, analyticsRoutes);

// Security and compliance
router.use('/security', checkMaintenanceMode, schoolAuth, securityRoutes);
router.use('/compliance', checkMaintenanceMode, schoolAuth, complianceRoutes);

// Internationalization and cloud features
router.use('/i18n', checkMaintenanceMode, schoolAuth, i18nRoutes);
router.use('/cloud', checkMaintenanceMode, schoolAuth, cloudRoutes);

// Mobile application routes (only for dashboard users)
// Allow parent users access to mobile routes alongside school users
const { authenticate } = require('../middleware/auth');
router.use('/mobile', checkMaintenanceMode, authenticate, mobileRoutes);

// Web dashboard routes (role-guarded inside the router)
router.use('/web/director', checkMaintenanceMode, directorWebRoutes);
router.use('/web/principal', checkMaintenanceMode, principalWebRoutes);
router.use('/web/teacher', checkMaintenanceMode, teacherWebRoutes);
router.use('/web/hr', checkMaintenanceMode, hrWebRoutes);
router.use('/web/finance', checkMaintenanceMode, financeWebRoutes);
router.use('/web/parent', checkMaintenanceMode, parentWebRoutes);

/**
 * ===========================
 * ADMIN APPLICATION ROUTES
 * All routes use adminAuth which:
 * 1. Authenticates users
 * 2. Only allows admin dashboard users (super_admin, engineer, admin_finance, support_hr, sales_marketing)
 * ===========================
 */

// Import bypass maintenance middleware
const { bypassMaintenance } = require('../middleware/auth');

// Admin platform management
router.use('/admin/multi-school', adminAuth, bypassMaintenance, multiSchoolRoutes);
router.use('/admin/subscriptions', adminAuth, bypassMaintenance, subscriptionRoutes);
router.use('/admin/analytics', adminAuth, bypassMaintenance, platformAnalyticsRoutes);
router.use('/admin/hr', adminAuth, bypassMaintenance, adminHrRoutes);
router.use('/admin/trips', adminAuth, bypassMaintenance, adminTripRoutes);
router.use('/admin/crm', adminAuth, bypassMaintenance, adminCrmRoutes);
router.use('/admin/users', adminAuth, bypassMaintenance, adminUserRoutes);
router.use('/admin/config', adminAuth, bypassMaintenance, systemConfigRoutes);
router.use('/admin/regional', adminAuth, bypassMaintenance, regionalRoutes);
router.use('/admin/monitoring', adminAuth, bypassMaintenance, monitoringRoutes);
router.use('/admin/migration', adminAuth, bypassMaintenance, dataMigrationRoutes);
router.use('/admin/integrations', adminAuth, bypassMaintenance, integrationRoutes);
router.use('/admin/compliance', adminAuth, bypassMaintenance, adminComplianceRoutes);
router.use('/admin/support', adminAuth, bypassMaintenance, adminSupportRoutes);
router.use('/admin/communication', adminAuth, bypassMaintenance, adminCommunicationRoutes);
// Expose marketplace to admin app as well
router.use('/admin/marketplace', adminAuth, bypassMaintenance, marketplaceRoutes);
// Allow admin app to use upload endpoints too
router.use('/admin/upload', adminAuth, bypassMaintenance, uploadRoutes);

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