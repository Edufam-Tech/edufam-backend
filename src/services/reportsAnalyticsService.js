const { query } = require('../config/database');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} = require('../middleware/errorHandler');

class ReportsAnalyticsService {
  // ==================== REPORT TEMPLATES ====================

  // Create report template
  async createReportTemplate(templateData, schoolId, createdBy) {
    try {
      const {
        templateName,
        templateCode,
        description,
        templateType,
        dataSource,
        queryTemplate,
        parameters,
        displayFormat,
        chartType,
        columnMapping,
        isPublic,
        allowedRoles
      } = templateData;

      // Check if template code already exists for this school
      const existingTemplate = await query(`
        SELECT id FROM report_templates 
        WHERE school_id = $1 AND template_code = $2
      `, [schoolId, templateCode]);

      if (existingTemplate.rows.length > 0) {
        throw new ConflictError('Template with this code already exists');
      }

      const result = await query(`
        INSERT INTO report_templates (
          school_id, template_name, template_code, description, template_type,
          data_source, query_template, parameters, display_format, chart_type,
          column_mapping, is_public, allowed_roles, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        schoolId,
        templateName,
        templateCode,
        description || null,
        templateType,
        dataSource,
        queryTemplate,
        parameters || null,
        displayFormat || 'table',
        chartType || null,
        columnMapping || null,
        isPublic || false,
        allowedRoles || null,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create report template');
    }
  }

  // List report templates
  async listReportTemplates(schoolId, filters = {}, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      let whereConditions = ['school_id = $1'];
      let params = [schoolId];
      let paramCount = 1;

      if (filters.templateType) {
        paramCount++;
        whereConditions.push(`template_type = $${paramCount}`);
        params.push(filters.templateType);
      }

      if (filters.status) {
        paramCount++;
        whereConditions.push(`status = $${paramCount}`);
        params.push(filters.status);
      }

      if (filters.search) {
        paramCount++;
        whereConditions.push(`(
          template_name ILIKE $${paramCount} OR 
          template_code ILIKE $${paramCount}
        )`);
        params.push(`%${filters.search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      const countResult = await query(`
        SELECT COUNT(*) as total FROM report_templates WHERE ${whereClause}
      `, params);

      const templatesResult = await query(`
        SELECT * FROM report_templates 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      return {
        templates: templatesResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to list report templates');
    }
  }

  // ==================== REPORT GENERATION ====================

  // Generate custom report
  async generateCustomReport(reportData, schoolId, createdBy) {
    try {
      const {
        reportName,
        templateId,
        parameters,
        outputFormat = 'json'
      } = reportData;

      // Get template
      const templateResult = await query(`
        SELECT * FROM report_templates 
        WHERE id = $1 AND school_id = $2 AND status = 'active'
      `, [templateId, schoolId]);

      if (templateResult.rows.length === 0) {
        throw new NotFoundError('Report template not found');
      }

      const template = templateResult.rows[0];

      // Execute query with parameters
      const queryResult = await this.executeReportQuery(template, parameters, schoolId);
      
      // Generate report file if needed
      let filePath = null;
      let fileSize = 0;
      if (outputFormat !== 'json') {
        const fileResult = await this.generateReportFile(queryResult, outputFormat, reportName);
        filePath = fileResult.filePath;
        fileSize = fileResult.fileSize;
      }

      // Save report record
      const result = await query(`
        INSERT INTO saved_reports (
          school_id, template_id, report_name, report_type, parameters_used,
          query_executed, result_summary, file_path, file_size, file_format,
          generation_time, row_count, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        schoolId,
        templateId,
        reportName,
        template.template_type,
        JSON.stringify(parameters),
        template.query_template,
        JSON.stringify(this.generateResultSummary(queryResult)),
        filePath,
        fileSize,
        outputFormat,
        Date.now(), // Placeholder for actual generation time
        queryResult.length,
        createdBy
      ]);

      return {
        report: result.rows[0],
        data: queryResult
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to generate custom report');
    }
  }

  // Execute report query with parameters
  async executeReportQuery(template, parameters, schoolId) {
    try {
      let sql = template.query_template;
      const params = [schoolId];
      let paramCount = 1;

      // Replace placeholders with actual parameters
      if (template.parameters && parameters) {
        for (const [key, value] of Object.entries(parameters)) {
          const placeholder = `$${key}`;
          if (sql.includes(placeholder)) {
            sql = sql.replace(new RegExp(placeholder, 'g'), `$${paramCount + 1}`);
            params.push(value);
            paramCount++;
          }
        }
      }

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to execute report query');
    }
  }

  // Generate result summary
  generateResultSummary(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { count: 0, summary: 'No data found' };
    }

    const summary = {
      count: data.length,
      fields: Object.keys(data[0]),
      sampleData: data.slice(0, 3)
    };

    // Add numeric summaries if applicable
    const numericFields = Object.keys(data[0]).filter(field => 
      typeof data[0][field] === 'number'
    );

    if (numericFields.length > 0) {
      summary.numericSummaries = {};
      for (const field of numericFields) {
        const values = data.map(row => row[field]).filter(val => val !== null);
        if (values.length > 0) {
          summary.numericSummaries[field] = {
            sum: values.reduce((a, b) => a + b, 0),
            average: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
          };
        }
      }
    }

    return summary;
  }

  // Generate report file (placeholder implementation)
  async generateReportFile(data, format, filename) {
    // This would integrate with a file generation library
    // For now, return placeholder values
    return {
      filePath: `/reports/${filename}.${format}`,
      fileSize: JSON.stringify(data).length
    };
  }

  // ==================== ANALYTICS DASHBOARDS ====================

  // Create analytics dashboard
  async createDashboard(dashboardData, schoolId, createdBy) {
    try {
      const {
        dashboardName,
        dashboardCode,
        description,
        layoutConfig,
        theme,
        isPublic,
        allowedRoles,
        sharedWith
      } = dashboardData;

      // Check if dashboard code already exists
      const existingDashboard = await query(`
        SELECT id FROM analytics_dashboards 
        WHERE school_id = $1 AND dashboard_code = $2
      `, [schoolId, dashboardCode]);

      if (existingDashboard.rows.length > 0) {
        throw new ConflictError('Dashboard with this code already exists');
      }

      const result = await query(`
        INSERT INTO analytics_dashboards (
          school_id, dashboard_name, dashboard_code, description, layout_config,
          theme, is_public, allowed_roles, shared_with, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        schoolId,
        dashboardName,
        dashboardCode,
        description || null,
        layoutConfig,
        theme || 'default',
        isPublic || false,
        allowedRoles || null,
        sharedWith || null,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create dashboard');
    }
  }

  // Add widget to dashboard
  async addDashboardWidget(widgetData, schoolId, createdBy) {
    try {
      const {
        dashboardId,
        widgetName,
        widgetType,
        dataSource,
        queryConfig,
        refreshInterval,
        positionConfig,
        displayConfig
      } = widgetData;

      const result = await query(`
        INSERT INTO dashboard_widgets (
          dashboard_id, school_id, widget_name, widget_type, data_source,
          query_config, refresh_interval, position_config, display_config, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        dashboardId,
        schoolId,
        widgetName,
        widgetType,
        dataSource,
        queryConfig || null,
        refreshInterval || 0,
        positionConfig,
        displayConfig || null,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to add dashboard widget');
    }
  }

  // Get dashboard with widgets
  async getDashboard(dashboardId, schoolId) {
    try {
      const dashboardResult = await query(`
        SELECT * FROM analytics_dashboards 
        WHERE id = $1 AND school_id = $2
      `, [dashboardId, schoolId]);

      if (dashboardResult.rows.length === 0) {
        throw new NotFoundError('Dashboard not found');
      }

      const widgetsResult = await query(`
        SELECT * FROM dashboard_widgets 
        WHERE dashboard_id = $1 AND school_id = $2
        ORDER BY created_at ASC
      `, [dashboardId, schoolId]);

      return {
        dashboard: dashboardResult.rows[0],
        widgets: widgetsResult.rows
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to get dashboard');
    }
  }

  // ==================== DATA EXPORTS ====================

  // Create data export
  async createDataExport(exportData, schoolId, createdBy) {
    try {
      const {
        exportName,
        exportType,
        dataSource,
        filtersApplied,
        columnsIncluded,
        sortOrder,
        fileFormat
      } = exportData;

      // Generate export file
      const exportResult = await this.generateExportFile(
        dataSource, 
        filtersApplied, 
        columnsIncluded, 
        sortOrder, 
        fileFormat,
        schoolId
      );

      const result = await query(`
        INSERT INTO data_exports (
          school_id, export_name, export_type, data_source, filters_applied,
          columns_included, sort_order, file_path, file_name, file_size,
          file_format, status, row_count, generation_time, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        schoolId,
        exportName,
        exportType,
        dataSource,
        filtersApplied || null,
        columnsIncluded || null,
        sortOrder || null,
        exportResult.filePath,
        exportResult.fileName,
        exportResult.fileSize,
        fileFormat,
        'completed',
        exportResult.rowCount,
        exportResult.generationTime,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to create data export');
    }
  }

  // Generate export file (placeholder implementation)
  async generateExportFile(dataSource, filters, columns, sortOrder, format, schoolId) {
    // This would integrate with a file generation library
    // For now, return placeholder values
    return {
      filePath: `/exports/${dataSource}_${Date.now()}.${format}`,
      fileName: `${dataSource}_export.${format}`,
      fileSize: 1024,
      rowCount: 100,
      generationTime: 5000
    };
  }

  // List exports
  async listExports(schoolId, filters = {}, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      let whereConditions = ['school_id = $1'];
      let params = [schoolId];
      let paramCount = 1;

      if (filters.exportType) {
        paramCount++;
        whereConditions.push(`export_type = $${paramCount}`);
        params.push(filters.exportType);
      }

      if (filters.status) {
        paramCount++;
        whereConditions.push(`status = $${paramCount}`);
        params.push(filters.status);
      }

      const whereClause = whereConditions.join(' AND ');

      const countResult = await query(`
        SELECT COUNT(*) as total FROM data_exports WHERE ${whereClause}
      `, params);

      const exportsResult = await query(`
        SELECT * FROM data_exports 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      return {
        exports: exportsResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to list exports');
    }
  }

  // ==================== SCHEDULED REPORTS ====================

  // Schedule report
  async scheduleReport(scheduleData, schoolId, createdBy) {
    try {
      const {
        scheduleName,
        scheduleType,
        cronExpression,
        scheduleConfig,
        templateId,
        parameters,
        outputFormat,
        deliveryMethod,
        recipients,
        emailTemplate
      } = scheduleData;

      // Calculate next run time
      const nextRun = this.calculateNextRunTime(scheduleType, scheduleConfig, cronExpression);

      const result = await query(`
        INSERT INTO scheduled_reports (
          school_id, template_id, schedule_name, schedule_type, cron_expression,
          schedule_config, parameters, output_format, delivery_method, recipients,
          email_template, next_run, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        schoolId,
        templateId,
        scheduleName,
        scheduleType,
        cronExpression || null,
        scheduleConfig,
        parameters || null,
        outputFormat || 'pdf',
        deliveryMethod,
        recipients || null,
        emailTemplate || null,
        nextRun,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to schedule report');
    }
  }

  // Calculate next run time (simplified implementation)
  calculateNextRunTime(scheduleType, scheduleConfig, cronExpression) {
    const now = new Date();
    
    switch (scheduleType) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      case 'quarterly':
        return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
      case 'yearly':
        return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to daily
    }
  }

  // List scheduled reports
  async listScheduledReports(schoolId, filters = {}, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      let whereConditions = ['school_id = $1'];
      let params = [schoolId];
      let paramCount = 1;

      if (filters.status) {
        paramCount++;
        whereConditions.push(`status = $${paramCount}`);
        params.push(filters.status);
      }

      if (filters.scheduleType) {
        paramCount++;
        whereConditions.push(`schedule_type = $${paramCount}`);
        params.push(filters.scheduleType);
      }

      const whereClause = whereConditions.join(' AND ');

      const countResult = await query(`
        SELECT COUNT(*) as total FROM scheduled_reports WHERE ${whereClause}
      `, params);

      const schedulesResult = await query(`
        SELECT sr.*, rt.template_name 
        FROM scheduled_reports sr
        LEFT JOIN report_templates rt ON sr.template_id = rt.id
        WHERE ${whereClause}
        ORDER BY next_run ASC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      return {
        schedules: schedulesResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to list scheduled reports');
    }
  }

  // ==================== KPI MANAGEMENT ====================

  // Create KPI definition
  async createKpiDefinition(kpiData, schoolId, createdBy) {
    try {
      const {
        kpiName,
        kpiCode,
        description,
        kpiType,
        calculationMethod,
        dataSource,
        queryTemplate,
        displayFormat,
        unit,
        decimalPlaces,
        targetValue,
        warningThreshold,
        criticalThreshold
      } = kpiData;

      // Check if KPI code already exists
      const existingKpi = await query(`
        SELECT id FROM kpi_definitions 
        WHERE school_id = $1 AND kpi_code = $2
      `, [schoolId, kpiCode]);

      if (existingKpi.rows.length > 0) {
        throw new ConflictError('KPI with this code already exists');
      }

      const result = await query(`
        INSERT INTO kpi_definitions (
          school_id, kpi_name, kpi_code, description, kpi_type, calculation_method,
          data_source, query_template, display_format, unit, decimal_places,
          target_value, warning_threshold, critical_threshold, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        schoolId,
        kpiName,
        kpiCode,
        description || null,
        kpiType,
        calculationMethod,
        dataSource,
        queryTemplate,
        displayFormat || 'number',
        unit || null,
        decimalPlaces || 0,
        targetValue || null,
        warningThreshold || null,
        criticalThreshold || null,
        createdBy
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to create KPI definition');
    }
  }

  // Calculate and store KPI value
  async calculateKpiValue(kpiId, schoolId, date = null, contextData = null) {
    try {
      // Get KPI definition
      const kpiResult = await query(`
        SELECT * FROM kpi_definitions 
        WHERE id = $1 AND school_id = $2 AND status = 'active'
      `, [kpiId, schoolId]);

      if (kpiResult.rows.length === 0) {
        throw new NotFoundError('KPI definition not found');
      }

      const kpi = kpiResult.rows[0];
      const targetDate = date || new Date().toISOString().split('T')[0];

      // Execute KPI calculation
      const value = await this.executeKpiCalculation(kpi, targetDate, schoolId);

      // Store KPI value
      const result = await query(`
        INSERT INTO kpi_values (
          kpi_id, school_id, value_date, calculated_value, context_data
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (kpi_id, value_date) 
        DO UPDATE SET calculated_value = $4, context_data = $5, updated_at = NOW()
        RETURNING *
      `, [kpiId, schoolId, targetDate, value, contextData || null]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to calculate KPI value');
    }
  }

  // Execute KPI calculation
  async executeKpiCalculation(kpi, date, schoolId) {
    try {
      let sql = kpi.query_template;
      const params = [schoolId, date];
      
      // Replace placeholders
      sql = sql.replace('$school_id', '$1');
      sql = sql.replace('$date', '$2');

      const result = await query(sql, params);
      
      if (result.rows.length === 0 || result.rows[0].value === null) {
        return 0;
      }

      return parseFloat(result.rows[0].value);
    } catch (error) {
      throw new DatabaseError('Failed to execute KPI calculation');
    }
  }

  // Get KPI values for dashboard
  async getKpiValues(schoolId, kpiIds = null, dateRange = null) {
    try {
      let sql = `
        SELECT kv.*, kd.kpi_name, kd.kpi_code, kd.display_format, kd.unit,
               kd.target_value, kd.warning_threshold, kd.critical_threshold
        FROM kpi_values kv
        JOIN kpi_definitions kd ON kv.kpi_id = kd.id
        WHERE kv.school_id = $1
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      if (kpiIds && kpiIds.length > 0) {
        paramCount++;
        sql += ` AND kv.kpi_id = ANY($${paramCount})`;
        params.push(kpiIds);
      }

      if (dateRange) {
        paramCount++;
        sql += ` AND kv.value_date >= $${paramCount}`;
        params.push(dateRange.start);
        
        paramCount++;
        sql += ` AND kv.value_date <= $${paramCount}`;
        params.push(dateRange.end);
      }

      sql += ' ORDER BY kv.value_date DESC, kd.kpi_name';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get KPI values');
    }
  }

  // ==================== ANALYTICS CACHE ====================

  // Get cached data
  async getCachedData(cacheKey, schoolId) {
    try {
      const result = await query(`
        SELECT * FROM analytics_cache 
        WHERE cache_key = $1 AND school_id = $2 AND is_valid = true
          AND created_at + INTERVAL '1 second' * ttl_seconds > NOW()
      `, [cacheKey, schoolId]);

      if (result.rows.length > 0) {
        // Update last accessed
        await query(`
          UPDATE analytics_cache 
          SET last_accessed = NOW() 
          WHERE id = $1
        `, [result.rows[0].id]);

        return result.rows[0].cached_data;
      }

      return null;
    } catch (error) {
      throw new DatabaseError('Failed to get cached data');
    }
  }

  // Set cached data
  async setCachedData(cacheKey, data, schoolId, ttlSeconds = 3600) {
    try {
      const dataHash = require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex');

      await query(`
        INSERT INTO analytics_cache (
          school_id, cache_key, cache_type, cached_data, data_hash, ttl_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (school_id, cache_key) 
        DO UPDATE SET 
          cached_data = $4, 
          data_hash = $5, 
          ttl_seconds = $6,
          is_valid = true,
          last_accessed = NOW(),
          updated_at = NOW()
      `, [schoolId, cacheKey, 'report', data, dataHash, ttlSeconds]);

      return true;
    } catch (error) {
      throw new DatabaseError('Failed to set cached data');
    }
  }

  // ==================== UTILITY METHODS ====================

  // Get analytics statistics
  async getAnalyticsStatistics(schoolId) {
    try {
      const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM report_templates WHERE school_id = $1 AND status = 'active') as active_templates,
          (SELECT COUNT(*) FROM saved_reports WHERE school_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days') as reports_last_30_days,
          (SELECT COUNT(*) FROM analytics_dashboards WHERE school_id = $1 AND status = 'active') as active_dashboards,
          (SELECT COUNT(*) FROM scheduled_reports WHERE school_id = $1 AND status = 'active') as active_schedules,
          (SELECT COUNT(*) FROM kpi_definitions WHERE school_id = $1 AND status = 'active') as active_kpis,
          (SELECT COUNT(*) FROM data_exports WHERE school_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days') as exports_last_7_days
      `, [schoolId]);

      return stats.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get analytics statistics');
    }
  }

  // Clean up expired cache
  async cleanupExpiredCache() {
    try {
      const result = await query(`
        DELETE FROM analytics_cache 
        WHERE created_at + INTERVAL '1 second' * ttl_seconds < NOW()
      `);

      return result.rowCount;
    } catch (error) {
      throw new DatabaseError('Failed to cleanup expired cache');
    }
  }
}

module.exports = new ReportsAnalyticsService(); 