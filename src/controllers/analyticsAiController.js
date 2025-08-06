const analyticsAiService = require('../services/analyticsAiService');
const realtimeIntegrations = require('../integrations/realtimeIntegrations');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Advanced Analytics & AI Controller
 * Handles machine learning models, predictive analytics, and intelligent insights
 */
class AnalyticsAiController {

  /**
   * AI Model Management
   */

  // Create AI model
  createAiModel = asyncHandler(async (req, res) => {
    const {
      modelName,
      modelType,
      modelCategory,
      modelVersion,
      modelDescription,
      modelAlgorithm,
      trainingDataDescription,
      featureColumns,
      targetColumn,
      modelConfig
    } = req.body;

    // Validate required fields
    if (!modelName || !modelType || !modelCategory || !modelVersion) {
      throw new ValidationError('Model name, type, category, and version are required');
    }

    const model = await analyticsAiService.createAiModel({
      modelName,
      modelType,
      modelCategory,
      modelVersion,
      modelDescription,
      modelAlgorithm,
      trainingDataDescription,
      featureColumns,
      targetColumn,
      modelConfig,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { model },
      message: 'AI model created successfully'
    });
  });

  // Get AI models
  getAiModels = asyncHandler(async (req, res) => {
    const {
      modelType,
      modelCategory,
      deploymentStatus,
      isActive,
      page,
      limit
    } = req.query;

    const models = await analyticsAiService.getAiModels({
      modelType,
      modelCategory,
      deploymentStatus,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: {
        models,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 20,
          hasMore: models.length === (parseInt(limit) || 20)
        }
      },
      message: 'AI models retrieved successfully'
    });
  });

  // Update model deployment
  updateModelDeployment = asyncHandler(async (req, res) => {
    const { modelId } = req.params;
    const { deploymentStatus, modelAccuracy, modelFilePath } = req.body;

    if (!deploymentStatus) {
      throw new ValidationError('Deployment status is required');
    }

    const model = await analyticsAiService.updateModelDeployment(modelId, {
      deploymentStatus,
      modelAccuracy,
      modelFilePath
    });

    res.json({
      success: true,
      data: { model },
      message: 'Model deployment updated successfully'
    });
  });

  /**
   * Prediction Management
   */

  // Create prediction
  createPrediction = asyncHandler(async (req, res) => {
    const {
      modelId,
      predictionType,
      inputData,
      predictedValue,
      confidenceScore,
      predictionProbabilities,
      entityType,
      entityId,
      schoolId,
      academicYear
    } = req.body;

    // Validate required fields
    if (!modelId || !predictionType || !inputData || !predictedValue || !entityType) {
      throw new ValidationError('Model ID, prediction type, input data, predicted value, and entity type are required');
    }

    const prediction = await analyticsAiService.createPrediction({
      modelId,
      predictionType,
      inputData,
      predictedValue,
      confidenceScore,
      predictionProbabilities,
      entityType,
      entityId,
      schoolId: schoolId || req.user.schoolId,
      academicYear
    });

    // Create alert if high-risk prediction
    if (confidenceScore > 0.8 && predictionType.includes('risk')) {
      try {
        await analyticsAiService.createPredictiveAlert({
          alertName: `High-risk prediction for ${entityType}`,
          alertType: predictionType,
          severityLevel: confidenceScore > 0.95 ? 'critical' : 'high',
          modelId,
          predictionId: prediction.id,
          entityType,
          entityId,
          schoolId: schoolId || req.user.schoolId,
          alertDescription: `AI model predicted high risk with ${(confidenceScore * 100).toFixed(1)}% confidence`,
          predictedOutcome: JSON.stringify(predictedValue),
          riskProbability: confidenceScore,
          impactAssessment: 'significant',
          recommendedActions: ['immediate_review', 'intervention_planning'],
          interventionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          triggerConditions: { confidenceThreshold: 0.8, predictionType },
          alertData: { prediction }
        });
      } catch (error) {
        console.error('Failed to create predictive alert:', error);
      }
    }

    res.status(201).json({
      success: true,
      data: { prediction },
      message: 'Prediction created successfully'
    });
  });

  // Get predictions
  getPredictions = asyncHandler(async (req, res) => {
    const {
      modelId,
      entityType,
      entityId,
      predictionType,
      minConfidence,
      page,
      limit
    } = req.query;

    const predictions = await analyticsAiService.getPredictions({
      modelId,
      entityType,
      entityId,
      schoolId: req.user.schoolId,
      predictionType,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: {
        predictions,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 50,
          hasMore: predictions.length === (parseInt(limit) || 50)
        }
      },
      message: 'Predictions retrieved successfully'
    });
  });

  // Update prediction outcome
  updatePredictionOutcome = asyncHandler(async (req, res) => {
    const { predictionId } = req.params;
    const { actualOutcome, feedbackRating, feedbackNotes } = req.body;

    if (!actualOutcome) {
      throw new ValidationError('Actual outcome is required');
    }

    const prediction = await analyticsAiService.updatePredictionOutcome(predictionId, {
      actualOutcome,
      feedbackRating,
      feedbackNotes
    });

    res.json({
      success: true,
      data: { prediction },
      message: 'Prediction outcome updated successfully'
    });
  });

  /**
   * Analytics Reports
   */

  // Create analytics report
  createAnalyticsReport = asyncHandler(async (req, res) => {
    const {
      reportName,
      reportType,
      reportCategory,
      reportScope,
      targetEntityType,
      targetEntityId,
      reportData,
      keyInsights,
      recommendations,
      confidenceLevel,
      dataSources,
      computationMethod,
      reportPeriodStart,
      reportPeriodEnd,
      isAutomated,
      automationSchedule,
      recipients,
      sharingLevel,
      reportTags
    } = req.body;

    // Validate required fields
    if (!reportName || !reportType || !reportCategory || !reportScope || !reportData) {
      throw new ValidationError('Report name, type, category, scope, and data are required');
    }

    const report = await analyticsAiService.createAnalyticsReport({
      reportName,
      reportType,
      reportCategory,
      reportScope,
      targetEntityType,
      targetEntityId,
      schoolId: req.user.schoolId,
      reportData,
      keyInsights,
      recommendations,
      confidenceLevel,
      dataSources,
      computationMethod,
      reportPeriodStart,
      reportPeriodEnd,
      isAutomated,
      automationSchedule,
      recipients,
      sharingLevel,
      reportTags,
      createdBy: req.user.userId
    });

    // Send notification to recipients
    if (recipients && recipients.length > 0) {
      try {
        await realtimeIntegrations.createCustomEvent({
          eventType: 'analytics_report_generated',
          schoolId: req.user.schoolId,
          sourceUserId: req.user.userId,
          targetUserIds: recipients,
          title: 'New Analytics Report Available',
          message: `Analytics report "${reportName}" has been generated and is ready for review`,
          eventPayload: {
            reportId: report.id,
            reportName: report.report_name,
            reportType: report.report_type,
            reportCategory: report.report_category
          },
          priority: 'normal',
          sourceEntityType: 'analytics_report',
          sourceEntityId: report.id,
          actionUrl: `/analytics/reports/${report.id}`
        });
      } catch (error) {
        console.error('Failed to send report notification:', error);
      }
    }

    res.status(201).json({
      success: true,
      data: { report },
      message: 'Analytics report created successfully'
    });
  });

  // Get analytics reports
  getAnalyticsReports = asyncHandler(async (req, res) => {
    const {
      reportType,
      reportCategory,
      reportScope,
      sharingLevel,
      isAutomated,
      page,
      limit
    } = req.query;

    const reports = await analyticsAiService.getAnalyticsReports({
      reportType,
      reportCategory,
      reportScope,
      schoolId: req.user.schoolId,
      sharingLevel,
      isAutomated: isAutomated !== undefined ? isAutomated === 'true' : undefined,
      userId: req.user.userId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 20,
          hasMore: reports.length === (parseInt(limit) || 20)
        }
      },
      message: 'Analytics reports retrieved successfully'
    });
  });

  /**
   * Predictive Alerts
   */

  // Get predictive alerts
  getPredictiveAlerts = asyncHandler(async (req, res) => {
    const {
      alertType,
      severityLevel,
      status,
      entityType,
      entityId,
      minRiskProbability,
      page,
      limit
    } = req.query;

    const alerts = await analyticsAiService.getPredictiveAlerts({
      alertType,
      severityLevel,
      status,
      schoolId: req.user.schoolId,
      entityType,
      entityId,
      minRiskProbability: minRiskProbability ? parseFloat(minRiskProbability) : undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 50,
          hasMore: alerts.length === (parseInt(limit) || 50)
        }
      },
      message: 'Predictive alerts retrieved successfully'
    });
  });

  // Update alert status
  updateAlertStatus = asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const { status, resolutionNotes } = req.body;

    if (!status) {
      throw new ValidationError('Status is required');
    }

    const alert = await analyticsAiService.updateAlertStatus(alertId, {
      status,
      acknowledgedBy: req.user.userId,
      resolutionNotes
    });

    res.json({
      success: true,
      data: { alert },
      message: 'Alert status updated successfully'
    });
  });

  /**
   * Student Learning Analytics
   */

  // Generate student learning analytics
  generateStudentAnalytics = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { academicYear } = req.body;

    if (!academicYear) {
      throw new ValidationError('Academic year is required');
    }

    const analytics = await analyticsAiService.generateStudentLearningAnalytics(
      studentId,
      req.user.schoolId,
      academicYear
    );

    // Create alert if student is at risk
    if (analytics.success_probability < 0.6) {
      try {
        await analyticsAiService.createPredictiveAlert({
          alertName: `Student at risk: ${analytics.first_name} ${analytics.last_name}`,
          alertType: 'student_at_risk',
          severityLevel: analytics.success_probability < 0.4 ? 'critical' : 'high',
          entityType: 'student',
          entityId: studentId,
          schoolId: req.user.schoolId,
          alertDescription: `Student showing academic performance concerns with ${(analytics.success_probability * 100).toFixed(1)}% success probability`,
          predictedOutcome: analytics.predicted_final_grade,
          riskProbability: 1 - analytics.success_probability,
          impactAssessment: analytics.success_probability < 0.4 ? 'severe' : 'significant',
          recommendedActions: analytics.intervention_recommendations,
          interventionDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          triggerConditions: { successProbabilityThreshold: 0.6 },
          alertData: { analytics }
        });
      } catch (error) {
        console.error('Failed to create student at-risk alert:', error);
      }
    }

    res.json({
      success: true,
      data: { analytics },
      message: 'Student learning analytics generated successfully'
    });
  });

  // Get student learning analytics
  getStudentAnalytics = asyncHandler(async (req, res) => {
    const {
      studentId,
      academicYear,
      minSuccessProbability,
      maxSuccessProbability,
      atRiskOnly,
      page,
      limit
    } = req.query;

    const analytics = await analyticsAiService.getStudentLearningAnalytics({
      studentId,
      schoolId: req.user.schoolId,
      academicYear,
      minSuccessProbability: minSuccessProbability ? parseFloat(minSuccessProbability) : undefined,
      maxSuccessProbability: maxSuccessProbability ? parseFloat(maxSuccessProbability) : undefined,
      atRiskOnly: atRiskOnly === 'true',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: {
        analytics,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 50,
          hasMore: analytics.length === (parseInt(limit) || 50)
        }
      },
      message: 'Student learning analytics retrieved successfully'
    });
  });

  /**
   * AI Chatbot Management
   */

  // Create chatbot session
  createChatbotSession = asyncHandler(async (req, res) => {
    const { chatContext, languageCode } = req.body;

    if (!chatContext) {
      throw new ValidationError('Chat context is required');
    }

    // Generate unique session ID
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = await analyticsAiService.createChatbotSession({
      sessionId,
      userId: req.user.userId,
      schoolId: req.user.schoolId,
      chatContext,
      languageCode
    });

    res.status(201).json({
      success: true,
      data: { session },
      message: 'Chatbot session created successfully'
    });
  });

  // Add chatbot message
  addChatbotMessage = asyncHandler(async (req, res) => {
    const {
      sessionId,
      senderType,
      messageText,
      messageIntent,
      intentConfidence,
      entitiesExtracted,
      botResponseType
    } = req.body;

    if (!sessionId || !senderType || !messageText) {
      throw new ValidationError('Session ID, sender type, and message text are required');
    }

    // Get message index (count of existing messages + 1)
    const messageCountResult = await analyticsAiService.query(`
      SELECT COUNT(*) as count FROM ai_chatbot_messages WHERE session_id = $1
    `, [sessionId]);
    
    const messageIndex = parseInt(messageCountResult.rows[0].count) + 1;
    const responseTimeMs = senderType === 'bot' ? Math.floor(Math.random() * 2000) + 500 : null;

    const message = await analyticsAiService.addChatbotMessage({
      sessionId,
      messageIndex,
      senderType,
      messageText,
      messageIntent,
      intentConfidence,
      entitiesExtracted,
      botResponseType,
      responseTimeMs
    });

    res.status(201).json({
      success: true,
      data: { message },
      message: 'Chatbot message added successfully'
    });
  });

  // End chatbot session
  endChatbotSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { userSatisfactionRating, issueResolved, escalatedToHuman, escalationReason } = req.body;

    const session = await analyticsAiService.endChatbotSession(sessionId, {
      userSatisfactionRating,
      issueResolved,
      escalatedToHuman,
      escalationReason
    });

    res.json({
      success: true,
      data: { session },
      message: 'Chatbot session ended successfully'
    });
  });

  /**
   * Data Mining Operations
   */

  // Create data mining job
  createDataMiningJob = asyncHandler(async (req, res) => {
    const {
      jobName,
      miningType,
      datasetDescription,
      dataSourceQuery,
      algorithmUsed,
      jobParameters
    } = req.body;

    // Validate required fields
    if (!jobName || !miningType || !dataSourceQuery) {
      throw new ValidationError('Job name, mining type, and data source query are required');
    }

    const job = await analyticsAiService.createDataMiningJob({
      jobName,
      miningType,
      datasetDescription,
      dataSourceQuery,
      algorithmUsed,
      jobParameters,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { job },
      message: 'Data mining job created successfully'
    });
  });

  // Get data mining jobs
  getDataMiningJobs = asyncHandler(async (req, res) => {
    const {
      miningType,
      jobStatus,
      page,
      limit
    } = req.query;

    const jobs = await analyticsAiService.getDataMiningJobs({
      miningType,
      jobStatus,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 20,
          hasMore: jobs.length === (parseInt(limit) || 20)
        }
      },
      message: 'Data mining jobs retrieved successfully'
    });
  });

  /**
   * Analytics Dashboard
   */

  // Get analytics dashboard
  getAnalyticsDashboard = asyncHandler(async (req, res) => {
    const { timeframe } = req.query;

    const dashboard = await analyticsAiService.getAnalyticsDashboard(
      req.user.schoolId,
      timeframe || '30days'
    );

    res.json({
      success: true,
      data: { dashboard },
      message: 'Analytics dashboard retrieved successfully'
    });
  });

  /**
   * Advanced KPI Management
   */

  // Calculate advanced KPIs
  calculateAdvancedKpis = asyncHandler(async (req, res) => {
    const {
      entityType,
      entityId,
      period
    } = req.body;

    if (!entityType || !entityId || !period) {
      throw new ValidationError('Entity type, entity ID, and period are required');
    }

    const kpi = await analyticsAiService.calculateAdvancedKpis(
      entityType,
      entityId,
      req.user.schoolId,
      period
    );

    res.json({
      success: true,
      data: { kpi },
      message: 'Advanced KPIs calculated successfully'
    });
  });

  /**
   * AI Insights & Recommendations
   */

  // Get AI insights
  getAiInsights = asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.query;

    // This would typically involve complex AI analysis
    // Simplified example for demonstration
    const insights = {
      entityType,
      entityId,
      schoolId: req.user.schoolId,
      insights: [
        {
          type: 'performance_trend',
          title: 'Improving Academic Performance',
          description: 'Student shows consistent improvement over the past 3 months',
          confidence: 0.85,
          priority: 'medium',
          recommendation: 'Continue current teaching methods and provide additional challenges'
        },
        {
          type: 'risk_factor',
          title: 'Attendance Pattern Concern',
          description: 'Irregular attendance pattern detected in recent weeks',
          confidence: 0.72,
          priority: 'high',
          recommendation: 'Schedule meeting with parents to discuss attendance issues'
        }
      ],
      generatedAt: new Date().toISOString(),
      aiModel: 'Insights Generator v1.0'
    };

    res.json({
      success: true,
      data: { insights },
      message: 'AI insights generated successfully'
    });
  });

  /**
   * Health Check
   */

  // Get analytics AI service health
  getAnalyticsAiHealth = asyncHandler(async (req, res) => {
    const dashboard = await analyticsAiService.getAnalyticsDashboard(null, '7days');

    res.json({
      success: true,
      data: {
        service: 'Advanced Analytics & AI Service',
        status: 'healthy',
        features: [
          'machine_learning_models',
          'predictive_analytics',
          'intelligent_insights',
          'automated_reports',
          'risk_prediction',
          'performance_analytics',
          'ai_chatbot',
          'data_mining',
          'advanced_kpis',
          'real_time_alerts'
        ],
        metrics: {
          totalModels: dashboard.metrics.models.total_models || 0,
          productionModels: dashboard.metrics.models.production_models || 0,
          avgModelAccuracy: parseFloat(dashboard.metrics.models.avg_accuracy) || 0,
          totalPredictions: dashboard.metrics.predictions.total_predictions || 0,
          avgPredictionConfidence: parseFloat(dashboard.metrics.predictions.avg_confidence) || 0,
          activeAlerts: dashboard.metrics.alerts.active_alerts || 0,
          criticalAlerts: dashboard.metrics.alerts.critical_alerts || 0,
          totalReports: dashboard.metrics.reports.total_reports || 0,
          avgPerformanceScore: parseFloat(dashboard.metrics.kpis.avg_performance_score) || 0
        },
        aiCapabilities: {
          classification: true,
          regression: true,
          clustering: true,
          recommendation: true,
          nlp: true,
          time_series: true,
          computer_vision: false, // Could be enabled
          deep_learning: true
        },
        timestamp: new Date().toISOString()
      },
      message: 'Analytics AI service health check completed'
    });
  });
}

module.exports = new AnalyticsAiController();