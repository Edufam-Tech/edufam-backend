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

// Admin routes
const multiSchoolRoutes = require('./admin/multiSchool');
const subscriptionRoutes = require('./admin/subscriptions');
const platformAnalyticsRoutes = require('./admin/platformAnalytics');
const adminHrRoutes = require('./admin/hr');
const adminTripRoutes = require('./admin/trips');
const adminUserRoutes = require('./admin/adminUsers');
const systemConfigRoutes = require('./admin/systemConfig');
const regionalRoutes = require('./admin/regional');
const monitoringRoutes = require('./admin/monitoring');
const dataMigrationRoutes = require('./admin/dataMigration');
const integrationRoutes = require('./admin/integrations');
const adminComplianceRoutes = require('./admin/compliance');



const router = express.Router();

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
router.use('/users', schoolAuth, userRoutes);
router.use('/upload', schoolAuth, uploadRoutes);
router.use('/schools', schoolAuth, schoolRoutesOld);
router.use('/school', schoolAuth, schoolRoutes);
router.use('/students', schoolAuth, studentRoutes);
router.use('/staff', schoolAuth, staffRoutes);
router.use('/departments', schoolAuth, departmentRoutes);

// Academic management routes
router.use('/academic', schoolAuth, academicRoutes);
router.use('/examinations', schoolAuth, examinationRoutes);
router.use('/curriculum', schoolAuth, curriculumRoutes);
router.use('/timetable', schoolAuth, timetableRoutes);
router.use('/ai-timetable', schoolAuth, aiTimetableRoutes);

// Financial management routes
router.use('/financial', schoolAuth, financialRoutes);
router.use('/expenses', schoolAuth, expenseRoutes);
router.use('/payroll', schoolAuth, payrollRoutes);

// Operations management routes
router.use('/transport', schoolAuth, transportRoutes);
router.use('/hr', schoolAuth, hrRoutes);
router.use('/performance', schoolAuth, performanceRoutes);
router.use('/inventory', schoolAuth, inventoryRoutes);

// Communication and reporting routes
router.use('/communication', schoolAuth, communicationRoutes);
router.use('/reports', schoolAuth, reportsRoutes);
router.use('/certificates', schoolAuth, certificateRoutes);
router.use('/invoices', schoolAuth, invoiceRoutes);
router.use('/appraisals', schoolAuth, appraisalRoutes);

// Trip and training management
router.use('/trips', schoolAuth, tripsRoutes);
router.use('/training', schoolAuth, trainingRoutes);

// Real-time and marketplace
router.use('/realtime', schoolAuth, realtimeRoutes);
router.use('/marketplace', schoolAuth, marketplaceRoutes);

// Analytics and business intelligence
router.use('/analytics', schoolAuth, analyticsRoutes);

// Security and compliance
router.use('/security', schoolAuth, securityRoutes);
router.use('/compliance', schoolAuth, complianceRoutes);

// Internationalization and cloud features
router.use('/i18n', schoolAuth, i18nRoutes);
router.use('/cloud', schoolAuth, cloudRoutes);

// Mobile application routes (only for dashboard users)
router.use('/mobile', schoolAuth, mobileRoutes);

/**
 * ===========================
 * ADMIN APPLICATION ROUTES
 * All routes use adminAuth which:
 * 1. Authenticates users
 * 2. Only allows admin dashboard users (super_admin, engineer, admin_finance, support_hr, sales_marketing)
 * ===========================
 */

// Admin platform management
router.use('/admin/multi-school', adminAuth, multiSchoolRoutes);
router.use('/admin/subscriptions', adminAuth, subscriptionRoutes);
router.use('/admin/analytics', adminAuth, platformAnalyticsRoutes);
router.use('/admin/hr', adminAuth, adminHrRoutes);
router.use('/admin/trips', adminAuth, adminTripRoutes);
router.use('/admin/users', adminAuth, adminUserRoutes);
router.use('/admin/config', adminAuth, systemConfigRoutes);
router.use('/admin/regional', adminAuth, regionalRoutes);
router.use('/admin/monitoring', adminAuth, monitoringRoutes);
router.use('/admin/migration', adminAuth, dataMigrationRoutes);
router.use('/admin/integrations', adminAuth, integrationRoutes);
router.use('/admin/compliance', adminAuth, adminComplianceRoutes);

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
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        type: 'ValidationError',
        message: error.message,
        details: error.errors
      }
    });
  }
  
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: {
        type: 'AuthenticationError',
        message: 'Authentication required'
      }
    });
  }

  if (error.name === 'AccessDeniedError') {
    return res.status(403).json({
      success: false,
      error: {
        type: 'AccessDeniedError',
        message: error.message || 'Access denied'
      }
    });
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    error: {
      type: 'InternalServerError',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message
    }
  });
});

module.exports = router; 