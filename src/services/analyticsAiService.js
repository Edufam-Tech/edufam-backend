const { query } = require('../config/database');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Advanced Analytics & AI Service
 * Handles machine learning models, predictive analytics, and intelligent insights
 */
class AnalyticsAiService {

  /**
   * AI Model Management
   */
  async createAiModel({
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
    createdBy
  }) {
    const result = await query(`
      INSERT INTO ai_models (
        model_name, model_type, model_category, model_version, model_description,
        model_algorithm, training_data_description, feature_columns, target_column,
        model_config, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      modelName, modelType, modelCategory, modelVersion, modelDescription,
      modelAlgorithm, trainingDataDescription, featureColumns, targetColumn,
      JSON.stringify(modelConfig), createdBy
    ]);

    return result.rows[0];
  }

  async getAiModels({
    modelType,
    modelCategory,
    deploymentStatus,
    isActive = true,
    page = 1,
    limit = 20
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (modelType) {
      whereConditions.push(`model_type = $${++paramCount}`);
      params.push(modelType);
    }

    if (modelCategory) {
      whereConditions.push(`model_category = $${++paramCount}`);
      params.push(modelCategory);
    }

    if (deploymentStatus) {
      whereConditions.push(`deployment_status = $${++paramCount}`);
      params.push(deploymentStatus);
    }

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${++paramCount}`);
      params.push(isActive);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        m.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        (SELECT COUNT(*) FROM ai_training_jobs tj WHERE tj.model_id = m.id) as training_jobs_count,
        (SELECT COUNT(*) FROM ai_predictions p WHERE p.model_id = m.id) as predictions_count,
        CASE 
          WHEN m.last_retrained IS NOT NULL THEN 
            EXTRACT(DAYS FROM NOW() - m.last_retrained)
          ELSE NULL 
        END as days_since_retrain
      FROM ai_models m
      LEFT JOIN users u ON m.created_by = u.id
      ${whereClause}
      ORDER BY m.model_accuracy DESC NULLS LAST, m.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  async updateModelDeployment(modelId, { deploymentStatus, modelAccuracy, modelFilePath }) {
    const result = await query(`
      UPDATE ai_models 
      SET 
        deployment_status = $2,
        model_accuracy = COALESCE($3, model_accuracy),
        model_file_path = COALESCE($4, model_file_path),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [modelId, deploymentStatus, modelAccuracy, modelFilePath]);

    if (result.rows.length === 0) {
      throw new NotFoundError('AI model not found');
    }

    return result.rows[0];
  }

  /**
   * Prediction Management
   */
  async createPrediction({
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
  }) {
    const result = await query(`
      INSERT INTO ai_predictions (
        model_id, prediction_type, input_data, predicted_value, confidence_score,
        prediction_probabilities, entity_type, entity_id, school_id, academic_year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      modelId, predictionType, JSON.stringify(inputData), JSON.stringify(predictedValue),
      confidenceScore, JSON.stringify(predictionProbabilities), entityType, entityId,
      schoolId, academicYear
    ]);

    return result.rows[0];
  }

  async getPredictions({
    modelId,
    entityType,
    entityId,
    schoolId,
    predictionType,
    minConfidence,
    page = 1,
    limit = 50
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (modelId) {
      whereConditions.push(`p.model_id = $${++paramCount}`);
      params.push(modelId);
    }

    if (entityType) {
      whereConditions.push(`p.entity_type = $${++paramCount}`);
      params.push(entityType);
    }

    if (entityId) {
      whereConditions.push(`p.entity_id = $${++paramCount}`);
      params.push(entityId);
    }

    if (schoolId) {
      whereConditions.push(`p.school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (predictionType) {
      whereConditions.push(`p.prediction_type = $${++paramCount}`);
      params.push(predictionType);
    }

    if (minConfidence) {
      whereConditions.push(`p.confidence_score >= $${++paramCount}`);
      params.push(minConfidence);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        p.*,
        m.model_name,
        m.model_type,
        m.model_category,
        CASE 
          WHEN p.actual_outcome IS NOT NULL THEN 
            CASE 
              WHEN p.predicted_value = p.actual_outcome THEN 1.0
              ELSE 0.0
            END
          ELSE NULL
        END as actual_accuracy
      FROM ai_predictions p
      JOIN ai_models m ON p.model_id = m.id
      ${whereClause}
      ORDER BY p.prediction_date DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  async updatePredictionOutcome(predictionId, { actualOutcome, feedbackRating, feedbackNotes }) {
    const result = await query(`
      UPDATE ai_predictions 
      SET 
        actual_outcome = $2,
        outcome_date = NOW(),
        feedback_rating = $3,
        feedback_notes = $4,
        prediction_accuracy = CASE 
          WHEN $2 IS NOT NULL AND predicted_value = $2 THEN 1.0
          WHEN $2 IS NOT NULL THEN 0.0
          ELSE prediction_accuracy
        END,
        is_validated = true,
        validation_date = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [predictionId, JSON.stringify(actualOutcome), feedbackRating, feedbackNotes]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Prediction not found');
    }

    return result.rows[0];
  }

  /**
   * Analytics Reports
   */
  async createAnalyticsReport({
    reportName,
    reportType,
    reportCategory,
    reportScope,
    targetEntityType,
    targetEntityId,
    schoolId,
    reportData,
    keyInsights,
    recommendations,
    confidenceLevel,
    dataSources,
    computationMethod,
    reportPeriodStart,
    reportPeriodEnd,
    isAutomated = false,
    automationSchedule,
    recipients,
    sharingLevel = 'private',
    reportTags,
    createdBy
  }) {
    const result = await query(`
      INSERT INTO analytics_reports (
        report_name, report_type, report_category, report_scope, target_entity_type,
        target_entity_id, school_id, report_data, key_insights, recommendations,
        confidence_level, data_sources, computation_method, report_period_start,
        report_period_end, is_automated, automation_schedule, recipients,
        sharing_level, report_tags, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      RETURNING *
    `, [
      reportName, reportType, reportCategory, reportScope, targetEntityType,
      targetEntityId, schoolId, JSON.stringify(reportData), keyInsights, recommendations,
      confidenceLevel, dataSources, computationMethod, reportPeriodStart,
      reportPeriodEnd, isAutomated, automationSchedule, recipients,
      sharingLevel, reportTags, createdBy
    ]);

    return result.rows[0];
  }

  async getAnalyticsReports({
    reportType,
    reportCategory,
    reportScope,
    schoolId,
    sharingLevel,
    isAutomated,
    userId,
    page = 1,
    limit = 20
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (reportType) {
      whereConditions.push(`report_type = $${++paramCount}`);
      params.push(reportType);
    }

    if (reportCategory) {
      whereConditions.push(`report_category = $${++paramCount}`);
      params.push(reportCategory);
    }

    if (reportScope) {
      whereConditions.push(`report_scope = $${++paramCount}`);
      params.push(reportScope);
    }

    if (schoolId) {
      whereConditions.push(`school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (sharingLevel) {
      whereConditions.push(`sharing_level = $${++paramCount}`);
      params.push(sharingLevel);
    }

    if (isAutomated !== undefined) {
      whereConditions.push(`is_automated = $${++paramCount}`);
      params.push(isAutomated);
    }

    // Add access control - user can see reports they created or are recipients of
    if (userId) {
      whereConditions.push(`(created_by = $${++paramCount} OR $${paramCount} = ANY(recipients) OR sharing_level = 'public')`);
      params.push(userId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        r.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        s.name as school_name
      FROM analytics_reports r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN schools s ON r.school_id = s.id
      ${whereClause}
      ORDER BY r.last_generated DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  /**
   * Predictive Alerts
   */
  async createPredictiveAlert({
    alertName,
    alertType,
    severityLevel,
    modelId,
    predictionId,
    entityType,
    entityId,
    schoolId,
    alertDescription,
    predictedOutcome,
    riskProbability,
    impactAssessment,
    recommendedActions,
    interventionDeadline,
    triggerConditions,
    alertData
  }) {
    const result = await query(`
      INSERT INTO predictive_alerts (
        alert_name, alert_type, severity_level, model_id, prediction_id,
        entity_type, entity_id, school_id, alert_description, predicted_outcome,
        risk_probability, impact_assessment, recommended_actions,
        intervention_deadline, trigger_conditions, alert_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `, [
      alertName, alertType, severityLevel, modelId, predictionId,
      entityType, entityId, schoolId, alertDescription, predictedOutcome,
      riskProbability, impactAssessment, recommendedActions,
      interventionDeadline, JSON.stringify(triggerConditions), JSON.stringify(alertData)
    ]);

    return result.rows[0];
  }

  async getPredictiveAlerts({
    alertType,
    severityLevel,
    status = 'active',
    schoolId,
    entityType,
    entityId,
    minRiskProbability,
    page = 1,
    limit = 50
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (alertType) {
      whereConditions.push(`alert_type = $${++paramCount}`);
      params.push(alertType);
    }

    if (severityLevel) {
      whereConditions.push(`severity_level = $${++paramCount}`);
      params.push(severityLevel);
    }

    if (status) {
      whereConditions.push(`status = $${++paramCount}`);
      params.push(status);
    }

    if (schoolId) {
      whereConditions.push(`school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (entityType) {
      whereConditions.push(`entity_type = $${++paramCount}`);
      params.push(entityType);
    }

    if (entityId) {
      whereConditions.push(`entity_id = $${++paramCount}`);
      params.push(entityId);
    }

    if (minRiskProbability) {
      whereConditions.push(`risk_probability >= $${++paramCount}`);
      params.push(minRiskProbability);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        a.*,
        m.model_name,
        s.name as school_name,
        CASE 
          WHEN a.intervention_deadline < NOW() THEN true 
          ELSE false 
        END as is_overdue
      FROM predictive_alerts a
      LEFT JOIN ai_models m ON a.model_id = m.id
      LEFT JOIN schools s ON a.school_id = s.id
      ${whereClause}
      ORDER BY a.risk_probability DESC, a.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  async updateAlertStatus(alertId, { status, acknowledgedBy, resolutionNotes }) {
    const statusUpdates = { status };
    
    if (status === 'acknowledged' && acknowledgedBy) {
      statusUpdates.acknowledged_by = acknowledgedBy;
      statusUpdates.acknowledged_at = 'NOW()';
    }
    
    if (status === 'resolved' && acknowledgedBy) {
      statusUpdates.resolved_by = acknowledgedBy;
      statusUpdates.resolved_at = 'NOW()';
      statusUpdates.resolution_notes = resolutionNotes;
    }

    const result = await query(`
      UPDATE predictive_alerts 
      SET 
        status = $2,
        acknowledged_by = CASE WHEN $2 = 'acknowledged' THEN $3 ELSE acknowledged_by END,
        acknowledged_at = CASE WHEN $2 = 'acknowledged' THEN NOW() ELSE acknowledged_at END,
        resolved_by = CASE WHEN $2 = 'resolved' THEN $3 ELSE resolved_by END,
        resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
        resolution_notes = CASE WHEN $2 = 'resolved' THEN $4 ELSE resolution_notes END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [alertId, status, acknowledgedBy, resolutionNotes]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Alert not found');
    }

    return result.rows[0];
  }

  /**
   * Student Learning Analytics
   */
  async generateStudentLearningAnalytics(studentId, schoolId, academicYear) {
    // Complex analytics calculation - in real implementation, this would involve
    // sophisticated algorithms and machine learning models
    
    // Get student performance data
    const performanceData = await query(`
      SELECT 
        COUNT(*) as total_assessments,
        AVG(CASE WHEN marks IS NOT NULL THEN marks::numeric ELSE NULL END) as avg_score,
        COUNT(CASE WHEN attendance_status = 'present' THEN 1 END) as days_present,
        COUNT(*) as total_days,
        COUNT(CASE WHEN submission_date <= due_date THEN 1 END) as on_time_submissions,
        COUNT(CASE WHEN submission_date IS NOT NULL THEN 1 END) as total_submissions
      FROM (
        -- This would be a complex query joining multiple tables
        -- Simplified for demonstration
        SELECT 1 as marks, 'present' as attendance_status, NOW() as submission_date, NOW() as due_date
      ) student_data
    `);

    const analytics = performanceData.rows[0];

    // Calculate derived metrics
    const attendanceRate = analytics.total_days > 0 ? 
      (analytics.days_present / analytics.total_days) * 100 : 0;
    
    const submissionTimeliness = analytics.total_submissions > 0 ? 
      (analytics.on_time_submissions / analytics.total_submissions) * 100 : 0;

    // AI-generated insights (simplified)
    const learningVelocity = Math.random() * 10; // Would be calculated using ML
    const comprehensionScore = analytics.avg_score || 0;
    const retentionRate = Math.random() * 100; // Would be based on spaced repetition tests
    const engagementScore = attendanceRate * 0.4 + submissionTimeliness * 0.6;
    const successProbability = (comprehensionScore * 0.3 + engagementScore * 0.3 + attendanceRate * 0.4) / 100;

    const result = await query(`
      INSERT INTO student_learning_analytics (
        student_id, school_id, academic_year, learning_velocity, comprehension_score,
        retention_rate, engagement_score, success_probability, attendance_pattern,
        submission_timeliness, at_risk_factors, intervention_recommendations,
        predicted_final_grade, confidence_in_prediction
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (student_id, school_id, academic_year) 
      DO UPDATE SET
        learning_velocity = EXCLUDED.learning_velocity,
        comprehension_score = EXCLUDED.comprehension_score,
        retention_rate = EXCLUDED.retention_rate,
        engagement_score = EXCLUDED.engagement_score,
        success_probability = EXCLUDED.success_probability,
        attendance_pattern = EXCLUDED.attendance_pattern,
        submission_timeliness = EXCLUDED.submission_timeliness,
        at_risk_factors = EXCLUDED.at_risk_factors,
        intervention_recommendations = EXCLUDED.intervention_recommendations,
        predicted_final_grade = EXCLUDED.predicted_final_grade,
        confidence_in_prediction = EXCLUDED.confidence_in_prediction,
        updated_at = NOW()
      RETURNING *
    `, [
      studentId, schoolId, academicYear, learningVelocity, comprehensionScore,
      retentionRate, engagementScore, successProbability, 
      attendanceRate > 90 ? 'regular' : attendanceRate > 70 ? 'irregular' : 'poor',
      submissionTimeliness,
      successProbability < 0.6 ? ['low_engagement', 'attendance_issues'] : ['none'],
      successProbability < 0.6 ? ['increased_support', 'tutoring'] : ['maintain_progress'],
      successProbability > 0.8 ? 'A' : successProbability > 0.6 ? 'B' : 'C',
      0.85 // Confidence score
    ]);

    return result.rows[0];
  }

  async getStudentLearningAnalytics({
    studentId,
    schoolId,
    academicYear,
    minSuccessProbability,
    maxSuccessProbability,
    atRiskOnly = false,
    page = 1,
    limit = 50
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (studentId) {
      whereConditions.push(`sla.student_id = $${++paramCount}`);
      params.push(studentId);
    }

    if (schoolId) {
      whereConditions.push(`sla.school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (academicYear) {
      whereConditions.push(`sla.academic_year = $${++paramCount}`);
      params.push(academicYear);
    }

    if (minSuccessProbability) {
      whereConditions.push(`sla.success_probability >= $${++paramCount}`);
      params.push(minSuccessProbability);
    }

    if (maxSuccessProbability) {
      whereConditions.push(`sla.success_probability <= $${++paramCount}`);
      params.push(maxSuccessProbability);
    }

    if (atRiskOnly) {
      whereConditions.push(`sla.success_probability < 0.6`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        sla.*,
        u.first_name,
        u.last_name,
        u.email,
        s.name as school_name,
        CASE 
          WHEN sla.success_probability < 0.4 THEN 'high_risk'
          WHEN sla.success_probability < 0.6 THEN 'medium_risk'
          WHEN sla.success_probability < 0.8 THEN 'low_risk'
          ELSE 'on_track'
        END as risk_category
      FROM student_learning_analytics sla
      JOIN users u ON sla.student_id = u.id
      JOIN schools s ON sla.school_id = s.id
      ${whereClause}
      ORDER BY sla.success_probability ASC, sla.updated_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  /**
   * AI Chatbot Management
   */
  async createChatbotSession({
    sessionId,
    userId,
    schoolId,
    chatContext,
    languageCode = 'en'
  }) {
    const result = await query(`
      INSERT INTO ai_chatbot_sessions (
        session_id, user_id, school_id, chat_context, language_code
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [sessionId, userId, schoolId, chatContext, languageCode]);

    return result.rows[0];
  }

  async addChatbotMessage({
    sessionId,
    messageIndex,
    senderType,
    messageText,
    messageIntent,
    intentConfidence,
    entitiesExtracted,
    botResponseType,
    responseTimeMs
  }) {
    const result = await query(`
      INSERT INTO ai_chatbot_messages (
        session_id, message_index, sender_type, message_text, message_intent,
        intent_confidence, entities_extracted, bot_response_type, response_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      sessionId, messageIndex, senderType, messageText, messageIntent,
      intentConfidence, JSON.stringify(entitiesExtracted), botResponseType, responseTimeMs
    ]);

    // Update session message count
    await query(`
      UPDATE ai_chatbot_sessions 
      SET total_messages = total_messages + 1, updated_at = NOW()
      WHERE session_id = $1
    `, [sessionId]);

    return result.rows[0];
  }

  async endChatbotSession(sessionId, { userSatisfactionRating, issueResolved, escalatedToHuman, escalationReason }) {
    const result = await query(`
      UPDATE ai_chatbot_sessions 
      SET 
        session_end = NOW(),
        user_satisfaction_rating = $2,
        issue_resolved = $3,
        escalated_to_human = $4,
        escalation_reason = $5,
        updated_at = NOW()
      WHERE session_id = $1
      RETURNING *
    `, [sessionId, userSatisfactionRating, issueResolved, escalatedToHuman, escalationReason]);

    return result.rows[0];
  }

  /**
   * Advanced KPI Calculations
   */
  async calculateAdvancedKpis(entityType, entityId, schoolId, period) {
    // This would contain sophisticated KPI calculation logic
    // Simplified example for student performance KPI
    
    if (entityType === 'student') {
      const kpiResult = await query(`
        INSERT INTO advanced_kpis (
          kpi_name, kpi_category, kpi_type, calculation_method, entity_type,
          entity_id, school_id, kpi_value, period_type, period_start, period_end
        ) VALUES (
          'Academic Performance Score', 'academic', 'score',
          'Weighted average of grades, attendance, and engagement',
          $1, $2, $3, $4, $5, $6, $7
        )
        ON CONFLICT (kpi_name, entity_type, entity_id, period_start, period_end)
        DO UPDATE SET
          kpi_value = EXCLUDED.kpi_value,
          updated_at = NOW()
        RETURNING *
      `, [
        entityType, entityId, schoolId, 85.5, // Calculated KPI value
        period.type, period.start, period.end
      ]);

      return kpiResult.rows[0];
    }

    return null;
  }

  /**
   * Data Mining Operations
   */
  async createDataMiningJob({
    jobName,
    miningType,
    datasetDescription,
    dataSourceQuery,
    algorithmUsed,
    jobParameters,
    createdBy
  }) {
    const result = await query(`
      INSERT INTO data_mining_jobs (
        job_name, mining_type, dataset_description, data_source_query,
        algorithm_used, job_parameters, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      jobName, miningType, datasetDescription, dataSourceQuery,
      algorithmUsed, JSON.stringify(jobParameters), createdBy
    ]);

    return result.rows[0];
  }

  async getDataMiningJobs({
    miningType,
    jobStatus,
    page = 1,
    limit = 20
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (miningType) {
      whereConditions.push(`mining_type = $${++paramCount}`);
      params.push(miningType);
    }

    if (jobStatus) {
      whereConditions.push(`job_status = $${++paramCount}`);
      params.push(jobStatus);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        dmj.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM data_mining_jobs dmj
      LEFT JOIN users u ON dmj.created_by = u.id
      ${whereClause}
      ORDER BY dmj.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  /**
   * Analytics Dashboard Data
   */
  async getAnalyticsDashboard(schoolId, timeframe = '30days') {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '365days':
        startDate.setDate(startDate.getDate() - 365);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get various analytics metrics
    const [
      modelMetrics,
      predictionMetrics,
      alertMetrics,
      reportMetrics,
      kpiMetrics
    ] = await Promise.all([
      // AI Models Overview
      query(`
        SELECT 
          COUNT(*) as total_models,
          COUNT(CASE WHEN deployment_status = 'production' THEN 1 END) as production_models,
          AVG(model_accuracy) as avg_accuracy
        FROM ai_models 
        WHERE is_active = true
      `),
      
      // Recent Predictions
      query(`
        SELECT 
          COUNT(*) as total_predictions,
          AVG(confidence_score) as avg_confidence,
          COUNT(CASE WHEN is_validated = true THEN 1 END) as validated_predictions
        FROM ai_predictions 
        WHERE prediction_date >= $1 AND ($2 IS NULL OR school_id = $2)
      `, [startDate.toISOString(), schoolId]),
      
      // Active Alerts
      query(`
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN severity_level = 'critical' THEN 1 END) as critical_alerts,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts
        FROM predictive_alerts 
        WHERE created_at >= $1 AND ($2 IS NULL OR school_id = $2)
      `, [startDate.toISOString(), schoolId]),
      
      // Reports Generated
      query(`
        SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN is_automated = true THEN 1 END) as automated_reports
        FROM analytics_reports 
        WHERE last_generated >= $1 AND ($2 IS NULL OR school_id = $2)
      `, [startDate.toISOString(), schoolId]),
      
      // KPI Summary
      query(`
        SELECT 
          COUNT(*) as total_kpis,
          AVG(CASE WHEN performance_rating = 'excellent' THEN 5 
                   WHEN performance_rating = 'good' THEN 4
                   WHEN performance_rating = 'average' THEN 3
                   WHEN performance_rating = 'below_average' THEN 2
                   WHEN performance_rating = 'poor' THEN 1
                   ELSE 3 END) as avg_performance_score
        FROM advanced_kpis 
        WHERE period_start >= $1 AND ($2 IS NULL OR school_id = $2)
      `, [startDate.toISOString().split('T')[0], schoolId])
    ]);

    return {
      timeframe,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      metrics: {
        models: modelMetrics.rows[0],
        predictions: predictionMetrics.rows[0],
        alerts: alertMetrics.rows[0],
        reports: reportMetrics.rows[0],
        kpis: kpiMetrics.rows[0]
      },
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new AnalyticsAiService();