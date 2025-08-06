const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');
const crypto = require('crypto');

class IntegrationController {
  // =============================================================================
  // INTEGRATION SERVICES MANAGEMENT
  // =============================================================================

  // Get all integrations
  static async getIntegrations(req, res, next) {
    try {
      const { 
        category, 
        status, 
        provider,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (category) {
        whereClause += ` AND category = $${params.length + 1}`;
        params.push(category);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      if (provider) {
        whereClause += ` AND provider_name ILIKE $${params.length + 1}`;
        params.push(`%${provider}%`);
      }

      const result = await query(`
        SELECT 
          id, integration_name, category, provider_name, description,
          status, is_active, last_sync_at, error_count, success_rate,
          created_at, updated_at, created_by_name, updated_by_name
        FROM integrations
        ${whereClause}
        ORDER BY integration_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
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

  // Get integration details
  static async getIntegration(req, res, next) {
    try {
      const { id } = req.params;

      const [integration, credentials, logs] = await Promise.all([
        // Integration details
        query(`
          SELECT 
            i.*,
            ic.masked_credentials,
            it.template_name,
            it.configuration_schema
          FROM integrations i
          LEFT JOIN integration_credentials ic ON i.id = ic.integration_id
          LEFT JOIN integration_templates it ON i.template_id = it.id
          WHERE i.id = $1
        `, [id]),

        // Health status from recent logs
        query(`
          SELECT 
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
            COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_requests,
            AVG(response_time_ms) as avg_response_time
          FROM integration_logs
          WHERE integration_id = $1 
            AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        `, [id]),

        // Recent activity logs
        query(`
          SELECT *
          FROM integration_logs
          WHERE integration_id = $1
          ORDER BY logged_at DESC
          LIMIT 10
        `, [id])
      ]);

      if (integration.rows.length === 0) {
        throw new NotFoundError('Integration not found');
      }

      const integrationData = {
        ...integration.rows[0],
        configuration: JSON.parse(integration.rows[0].configuration || '{}'),
        rate_limit_config: JSON.parse(integration.rows[0].rate_limit_config || '{}'),
        health_status: credentials.rows[0] || {},
        recent_logs: logs.rows
      };

      res.json({
        success: true,
        data: integrationData
      });
    } catch (error) {
      next(error);
    }
  }

  // Create integration
  static async createIntegration(req, res, next) {
    try {
      const {
        integrationName,
        category,
        providerName,
        description,
        templateId,
        configuration = {},
        credentials = {},
        rateLimitConfig = {},
        webhookUrl,
        isActive = true
      } = req.body;

      if (!integrationName || !category || !providerName) {
        throw new ValidationError('Integration name, category, and provider name are required');
      }

      // Encrypt credentials
      const encryptedCredentials = IntegrationController.encryptCredentials(credentials);
      const maskedCredentials = IntegrationController.maskCredentials(credentials);

      const result = await query(`
        INSERT INTO integrations (
          integration_name, category, provider_name, description, template_id,
          configuration, rate_limit_config, webhook_url, is_active,
          created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        integrationName, category, providerName, description, templateId,
        JSON.stringify(configuration), JSON.stringify(rateLimitConfig),
        webhookUrl, isActive, req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      // Store credentials separately
      if (Object.keys(credentials).length > 0) {
        await query(`
          INSERT INTO integration_credentials (
            integration_id, encrypted_credentials, masked_credentials, created_by
          ) VALUES ($1, $2, $3, $4)
        `, [
          result.rows[0].id, encryptedCredentials, JSON.stringify(maskedCredentials), req.user.userId
        ]);
      }

      res.status(201).json({
        success: true,
        message: 'Integration created successfully',
        data: {
          ...result.rows[0],
          configuration: JSON.parse(result.rows[0].configuration || '{}'),
          rate_limit_config: JSON.parse(result.rows[0].rate_limit_config || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update integration
  static async updateIntegration(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'integration_name', 'description', 'configuration', 'rate_limit_config',
        'webhook_url', 'is_active', 'status'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['configuration', 'rate_limit_config'].includes(key)) {
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
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id);

      const result = await query(`
        UPDATE integrations 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Integration not found');
      }

      res.json({
        success: true,
        message: 'Integration updated successfully',
        data: {
          ...result.rows[0],
          configuration: JSON.parse(result.rows[0].configuration || '{}'),
          rate_limit_config: JSON.parse(result.rows[0].rate_limit_config || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Test integration
  static async testIntegration(req, res, next) {
    try {
      const { id } = req.params;
      const { testType = 'basic', testData = {} } = req.body;

      // Get integration details
      const integration = await query(`
        SELECT i.*, ic.encrypted_credentials
        FROM integrations i
        LEFT JOIN integration_credentials ic ON i.id = ic.integration_id
        WHERE i.id = $1
      `, [id]);

      if (integration.rows.length === 0) {
        throw new NotFoundError('Integration not found');
      }

      const integrationData = integration.rows[0];

      // Perform test based on integration type
      const testResult = await IntegrationController.performIntegrationTest(
        integrationData, testType, testData
      );

      // Log test result
      await query(`
        INSERT INTO integration_logs (
          integration_id, operation_type, status, request_data, response_data,
          response_time_ms, error_message, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id, `test_${testType}`, testResult.success ? 'success' : 'error',
        JSON.stringify(testData), JSON.stringify(testResult.response),
        testResult.responseTime, testResult.error, req.user.userId
      ]);

      res.json({
        success: true,
        message: 'Integration test completed',
        data: testResult
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // INTEGRATION TEMPLATES MANAGEMENT
  // =============================================================================

  // Get integration templates
  static async getIntegrationTemplates(req, res, next) {
    try {
      const { category, provider, isActive } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (category) {
        whereClause += ` AND category = $${params.length + 1}`;
        params.push(category);
      }

      if (provider) {
        whereClause += ` AND supported_providers @> $${params.length + 1}`;
        params.push(JSON.stringify([provider]));
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      const result = await query(`
        SELECT *
        FROM integration_templates
        ${whereClause}
        ORDER BY category, template_name
      `, params);

      const templates = result.rows.map(template => ({
        ...template,
        configuration_schema: JSON.parse(template.configuration_schema || '{}'),
        default_config: JSON.parse(template.default_config || '{}'),
        supported_providers: template.supported_providers || [],
        required_credentials: JSON.parse(template.required_credentials || '[]')
      }));

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      next(error);
    }
  }

  // Create integration template
  static async createIntegrationTemplate(req, res, next) {
    try {
      const {
        templateName,
        category,
        description,
        supportedProviders = [],
        configurationSchema = {},
        defaultConfig = {},
        requiredCredentials = [],
        documentation,
        version = '1.0.0'
      } = req.body;

      if (!templateName || !category || supportedProviders.length === 0) {
        throw new ValidationError('Template name, category, and supported providers are required');
      }

      const result = await query(`
        INSERT INTO integration_templates (
          template_name, category, description, supported_providers,
          configuration_schema, default_config, required_credentials,
          documentation, version, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        templateName, category, description, supportedProviders,
        JSON.stringify(configurationSchema), JSON.stringify(defaultConfig),
        JSON.stringify(requiredCredentials), documentation, version,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Integration template created successfully',
        data: {
          ...result.rows[0],
          configuration_schema: JSON.parse(result.rows[0].configuration_schema),
          default_config: JSON.parse(result.rows[0].default_config),
          required_credentials: JSON.parse(result.rows[0].required_credentials)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // WEBHOOK MANAGEMENT
  // =============================================================================

  // Get webhooks
  static async getWebhooks(req, res, next) {
    try {
      const { integrationId, status, eventType } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (integrationId) {
        whereClause += ` AND integration_id = $${params.length + 1}`;
        params.push(integrationId);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      if (eventType) {
        whereClause += ` AND event_types @> $${params.length + 1}`;
        params.push(JSON.stringify([eventType]));
      }

      const result = await query(`
        SELECT 
          w.*,
          i.integration_name,
          i.provider_name
        FROM webhooks w
        LEFT JOIN integrations i ON w.integration_id = i.id
        ${whereClause}
        ORDER BY w.created_at DESC
      `, params);

      const webhooks = result.rows.map(webhook => ({
        ...webhook,
        event_types: webhook.event_types || [],
        headers: JSON.parse(webhook.headers || '{}'),
        payload_template: JSON.parse(webhook.payload_template || '{}')
      }));

      res.json({
        success: true,
        data: webhooks
      });
    } catch (error) {
      next(error);
    }
  }

  // Create webhook
  static async createWebhook(req, res, next) {
    try {
      const {
        integrationId,
        webhookUrl,
        eventTypes = [],
        headers = {},
        payloadTemplate = {},
        secret,
        isActive = true,
        retryAttempts = 3,
        timeoutMs = 30000
      } = req.body;

      if (!integrationId && !webhookUrl) {
        throw new ValidationError('Integration ID or webhook URL is required');
      }

      if (eventTypes.length === 0) {
        throw new ValidationError('At least one event type is required');
      }

      const result = await query(`
        INSERT INTO webhooks (
          integration_id, webhook_url, event_types, headers, payload_template,
          secret, is_active, retry_attempts, timeout_ms, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        integrationId, webhookUrl, eventTypes, JSON.stringify(headers),
        JSON.stringify(payloadTemplate), secret, isActive, retryAttempts,
        timeoutMs, req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Webhook created successfully',
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

  // Test webhook
  static async testWebhook(req, res, next) {
    try {
      const { id } = req.params;
      const { eventType, testPayload = {} } = req.body;

      const webhook = await query(`
        SELECT * FROM webhooks WHERE id = $1
      `, [id]);

      if (webhook.rows.length === 0) {
        throw new NotFoundError('Webhook not found');
      }

      const webhookData = webhook.rows[0];

      // Perform webhook test
      const testResult = await IntegrationController.testWebhookDelivery(
        webhookData, eventType, testPayload
      );

      // Log webhook test
      await query(`
        INSERT INTO webhook_deliveries (
          webhook_id, event_type, payload, response_status, response_body,
          response_time_ms, delivery_attempts, last_attempt_at,
          status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9)
      `, [
        id, eventType, JSON.stringify(testPayload), testResult.status,
        testResult.response, testResult.responseTime, 1,
        testResult.success ? 'delivered' : 'failed', req.user.userId
      ]);

      res.json({
        success: true,
        message: 'Webhook test completed',
        data: testResult
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // OAUTH MANAGEMENT
  // =============================================================================

  // Get OAuth configurations
  static async getOAuthConfigs(req, res, next) {
    try {
      const { provider, status } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (provider) {
        whereClause += ` AND provider = $${params.length + 1}`;
        params.push(provider);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          id, config_name, provider, description, scopes, status,
          authorization_url, token_url, is_active, created_at, created_by_name,
          -- Don't expose sensitive data
          CASE WHEN client_secret IS NOT NULL THEN '***' ELSE NULL END as client_secret_masked
        FROM oauth_configs
        ${whereClause}
        ORDER BY provider, config_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Create OAuth configuration
  static async createOAuthConfig(req, res, next) {
    try {
      const {
        configName,
        provider,
        description,
        clientId,
        clientSecret,
        scopes = [],
        authorizationUrl,
        tokenUrl,
        redirectUrl
      } = req.body;

      if (!configName || !provider || !clientId || !clientSecret) {
        throw new ValidationError('Config name, provider, client ID, and client secret are required');
      }

      // Encrypt client secret
      const encryptedSecret = IntegrationController.encryptData(clientSecret);

      const result = await query(`
        INSERT INTO oauth_configs (
          config_name, provider, description, client_id, client_secret,
          scopes, authorization_url, token_url, redirect_url,
          created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, config_name, provider, description, client_id, scopes,
                  authorization_url, token_url, redirect_url, is_active, created_at
      `, [
        configName, provider, description, clientId, encryptedSecret,
        scopes, authorizationUrl, tokenUrl, redirectUrl,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'OAuth configuration created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // INTEGRATION ANALYTICS
  // =============================================================================

  // Get integration analytics
  static async getIntegrationAnalytics(req, res, next) {
    try {
      const { 
        integrationId, 
        period = '7d',
        startDate, 
        endDate 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (integrationId) {
        whereClause += ` AND integration_id = $${params.length + 1}`;
        params.push(integrationId);
      }

      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = ` AND logged_at BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(startDate, endDate);
      } else {
        const periodMapping = {
          '1d': '1 day',
          '7d': '7 days',
          '30d': '30 days',
          '90d': '90 days'
        };
        const timeInterval = periodMapping[period] || '7 days';
        dateFilter = ` AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'`;
      }

      const [usageStats, errorAnalysis, performanceMetrics, popularOperations] = await Promise.all([
        // Usage statistics
        query(`
          SELECT 
            integration_id,
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
            COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_requests,
            (COUNT(CASE WHEN status = 'success' THEN 1 END)::float / COUNT(*) * 100) as success_rate
          FROM integration_logs
          ${whereClause} ${dateFilter}
          GROUP BY integration_id
        `, params),

        // Error analysis
        query(`
          SELECT 
            integration_id,
            error_message,
            COUNT(*) as error_count,
            MAX(logged_at) as last_occurrence
          FROM integration_logs
          WHERE status = 'error' ${whereClause.replace('WHERE 1=1', '')} ${dateFilter}
          GROUP BY integration_id, error_message
          ORDER BY error_count DESC
          LIMIT 10
        `, params),

        // Performance metrics
        query(`
          SELECT 
            DATE_TRUNC('hour', logged_at) as hour,
            integration_id,
            AVG(response_time_ms) as avg_response_time,
            COUNT(*) as request_count
          FROM integration_logs
          ${whereClause} ${dateFilter}
          GROUP BY DATE_TRUNC('hour', logged_at), integration_id
          ORDER BY hour DESC
        `, params),

        // Popular operations
        query(`
          SELECT 
            operation_type,
            COUNT(*) as usage_count,
            AVG(response_time_ms) as avg_response_time
          FROM integration_logs
          ${whereClause} ${dateFilter}
          GROUP BY operation_type
          ORDER BY usage_count DESC
          LIMIT 10
        `, params)
      ]);

      res.json({
        success: true,
        data: {
          period: period,
          usageStats: usageStats.rows,
          errorAnalysis: errorAnalysis.rows,
          performanceMetrics: performanceMetrics.rows,
          popularOperations: popularOperations.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // INTEGRATION LOGS
  // =============================================================================

  // Get integration logs
  static async getIntegrationLogs(req, res, next) {
    try {
      const { 
        integrationId, 
        status, 
        operationType,
        startDate,
        endDate,
        limit = 50, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (integrationId) {
        whereClause += ` AND integration_id = $${params.length + 1}`;
        params.push(integrationId);
      }

      if (status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      if (operationType) {
        whereClause += ` AND operation_type = $${params.length + 1}`;
        params.push(operationType);
      }

      if (startDate) {
        whereClause += ` AND logged_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND logged_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      const result = await query(`
        SELECT 
          il.*,
          i.integration_name,
          i.provider_name
        FROM integration_logs il
        LEFT JOIN integrations i ON il.integration_id = i.id
        ${whereClause}
        ORDER BY il.logged_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const logs = result.rows.map(log => ({
        ...log,
        request_data: log.request_data ? JSON.parse(log.request_data) : null,
        response_data: log.response_data ? JSON.parse(log.response_data) : null
      }));

      res.json({
        success: true,
        data: logs,
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

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Encrypt credentials
  static encryptCredentials(credentials) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.INTEGRATION_SECRET || 'default-secret', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    const encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex') + cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  // Encrypt sensitive data
  static encryptData(data) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.INTEGRATION_SECRET || 'default-secret', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    const encrypted = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  // Mask credentials for display
  static maskCredentials(credentials) {
    const masked = {};
    
    Object.keys(credentials).forEach(key => {
      const value = credentials[key];
      if (typeof value === 'string' && value.length > 4) {
        masked[key] = '*'.repeat(value.length - 4) + value.slice(-4);
      } else {
        masked[key] = '***';
      }
    });
    
    return masked;
  }

  // Perform integration test
  static async performIntegrationTest(integration, testType, testData) {
    const startTime = Date.now();
    
    try {
      // Simulate different test types
      switch (testType) {
        case 'connection':
          return {
            success: true,
            testType: 'connection',
            response: { status: 'connected', message: 'Connection successful' },
            responseTime: Date.now() - startTime
          };
          
        case 'authentication':
          return {
            success: true,
            testType: 'authentication',
            response: { status: 'authenticated', token: 'test_token_***' },
            responseTime: Date.now() - startTime
          };
          
        case 'api_call':
          return {
            success: true,
            testType: 'api_call',
            response: { data: 'Test API response', statusCode: 200 },
            responseTime: Date.now() - startTime
          };
          
        default:
          return {
            success: true,
            testType: 'basic',
            response: { status: 'ok', message: 'Basic test passed' },
            responseTime: Date.now() - startTime
          };
      }
    } catch (error) {
      return {
        success: false,
        testType: testType,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  // Test webhook delivery
  static async testWebhookDelivery(webhook, eventType, payload) {
    const startTime = Date.now();
    
    try {
      // In production, this would make an actual HTTP request
      // For now, simulate webhook delivery
      
      const testPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
        webhook_id: webhook.id
      };

      // Simulate HTTP request delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

      return {
        success: true,
        status: 200,
        response: 'OK',
        responseTime: Date.now() - startTime,
        payload: testPayload
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        response: error.message,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}

module.exports = IntegrationController;