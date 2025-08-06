const reportsAnalyticsService = require('../services/reportsAnalyticsService');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} = require('../middleware/errorHandler');

class ReportsAnalyticsController {
  // ==================== REPORT TEMPLATES ====================

  // Create report template
  async createReportTemplate(req, res, next) {
    try {
      const { schoolId } = req.user;
      const templateData = req.body;
      const createdBy = req.user.id;

      // Validate required fields
      const requiredFields = ['templateName', 'templateCode', 'templateType', 'dataSource', 'queryTemplate'];
      for (const field of requiredFields) {
        if (!templateData[field]) {
          throw new ValidationError(`${field} is required`);
        }
      }

      const template = await reportsAnalyticsService.createReportTemplate(templateData, schoolId, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'Report template created successfully',
        data: template
      });
    } catch (error) {
      next(error);
    }
  }

  // List report templates
  async listReportTemplates(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { page = 1, limit = 20, templateType, status, search } = req.query;

      const filters = {};
      if (templateType) filters.templateType = templateType;
      if (status) filters.status = status;
      if (search) filters.search = search;

      const result = await reportsAnalyticsService.listReportTemplates(schoolId, filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        message: 'Report templates retrieved successfully',
        data: result.templates,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== REPORT GENERATION ====================

  // Generate custom report
  async generateCustomReport(req, res, next) {
    try {
      const { schoolId } = req.user;
      const reportData = req.body;
      const createdBy = req.user.id;

      // Validate required fields
      const requiredFields = ['reportName', 'templateId'];
      for (const field of requiredFields) {
        if (!reportData[field]) {
          throw new ValidationError(`${field} is required`);
        }
      }

      const result = await reportsAnalyticsService.generateCustomReport(reportData, schoolId, createdBy);
      
      res.json({
        success: true,
        message: 'Custom report generated successfully',
        data: result.report,
        reportData: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANALYTICS DASHBOARDS ====================

  // Create analytics dashboard
  async createDashboard(req, res, next) {
    try {
      const { schoolId } = req.user;
      const dashboardData = req.body;
      const createdBy = req.user.id;

      // Validate required fields
      const requiredFields = ['dashboardName', 'dashboardCode', 'layoutConfig'];
      for (const field of requiredFields) {
        if (!dashboardData[field]) {
          throw new ValidationError(`${field} is required`);
        }
      }

      const dashboard = await reportsAnalyticsService.createDashboard(dashboardData, schoolId, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'Analytics dashboard created successfully',
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  // Add widget to dashboard
  async addDashboardWidget(req, res, next) {
    try {
      const { schoolId } = req.user;
      const widgetData = req.body;
      const createdBy = req.user.id;

      // Validate required fields
      const requiredFields = ['dashboardId', 'widgetName', 'widgetType', 'dataSource', 'positionConfig'];
      for (const field of requiredFields) {
        if (!widgetData[field]) {
          throw new ValidationError(`${field} is required`);
        }
      }

      const widget = await reportsAnalyticsService.addDashboardWidget(widgetData, schoolId, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'Dashboard widget added successfully',
        data: widget
      });
    } catch (error) {
      next(error);
    }
  }

  // Get dashboard with widgets
  async getDashboard(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { dashboardId } = req.params;

      const result = await reportsAnalyticsService.getDashboard(dashboardId, schoolId);
      
      res.json({
        success: true,
        message: 'Dashboard retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== DATA EXPORTS ====================

  // Create data export
  async createDataExport(req, res, next) {
    try {
      const { schoolId } = req.user;
      const exportData = req.body;
      const createdBy = req.user.id;

      // Validate required fields
      const requiredFields = ['exportName', 'exportType', 'dataSource', 'fileFormat'];
      for (const field of requiredFields) {
        if (!exportData[field]) {
          throw new ValidationError(`${field} is required`);
        }
      }

      const exportRecord = await reportsAnalyticsService.createDataExport(exportData, schoolId, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'Data export created successfully',
        data: exportRecord
      });
    } catch (error) {
      next(error);
    }
  }

  // List exports
  async listExports(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { page = 1, limit = 20, exportType, status } = req.query;

      const filters = {};
      if (exportType) filters.exportType = exportType;
      if (status) filters.status = status;

      const result = await reportsAnalyticsService.listExports(schoolId, filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        message: 'Data exports retrieved successfully',
        data: result.exports,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  // Download export
  async downloadExport(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      // This would typically involve file streaming
      // For now, return a placeholder response
      res.json({
        success: true,
        message: 'Export download initiated',
        data: {
          downloadUrl: `/api/exports/${id}/file`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== SCHEDULED REPORTS ====================

  // Schedule report
  async scheduleReport(req, res, next) {
    try {
      const { schoolId } = req.user;
      const scheduleData = req.body;
      const createdBy = req.user.id;

      // Validate required fields
      const requiredFields = ['scheduleName', 'scheduleType', 'scheduleConfig', 'templateId', 'deliveryMethod'];
      for (const field of requiredFields) {
        if (!scheduleData[field]) {
          throw new ValidationError(`${field} is required`);
        }
      }

      const schedule = await reportsAnalyticsService.scheduleReport(scheduleData, schoolId, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'Report scheduled successfully',
        data: schedule
      });
    } catch (error) {
      next(error);
    }
  }

  // List scheduled reports
  async listScheduledReports(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { page = 1, limit = 20, status, scheduleType } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (scheduleType) filters.scheduleType = scheduleType;

      const result = await reportsAnalyticsService.listScheduledReports(schoolId, filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        message: 'Scheduled reports retrieved successfully',
        data: result.schedules,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== KPI MANAGEMENT ====================

  // Create KPI definition
  async createKpiDefinition(req, res, next) {
    try {
      const { schoolId } = req.user;
      const kpiData = req.body;
      const createdBy = req.user.id;

      // Validate required fields
      const requiredFields = ['kpiName', 'kpiCode', 'kpiType', 'calculationMethod', 'dataSource', 'queryTemplate'];
      for (const field of requiredFields) {
        if (!kpiData[field]) {
          throw new ValidationError(`${field} is required`);
        }
      }

      const kpi = await reportsAnalyticsService.createKpiDefinition(kpiData, schoolId, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'KPI definition created successfully',
        data: kpi
      });
    } catch (error) {
      next(error);
    }
  }

  // Calculate KPI value
  async calculateKpiValue(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { kpiId } = req.params;
      const { date, contextData } = req.body;

      const kpiValue = await reportsAnalyticsService.calculateKpiValue(kpiId, schoolId, date, contextData);
      
      res.json({
        success: true,
        message: 'KPI value calculated successfully',
        data: kpiValue
      });
    } catch (error) {
      next(error);
    }
  }

  // Get KPI values
  async getKpiValues(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { kpiIds, startDate, endDate } = req.query;

      let kpiIdsArray = null;
      if (kpiIds) {
        kpiIdsArray = kpiIds.split(',').map(id => id.trim());
      }

      let dateRange = null;
      if (startDate && endDate) {
        dateRange = { start: startDate, end: endDate };
      }

      const kpiValues = await reportsAnalyticsService.getKpiValues(schoolId, kpiIdsArray, dateRange);
      
      res.json({
        success: true,
        message: 'KPI values retrieved successfully',
        data: kpiValues
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== PRE-BUILT REPORTS ====================

  // Academic performance reports
  async getAcademicPerformanceReport(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { academicYear, term, classId, subjectId } = req.query;

      // This would use a predefined template for academic performance
      const templateData = {
        templateName: 'Academic Performance Report',
        templateCode: 'ACAD_PERF',
        parameters: {
          academicYear: academicYear || new Date().getFullYear(),
          term: term || 'current',
          classId: classId || null,
          subjectId: subjectId || null
        }
      };

      const result = await reportsAnalyticsService.generateCustomReport(templateData, schoolId, req.user.id);
      
      res.json({
        success: true,
        message: 'Academic performance report generated successfully',
        data: result.report,
        reportData: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  // Financial summary reports
  async getFinancialSummaryReport(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate, reportType } = req.query;

      const templateData = {
        templateName: 'Financial Summary Report',
        templateCode: 'FIN_SUMMARY',
        parameters: {
          startDate: startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
          reportType: reportType || 'summary'
        }
      };

      const result = await reportsAnalyticsService.generateCustomReport(templateData, schoolId, req.user.id);
      
      res.json({
        success: true,
        message: 'Financial summary report generated successfully',
        data: result.report,
        reportData: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  // Attendance analysis reports
  async getAttendanceAnalysisReport(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate, classId, studentId } = req.query;

      const templateData = {
        templateName: 'Attendance Analysis Report',
        templateCode: 'ATT_ANALYSIS',
        parameters: {
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
          classId: classId || null,
          studentId: studentId || null
        }
      };

      const result = await reportsAnalyticsService.generateCustomReport(templateData, schoolId, req.user.id);
      
      res.json({
        success: true,
        message: 'Attendance analysis report generated successfully',
        data: result.report,
        reportData: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  // Staff utilization reports
  async getStaffUtilizationReport(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { departmentId, startDate, endDate } = req.query;

      const templateData = {
        templateName: 'Staff Utilization Report',
        templateCode: 'STAFF_UTIL',
        parameters: {
          startDate: startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
          departmentId: departmentId || null
        }
      };

      const result = await reportsAnalyticsService.generateCustomReport(templateData, schoolId, req.user.id);
      
      res.json({
        success: true,
        message: 'Staff utilization report generated successfully',
        data: result.report,
        reportData: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANALYTICS DASHBOARDS ====================

  // Main analytics dashboard
  async getMainAnalyticsDashboard(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { dashboardId = 'main' } = req.query;

      // Get or create main dashboard
      let dashboard;
      try {
        dashboard = await reportsAnalyticsService.getDashboard(dashboardId, schoolId);
      } catch (error) {
        if (error instanceof NotFoundError) {
          // Create default main dashboard
          const dashboardData = {
            dashboardName: 'Main Analytics Dashboard',
            dashboardCode: 'main',
            description: 'Default analytics dashboard',
            layoutConfig: { layout: 'grid', columns: 3 },
            theme: 'default',
            isPublic: true
          };
          
          dashboard = await reportsAnalyticsService.createDashboard(dashboardData, schoolId, req.user.id);
        } else {
          throw error;
        }
      }
      
      res.json({
        success: true,
        message: 'Main analytics dashboard retrieved successfully',
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  // Trend analysis
  async getTrendAnalysis(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { metric, period, startDate, endDate } = req.query;

      // This would analyze trends for the specified metric
      const trendData = {
        metric: metric || 'student_enrollment',
        period: period || 'monthly',
        startDate: startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: endDate || new Date().toISOString().split('T')[0],
        trends: [
          { date: '2024-01', value: 150, change: 5.2 },
          { date: '2024-02', value: 155, change: 3.3 },
          { date: '2024-03', value: 160, change: 3.2 }
        ]
      };
      
      res.json({
        success: true,
        message: 'Trend analysis retrieved successfully',
        data: trendData
      });
    } catch (error) {
      next(error);
    }
  }

  // Predictive analytics
  async getPredictiveAnalytics(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { metric, horizon } = req.query;

      // This would provide predictive analytics
      const predictions = {
        metric: metric || 'student_enrollment',
        horizon: horizon || '6_months',
        predictions: [
          { date: '2024-04', predictedValue: 165, confidence: 0.85 },
          { date: '2024-05', predictedValue: 170, confidence: 0.82 },
          { date: '2024-06', predictedValue: 175, confidence: 0.78 }
        ],
        factors: ['seasonal_trends', 'historical_growth', 'market_conditions']
      };
      
      res.json({
        success: true,
        message: 'Predictive analytics retrieved successfully',
        data: predictions
      });
    } catch (error) {
      next(error);
    }
  }

  // Comparative analysis
  async getComparativeAnalysis(req, res, next) {
    try {
      const { schoolId } = req.user;
      const { metric, comparisonType, baseline, current } = req.query;

      // This would provide comparative analysis
      const comparison = {
        metric: metric || 'academic_performance',
        comparisonType: comparisonType || 'period_comparison',
        baseline: baseline || 'previous_year',
        current: current || 'current_year',
        comparison: {
          baselineValue: 75.5,
          currentValue: 78.2,
          change: 2.7,
          changePercentage: 3.6,
          trend: 'improving'
        }
      };
      
      res.json({
        success: true,
        message: 'Comparative analysis retrieved successfully',
        data: comparison
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== UTILITY ENDPOINTS ====================

  // Get analytics statistics
  async getAnalyticsStatistics(req, res, next) {
    try {
      const { schoolId } = req.user;

      const statistics = await reportsAnalyticsService.getAnalyticsStatistics(schoolId);
      
      res.json({
        success: true,
        message: 'Analytics statistics retrieved successfully',
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }

  // Clean up expired cache
  async cleanupExpiredCache(req, res, next) {
    try {
      const cleanedCount = await reportsAnalyticsService.cleanupExpiredCache();
      
      res.json({
        success: true,
        message: 'Expired cache cleaned up successfully',
        data: { cleanedCount }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportsAnalyticsController(); 