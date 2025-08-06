const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../../middleware/auth');
const DataMigrationController = require('../../controllers/admin/dataMigrationController');

// Apply admin authentication to all routes
router.use(authenticate);
router.use(requireUserType('platform_admin'));

// =============================================================================
// DATA EXPORT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/migration/export/templates
 * @desc    Get available export templates
 * @access  Private (Platform Admin)
 */
router.get('/export/templates',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.getExportTemplates
);

/**
 * @route   POST /api/admin/migration/export/templates
 * @desc    Create export template
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/export/templates',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.createExportTemplate
);

/**
 * @route   POST /api/admin/migration/export/data
 * @desc    Export school data
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/export/data',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.exportSchoolData
);

/**
 * @route   GET /api/admin/migration/export/jobs
 * @desc    Get export jobs
 * @access  Private (Platform Admin)
 */
router.get('/export/jobs',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.getExportJobs
);

/**
 * @route   GET /api/admin/migration/export/jobs/:jobId/download
 * @desc    Download exported data file
 * @access  Private (Platform Admin)
 */
router.get('/export/jobs/:jobId/download',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const { query } = require('../../config/database');

      const job = await query(`
        SELECT * FROM data_export_jobs WHERE id = $1 AND status = 'completed'
      `, [jobId]);

      if (job.rows.length === 0) {
        throw new NotFoundError('Export job not found or not completed');
      }

      // In production, this would serve the actual file
      res.json({
        success: true,
        message: 'File download link generated',
        data: {
          downloadUrl: `https://exports.edufam.com/school-data/${jobId}.zip`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          fileSize: job.rows[0].file_size,
          fileName: `school-export-${jobId}.zip`
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// DATA IMPORT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/migration/import/templates
 * @desc    Get import templates
 * @access  Private (Platform Admin)
 */
router.get('/import/templates',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.getImportTemplates
);

/**
 * @route   POST /api/admin/migration/import/validate
 * @desc    Validate import data
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/import/validate',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.validateImportData
);

/**
 * @route   POST /api/admin/migration/import/execute
 * @desc    Execute import
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/import/execute',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.executeImport
);

/**
 * @route   GET /api/admin/migration/import/jobs
 * @desc    Get import jobs
 * @access  Private (Platform Admin)
 */
router.get('/import/jobs',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.getImportJobs
);

/**
 * @route   GET /api/admin/migration/import/jobs/:jobId
 * @desc    Get import job details
 * @access  Private (Platform Admin)
 */
router.get('/import/jobs/:jobId',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const { query } = require('../../config/database');

      const [job, errors] = await Promise.all([
        query(`
          SELECT 
            dij.*,
            s.name as school_name,
            it.template_name
          FROM data_import_jobs dij
          JOIN schools s ON dij.school_id = s.id
          LEFT JOIN import_templates it ON dij.template_id = it.id
          WHERE dij.id = $1
        `, [jobId]),

        query(`
          SELECT * FROM import_errors 
          WHERE import_job_id = $1 
          ORDER BY row_number, error_type
        `, [jobId])
      ]);

      if (job.rows.length === 0) {
        throw new NotFoundError('Import job not found');
      }

      res.json({
        success: true,
        data: {
          ...job.rows[0],
          validation_results: JSON.parse(job.rows[0].validation_results || '{}'),
          import_statistics: JSON.parse(job.rows[0].import_statistics || '{}'),
          errors: errors.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// BULK MIGRATION ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/migration/projects
 * @desc    Get migration projects
 * @access  Private (Super Admin)
 */
router.get('/projects',
  requireRole(['super_admin']),
  DataMigrationController.getMigrationProjects
);

/**
 * @route   POST /api/admin/migration/projects
 * @desc    Create migration project
 * @access  Private (Super Admin)
 */
router.post('/projects',
  requireRole(['super_admin']),
  DataMigrationController.createMigrationProject
);

/**
 * @route   GET /api/admin/migration/projects/:projectId
 * @desc    Get migration project details
 * @access  Private (Super Admin)
 */
router.get('/projects/:projectId',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const { query } = require('../../config/database');

      const [project, tasks] = await Promise.all([
        query(`
          SELECT * FROM migration_projects WHERE id = $1
        `, [projectId]),

        query(`
          SELECT * FROM migration_tasks 
          WHERE project_id = $1 
          ORDER BY created_at DESC
        `, [projectId])
      ]);

      if (project.rows.length === 0) {
        throw new NotFoundError('Migration project not found');
      }

      res.json({
        success: true,
        data: {
          ...project.rows[0],
          source_schools: JSON.parse(project.rows[0].source_schools || '[]'),
          target_schools: JSON.parse(project.rows[0].target_schools || '[]'),
          migration_rules: JSON.parse(project.rows[0].migration_rules || '{}'),
          execution_logs: JSON.parse(project.rows[0].execution_logs || '[]'),
          tasks: tasks.rows.map(task => ({
            ...task,
            task_parameters: JSON.parse(task.task_parameters || '{}'),
            execution_results: JSON.parse(task.execution_results || '{}')
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/migration/projects/:projectId/execute
 * @desc    Execute migration project
 * @access  Private (Super Admin)
 */
router.post('/projects/:projectId/execute',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      req.body.projectId = projectId;
      return DataMigrationController.executeMigrationProject(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/admin/migration/projects/:projectId
 * @desc    Update migration project
 * @access  Private (Super Admin)
 */
router.put('/projects/:projectId',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const updates = req.body;
      const { query } = require('../../config/database');

      const allowedFields = [
        'project_name', 'description', 'source_schools', 'target_schools',
        'migration_rules', 'scheduled_date', 'priority', 'status'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['source_schools', 'target_schools', 'migration_rules'].includes(key)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(updates[key]));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(updates[key]);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      setClause.push(`updated_by = $${paramIndex}`);
      setClause.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, projectId);

      const result = await query(`
        UPDATE migration_projects 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Migration project not found');
      }

      res.json({
        success: true,
        message: 'Migration project updated successfully',
        data: {
          ...result.rows[0],
          source_schools: JSON.parse(result.rows[0].source_schools || '[]'),
          target_schools: JSON.parse(result.rows[0].target_schools || '[]'),
          migration_rules: JSON.parse(result.rows[0].migration_rules || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// DATA TRANSFORMATION ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/migration/transformation-rules
 * @desc    Get transformation rules
 * @access  Private (Platform Admin)
 */
router.get('/transformation-rules',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.getTransformationRules
);

/**
 * @route   POST /api/admin/migration/transformation-rules
 * @desc    Create transformation rule
 * @access  Private (Super Admin)
 */
router.post('/transformation-rules',
  requireRole(['super_admin']),
  DataMigrationController.createTransformationRule
);

/**
 * @route   PUT /api/admin/migration/transformation-rules/:ruleId
 * @desc    Update transformation rule
 * @access  Private (Super Admin)
 */
router.put('/transformation-rules/:ruleId',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;
      const { query } = require('../../config/database');

      const allowedFields = [
        'rule_name', 'description', 'source_fields', 'target_fields',
        'transformation_logic', 'validation_rules', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['source_fields', 'target_fields', 'transformation_logic', 'validation_rules'].includes(key)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(updates[key]));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(updates[key]);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      setClause.push(`updated_by = $${paramIndex}`);
      setClause.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, ruleId);

      const result = await query(`
        UPDATE transformation_rules 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Transformation rule not found');
      }

      res.json({
        success: true,
        message: 'Transformation rule updated successfully',
        data: {
          ...result.rows[0],
          source_fields: JSON.parse(result.rows[0].source_fields || '[]'),
          target_fields: JSON.parse(result.rows[0].target_fields || '[]'),
          transformation_logic: JSON.parse(result.rows[0].transformation_logic || '{}'),
          validation_rules: JSON.parse(result.rows[0].validation_rules || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/migration/transformation-rules/:ruleId/test
 * @desc    Test transformation rule
 * @access  Private (Super Admin)
 */
router.post('/transformation-rules/:ruleId/test',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { ruleId } = req.params;
      const { testData } = req.body;
      const { query } = require('../../config/database');

      const rule = await query(`
        SELECT * FROM transformation_rules WHERE id = $1
      `, [ruleId]);

      if (rule.rows.length === 0) {
        throw new NotFoundError('Transformation rule not found');
      }

      // In production, this would apply the actual transformation logic
      const transformationResult = {
        originalData: testData,
        transformedData: testData, // Simplified - would apply actual transformation
        success: true,
        warnings: [],
        errors: []
      };

      res.json({
        success: true,
        message: 'Transformation rule tested successfully',
        data: transformationResult
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// DATA BACKUP AND RESTORE ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/migration/backups
 * @desc    Get backups
 * @access  Private (Platform Admin)
 */
router.get('/backups',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.getBackups
);

/**
 * @route   POST /api/admin/migration/backups
 * @desc    Create backup
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/backups',
  requireRole(['super_admin', 'regional_admin']),
  DataMigrationController.createBackup
);

/**
 * @route   GET /api/admin/migration/backups/:backupId/download
 * @desc    Download backup file
 * @access  Private (Super Admin, Regional Admin)
 */
router.get('/backups/:backupId/download',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { backupId } = req.params;
      const { query } = require('../../config/database');

      const backup = await query(`
        SELECT * FROM data_backups WHERE id = $1 AND status = 'completed'
      `, [backupId]);

      if (backup.rows.length === 0) {
        throw new NotFoundError('Backup not found or not completed');
      }

      res.json({
        success: true,
        message: 'Backup download link generated',
        data: {
          downloadUrl: `https://backups.edufam.com/school-backup/${backupId}.zip`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          fileSize: backup.rows[0].file_size,
          fileName: `school-backup-${backupId}.zip`
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/migration/backups/:backupId/restore
 * @desc    Restore from backup
 * @access  Private (Super Admin)
 */
router.post('/backups/:backupId/restore',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { backupId } = req.params;
      const { targetSchoolId, restoreOptions = {} } = req.body;
      const { query } = require('../../config/database');

      if (!targetSchoolId) {
        throw new ValidationError('Target school ID is required');
      }

      const backup = await query(`
        SELECT * FROM data_backups WHERE id = $1 AND status = 'completed'
      `, [backupId]);

      if (backup.rows.length === 0) {
        throw new NotFoundError('Backup not found or not completed');
      }

      // Create restore job
      const restoreJob = await query(`
        INSERT INTO data_restore_jobs (
          backup_id, target_school_id, restore_options, status,
          created_by, created_by_name
        ) VALUES ($1, $2, $3, 'pending', $4, $5)
        RETURNING *
      `, [
        backupId, targetSchoolId, JSON.stringify(restoreOptions),
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.json({
        success: true,
        message: 'Restore job created successfully',
        data: {
          restoreJobId: restoreJob.rows[0].id,
          status: 'pending',
          estimatedDuration: '30-60 minutes'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// MIGRATION MONITORING AND ANALYTICS
// =============================================================================

/**
 * @route   GET /api/admin/migration/analytics
 * @desc    Get migration analytics
 * @access  Private (Super Admin)
 */
router.get('/analytics',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { period = '30d' } = req.query;
      const { query } = require('../../config/database');

      const timeInterval = period === '7d' ? '7 days' : 
                          period === '30d' ? '30 days' : 
                          period === '90d' ? '90 days' : '30 days';

      const [
        exportStats,
        importStats,
        migrationStats,
        backupStats,
        errorAnalysis
      ] = await Promise.all([
        // Export statistics
        query(`
          SELECT 
            COUNT(*) as total_exports,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_exports,
            SUM(record_count) as total_records_exported,
            AVG(file_size) as avg_file_size
          FROM data_export_jobs
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
        `),

        // Import statistics
        query(`
          SELECT 
            COUNT(*) as total_imports,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_imports,
            SUM(record_count) as total_records_imported,
            AVG(CASE WHEN import_statistics IS NOT NULL 
                THEN (import_statistics->>'successfulRecords')::int END) as avg_success_rate
          FROM data_import_jobs
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
        `),

        // Migration project statistics
        query(`
          SELECT 
            COUNT(*) as total_projects,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_projects,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/3600) as avg_duration_hours
          FROM migration_projects
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
        `),

        // Backup statistics
        query(`
          SELECT 
            COUNT(*) as total_backups,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
            SUM(file_size) as total_backup_size,
            COUNT(DISTINCT school_id) as schools_backed_up
          FROM data_backups
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
        `),

        // Error analysis
        query(`
          SELECT 
            'export' as operation_type,
            COUNT(*) as error_count
          FROM data_export_jobs
          WHERE status = 'failed' 
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          
          UNION ALL
          
          SELECT 
            'import' as operation_type,
            COUNT(*) as error_count
          FROM data_import_jobs
          WHERE status = 'failed'
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          
          UNION ALL
          
          SELECT 
            'migration' as operation_type,
            COUNT(*) as error_count
          FROM migration_projects
          WHERE status = 'failed'
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
        `)
      ]);

      res.json({
        success: true,
        data: {
          period,
          exports: exportStats.rows[0],
          imports: importStats.rows[0],
          migrations: migrationStats.rows[0],
          backups: backupStats.rows[0],
          errors: errorAnalysis.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;