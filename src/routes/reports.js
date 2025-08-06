const express = require('express');
const router = express.Router();
const reportsAnalyticsController = require('../controllers/reportsAnalyticsController');
const { authenticate, requireRole } = require('../middleware/auth');

// ==================== REPORT TEMPLATES ====================

// Create report template
router.post('/templates', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.createReportTemplate
);

// List report templates
router.get('/templates', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher', 'finance']), 
  reportsAnalyticsController.listReportTemplates
);

// ==================== REPORT GENERATION ====================

// Generate custom report
router.post('/custom', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher', 'finance']), 
  reportsAnalyticsController.generateCustomReport
);

// ==================== PRE-BUILT REPORTS ====================

// Academic performance reports
router.get('/academic/performance', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher']), 
  reportsAnalyticsController.getAcademicPerformanceReport
);

// Financial summary reports
router.get('/financial/summary', 
  authenticate, 
  requireRole(['school_director', 'principal', 'finance']), 
  reportsAnalyticsController.getFinancialSummaryReport
);

// Attendance analysis reports
router.get('/attendance/analysis', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher']), 
  reportsAnalyticsController.getAttendanceAnalysisReport
);

// Staff utilization reports
router.get('/staff/utilization', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.getStaffUtilizationReport
);

// ==================== ANALYTICS DASHBOARDS ====================

// Create analytics dashboard
router.post('/dashboards', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.createDashboard
);

// Add widget to dashboard
router.post('/dashboards/widgets', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.addDashboardWidget
);

// Get dashboard with widgets
router.get('/dashboards/:dashboardId', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher', 'finance']), 
  reportsAnalyticsController.getDashboard
);

// Main analytics dashboard
router.get('/analytics/dashboard', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher', 'finance']), 
  reportsAnalyticsController.getMainAnalyticsDashboard
);

// ==================== ANALYTICS ANALYSIS ====================

// Trend analysis
router.get('/analytics/trends', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.getTrendAnalysis
);

// Predictive analytics
router.get('/analytics/predictions', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.getPredictiveAnalytics
);

// Comparative analysis
router.get('/analytics/comparisons', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.getComparativeAnalysis
);

// ==================== DATA EXPORTS ====================

// Create data export
router.post('/exports/students', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.createDataExport
);

// Create financial export
router.post('/exports/financial', 
  authenticate, 
  requireRole(['school_director', 'principal', 'finance']), 
  reportsAnalyticsController.createDataExport
);

// List exports
router.get('/exports/history', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'finance']), 
  reportsAnalyticsController.listExports
);

// Download export
router.get('/exports/:id/download', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'finance']), 
  reportsAnalyticsController.downloadExport
);

// ==================== SCHEDULED REPORTS ====================

// Schedule report
router.post('/schedule', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.scheduleReport
);

// List scheduled reports
router.get('/scheduled', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.listScheduledReports
);

// ==================== KPI MANAGEMENT ====================

// Create KPI definition
router.post('/kpi/definitions', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.createKpiDefinition
);

// Calculate KPI value
router.post('/kpi/:kpiId/calculate', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.calculateKpiValue
);

// Get KPI values
router.get('/kpi/values', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher', 'finance']), 
  reportsAnalyticsController.getKpiValues
);

// ==================== UTILITY ENDPOINTS ====================

// Get analytics statistics
router.get('/analytics/statistics', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  reportsAnalyticsController.getAnalyticsStatistics
);

// Clean up expired cache
router.post('/analytics/cleanup-cache', 
  authenticate, 
  requireRole(['school_director', 'principal']), 
  reportsAnalyticsController.cleanupExpiredCache
);

module.exports = router; 