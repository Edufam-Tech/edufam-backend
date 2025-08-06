const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../../middleware/auth');
const IntegrationController = require('../../controllers/admin/integrationController');

// Apply admin authentication to all routes
router.use(authenticate);
router.use(requireUserType('platform_admin'));

// =============================================================================
// INTEGRATION SERVICES ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/integrations
 * @desc    Get all integrations
 * @access  Private (Platform Admin)
 */
router.get('/',
  requireRole(['super_admin', 'regional_admin']),
  IntegrationController.getIntegrations
);

/**
 * @route   POST /api/admin/integrations
 * @desc    Create new integration
 * @access  Private (Super Admin)
 */
router.post('/',
  requireRole(['super_admin']),
  IntegrationController.createIntegration
);

/**
 * @route   GET /api/admin/integrations/:id
 * @desc    Get integration details
 * @access  Private (Platform Admin)
 */
router.get('/:id',
  requireRole(['super_admin', 'regional_admin']),
  IntegrationController.getIntegration
);

/**
 * @route   PUT /api/admin/integrations/:id
 * @desc    Update integration
 * @access  Private (Super Admin)
 */
router.put('/:id',
  requireRole(['super_admin']),
  IntegrationController.updateIntegration
);

/**
 * @route   POST /api/admin/integrations/:id/test
 * @desc    Test integration
 * @access  Private (Super Admin)
 */
router.post('/:id/test',
  requireRole(['super_admin']),
  IntegrationController.testIntegration
);

/**
 * @route   DELETE /api/admin/integrations/:id
 * @desc    Delete integration
 * @access  Private (Super Admin)
 */
router.delete('/:id',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { query } = require('../../config/database');

      // Check if integration exists
      const integration = await query(`
        SELECT * FROM integrations WHERE id = $1
      `, [id]);

      if (integration.rows.length === 0) {
        throw new NotFoundError('Integration not found');
      }

      // Soft delete - mark as inactive instead of actual deletion
      const result = await query(`
        UPDATE integrations 
        SET is_active = false,
            status = 'disabled',
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $1,
            updated_by_name = $2
        WHERE id = $3
        RETURNING integration_name
      `, [req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id]);

      res.json({
        success: true,
        message: 'Integration disabled successfully',
        data: { integration_name: result.rows[0].integration_name }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// INTEGRATION TEMPLATES ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/integrations/templates
 * @desc    Get integration templates
 * @access  Private (Platform Admin)
 */
router.get('/templates',
  requireRole(['super_admin', 'regional_admin']),
  IntegrationController.getIntegrationTemplates
);

/**
 * @route   POST /api/admin/integrations/templates
 * @desc    Create integration template
 * @access  Private (Super Admin)
 */
router.post('/templates',
  requireRole(['super_admin']),
  IntegrationController.createIntegrationTemplate
);

/**
 * @route   PUT /api/admin/integrations/templates/:templateId
 * @desc    Update integration template
 * @access  Private (Super Admin)
 */
router.put('/templates/:templateId',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const updates = req.body;
      const { query } = require('../../config/database');

      const allowedFields = [
        'template_name', 'description', 'supported_providers', 'configuration_schema',
        'default_config', 'required_credentials', 'documentation', 'version', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['supported_providers', 'configuration_schema', 'default_config', 'required_credentials'].includes(key)) {
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
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, templateId);

      const result = await query(`
        UPDATE integration_templates 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Integration template not found');
      }

      res.json({
        success: true,
        message: 'Integration template updated successfully',
        data: {
          ...result.rows[0],
          configuration_schema: JSON.parse(result.rows[0].configuration_schema || '{}'),
          default_config: JSON.parse(result.rows[0].default_config || '{}'),
          required_credentials: JSON.parse(result.rows[0].required_credentials || '[]')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// WEBHOOK MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/integrations/webhooks
 * @desc    Get webhooks
 * @access  Private (Platform Admin)
 */
router.get('/webhooks',
  requireRole(['super_admin', 'regional_admin']),
  IntegrationController.getWebhooks
);

/**
 * @route   POST /api/admin/integrations/webhooks
 * @desc    Create webhook
 * @access  Private (Super Admin)
 */
router.post('/webhooks',
  requireRole(['super_admin']),
  IntegrationController.createWebhook
);

/**
 * @route   PUT /api/admin/integrations/webhooks/:webhookId
 * @desc    Update webhook
 * @access  Private (Super Admin)
 */
router.put('/webhooks/:webhookId',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { webhookId } = req.params;
      const updates = req.body;
      const { query } = require('../../config/database');

      const allowedFields = [
        'webhook_url', 'event_types', 'headers', 'payload_template',
        'secret', 'is_active', 'retry_attempts', 'timeout_ms'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['event_types', 'headers', 'payload_template'].includes(key)) {
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
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, webhookId);

      const result = await query(`
        UPDATE webhooks 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Webhook not found');
      }

      res.json({
        success: true,
        message: 'Webhook updated successfully',
        data: {
          ...result.rows[0],
          headers: JSON.parse(result.rows[0].headers || '{}'),
          payload_template: JSON.parse(result.rows[0].payload_template || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/integrations/webhooks/:webhookId/test
 * @desc    Test webhook
 * @access  Private (Super Admin)
 */
router.post('/webhooks/:webhookId/test',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { webhookId } = req.params;
      req.params.id = webhookId;
      return IntegrationController.testWebhook(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/integrations/webhooks/:webhookId/deliveries
 * @desc    Get webhook delivery history
 * @access  Private (Platform Admin)
 */
router.get('/webhooks/:webhookId/deliveries',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { webhookId } = req.params;
      const { status, limit = 20, offset = 0 } = req.query;
      const { query } = require('../../config/database');

      let whereClause = 'WHERE webhook_id = $1';
      const params = [webhookId];

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          wd.*,
          w.webhook_url,
          w.event_types
        FROM webhook_deliveries wd
        JOIN webhooks w ON wd.webhook_id = w.id
        ${whereClause}
        ORDER BY wd.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const deliveries = result.rows.map(delivery => ({
        ...delivery,
        payload: delivery.payload ? JSON.parse(delivery.payload) : null
      }));

      res.json({
        success: true,
        data: deliveries,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// OAUTH MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/integrations/oauth
 * @desc    Get OAuth configurations
 * @access  Private (Super Admin)
 */
router.get('/oauth',
  requireRole(['super_admin']),
  IntegrationController.getOAuthConfigs
);

/**
 * @route   POST /api/admin/integrations/oauth
 * @desc    Create OAuth configuration
 * @access  Private (Super Admin)
 */
router.post('/oauth',
  requireRole(['super_admin']),
  IntegrationController.createOAuthConfig
);

/**
 * @route   PUT /api/admin/integrations/oauth/:configId
 * @desc    Update OAuth configuration
 * @access  Private (Super Admin)
 */
router.put('/oauth/:configId',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { configId } = req.params;
      const updates = req.body;
      const { query } = require('../../config/database');

      const allowedFields = [
        'config_name', 'description', 'client_id', 'client_secret',
        'scopes', 'authorization_url', 'token_url', 'redirect_url', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'client_secret' && updates[key]) {
            // Encrypt the new client secret
            setClause.push(`client_secret = $${paramIndex}`);
            values.push(IntegrationController.encryptData(updates[key]));
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
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, configId);

      const result = await query(`
        UPDATE oauth_configs 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING id, config_name, provider, description, client_id, scopes,
                  authorization_url, token_url, redirect_url, is_active, updated_at
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('OAuth configuration not found');
      }

      res.json({
        success: true,
        message: 'OAuth configuration updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/integrations/oauth/:configId
 * @desc    Delete OAuth configuration
 * @access  Private (Super Admin)
 */
router.delete('/oauth/:configId',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { configId } = req.params;
      const { query } = require('../../config/database');

      const result = await query(`
        DELETE FROM oauth_configs 
        WHERE id = $1
        RETURNING config_name
      `, [configId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('OAuth configuration not found');
      }

      res.json({
        success: true,
        message: 'OAuth configuration deleted successfully',
        data: { config_name: result.rows[0].config_name }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// INTEGRATION ANALYTICS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/integrations/analytics
 * @desc    Get integration analytics
 * @access  Private (Platform Admin)
 */
router.get('/analytics',
  requireRole(['super_admin', 'regional_admin']),
  IntegrationController.getIntegrationAnalytics
);

/**
 * @route   GET /api/admin/integrations/:id/analytics
 * @desc    Get specific integration analytics
 * @access  Private (Platform Admin)
 */
router.get('/:id/analytics',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      req.query.integrationId = id;
      return IntegrationController.getIntegrationAnalytics(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/integrations/analytics/summary
 * @desc    Get integration analytics summary
 * @access  Private (Platform Admin)
 */
router.get('/analytics/summary',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { period = '7d' } = req.query;
      const { query } = require('../../config/database');

      const timeInterval = period === '1d' ? '1 day' : 
                          period === '7d' ? '7 days' : 
                          period === '30d' ? '30 days' : '7 days';

      const [overallStats, categoryStats, providerStats, healthStatus] = await Promise.all([
        // Overall integration statistics
        query(`
          SELECT 
            COUNT(*) as total_integrations,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_integrations,
            COUNT(CASE WHEN status = 'healthy' THEN 1 END) as healthy_integrations,
            COUNT(CASE WHEN status = 'error' THEN 1 END) as error_integrations
          FROM integrations
        `),

        // By category
        query(`
          SELECT 
            category,
            COUNT(*) as integration_count,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
          FROM integrations
          GROUP BY category
          ORDER BY integration_count DESC
        `),

        // By provider
        query(`
          SELECT 
            provider_name,
            COUNT(*) as integration_count,
            AVG(success_rate) as avg_success_rate
          FROM integrations
          GROUP BY provider_name
          ORDER BY integration_count DESC
          LIMIT 10
        `),

        // Health status over time
        query(`
          SELECT 
            DATE_TRUNC('day', logged_at) as date,
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
            AVG(response_time_ms) as avg_response_time
          FROM integration_logs
          WHERE logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY DATE_TRUNC('day', logged_at)
          ORDER BY date DESC
        `)
      ]);

      res.json({
        success: true,
        data: {
          period,
          overall: overallStats.rows[0],
          byCategory: categoryStats.rows,
          byProvider: providerStats.rows,
          healthTrend: healthStatus.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// INTEGRATION LOGS ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/integrations/logs
 * @desc    Get integration logs
 * @access  Private (Platform Admin)
 */
router.get('/logs',
  requireRole(['super_admin', 'regional_admin']),
  IntegrationController.getIntegrationLogs
);

/**
 * @route   GET /api/admin/integrations/:id/logs
 * @desc    Get specific integration logs
 * @access  Private (Platform Admin)
 */
router.get('/:id/logs',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      req.query.integrationId = id;
      return IntegrationController.getIntegrationLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// BULK OPERATIONS ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/integrations/bulk/test
 * @desc    Bulk test integrations
 * @access  Private (Super Admin)
 */
router.post('/bulk/test',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { integrationIds, testType = 'basic' } = req.body;

      if (!integrationIds || !Array.isArray(integrationIds) || integrationIds.length === 0) {
        throw new ValidationError('Integration IDs array is required');
      }

      const results = [];
      const errors = [];

      for (const integrationId of integrationIds) {
        try {
          req.params.id = integrationId;
          req.body = { testType };

          const mockRes = {
            json: (data) => {
              results.push({ integrationId, success: true, data: data.data });
            }
          };

          await IntegrationController.testIntegration(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ integrationId, error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk testing completed. ${results.length} successful, ${errors.length} errors`,
        data: {
          tested: results,
          errors: errors,
          summary: {
            total: integrationIds.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/integrations/bulk/update-status
 * @desc    Bulk update integration status
 * @access  Private (Super Admin)
 */
router.post('/bulk/update-status',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { integrationIds, status, isActive } = req.body;

      if (!integrationIds || !Array.isArray(integrationIds) || integrationIds.length === 0) {
        throw new ValidationError('Integration IDs array is required');
      }

      const { query } = require('../../config/database');

      const setFields = [];
      const values = [];
      let paramIndex = 1;

      if (status) {
        setFields.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (isActive !== undefined) {
        setFields.push(`is_active = $${paramIndex}`);
        values.push(isActive);
        paramIndex++;
      }

      if (setFields.length === 0) {
        throw new ValidationError('Status or isActive must be provided');
      }

      setFields.push(`updated_at = CURRENT_TIMESTAMP`);
      setFields.push(`updated_by = $${paramIndex}`);
      setFields.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`);

      const result = await query(`
        UPDATE integrations 
        SET ${setFields.join(', ')}
        WHERE id = ANY($${paramIndex + 2})
        RETURNING id, integration_name, status, is_active
      `, [...values, integrationIds]);

      res.json({
        success: true,
        message: `Bulk status update completed for ${result.rows.length} integrations`,
        data: {
          updated: result.rows,
          summary: {
            total: integrationIds.length,
            updated: result.rows.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;