-- ====================================
-- ADVANCED ANALYTICS & AI SYSTEM
-- ====================================
-- Machine learning insights, predictive analytics, and intelligent reporting
-- Supports data science workflows and AI-powered educational insights

-- AI/ML Models Registry
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('classification', 'regression', 'clustering', 'recommendation', 'nlp', 'computer_vision', 'time_series')),
    model_category VARCHAR(50) NOT NULL CHECK (model_category IN ('student_performance', 'risk_prediction', 'resource_optimization', 'sentiment_analysis', 'content_recommendation', 'attendance_prediction', 'fee_prediction')),
    model_version VARCHAR(20) NOT NULL,
    model_description TEXT,
    model_algorithm VARCHAR(100), -- e.g., 'Random Forest', 'Neural Network', 'Linear Regression'
    training_data_description TEXT,
    feature_columns TEXT[], -- List of input features
    target_column VARCHAR(100), -- Target variable for supervised learning
    model_accuracy DECIMAL(5,4), -- Model accuracy/score
    model_precision DECIMAL(5,4),
    model_recall DECIMAL(5,4),
    model_f1_score DECIMAL(5,4),
    model_mae DECIMAL(10,4), -- Mean Absolute Error for regression
    model_rmse DECIMAL(10,4), -- Root Mean Square Error
    model_file_path VARCHAR(500), -- Path to saved model file
    model_config JSONB, -- Model hyperparameters and configuration
    training_date TIMESTAMP,
    last_retrained TIMESTAMP,
    retraining_frequency VARCHAR(20) DEFAULT 'monthly', -- daily, weekly, monthly, quarterly
    is_active BOOLEAN DEFAULT true,
    deployment_status VARCHAR(20) DEFAULT 'development' CHECK (deployment_status IN ('development', 'testing', 'staging', 'production', 'retired')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Model Training Jobs
CREATE TABLE ai_training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    job_name VARCHAR(255) NOT NULL,
    job_type VARCHAR(30) NOT NULL CHECK (job_type IN ('initial_training', 'retraining', 'validation', 'hyperparameter_tuning')),
    job_status VARCHAR(20) DEFAULT 'queued' CHECK (job_status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    training_dataset_query TEXT, -- SQL query to generate training data
    training_parameters JSONB, -- Training hyperparameters
    data_split_ratio JSONB DEFAULT '{"train": 0.7, "validation": 0.15, "test": 0.15}',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    training_samples INTEGER,
    validation_samples INTEGER,
    test_samples INTEGER,
    final_accuracy DECIMAL(5,4),
    final_loss DECIMAL(10,6),
    confusion_matrix JSONB,
    feature_importance JSONB,
    training_logs TEXT,
    error_message TEXT,
    output_metrics JSONB,
    model_artifacts_path VARCHAR(500),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Predictions & Inferences
CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    prediction_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL, -- Features used for prediction
    predicted_value JSONB NOT NULL, -- Model output/prediction
    confidence_score DECIMAL(5,4), -- Prediction confidence (0-1)
    prediction_probabilities JSONB, -- Class probabilities for classification
    entity_type VARCHAR(50), -- e.g., 'student', 'school', 'teacher'
    entity_id UUID, -- ID of the entity being predicted
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    academic_year VARCHAR(20),
    prediction_date TIMESTAMP DEFAULT NOW(),
    actual_outcome JSONB, -- Actual result (for model evaluation)
    outcome_date TIMESTAMP, -- When actual outcome was recorded
    prediction_accuracy DECIMAL(5,4), -- Accuracy of this specific prediction
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_notes TEXT,
    is_validated BOOLEAN DEFAULT false,
    validation_date TIMESTAMP,
    validated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Advanced Analytics Reports
CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('dashboard', 'insight', 'prediction', 'recommendation', 'alert', 'summary')),
    report_category VARCHAR(50) NOT NULL CHECK (report_category IN ('academic_performance', 'financial_analysis', 'operational_efficiency', 'risk_assessment', 'growth_projection', 'resource_utilization')),
    report_scope VARCHAR(30) NOT NULL CHECK (report_scope IN ('platform', 'school', 'grade', 'subject', 'individual')),
    target_entity_type VARCHAR(50), -- student, teacher, school, etc.
    target_entity_id UUID,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    report_data JSONB NOT NULL, -- Main report content and visualizations
    key_insights TEXT[],
    recommendations TEXT[],
    confidence_level VARCHAR(20) DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high', 'very_high')),
    data_sources TEXT[], -- List of data sources used
    computation_method VARCHAR(100), -- Statistical/ML method used
    report_period_start DATE,
    report_period_end DATE,
    generation_time_seconds INTEGER,
    is_automated BOOLEAN DEFAULT false,
    automation_schedule VARCHAR(50), -- cron-like schedule for automated reports
    last_generated TIMESTAMP DEFAULT NOW(),
    next_generation TIMESTAMP,
    recipients UUID[], -- User IDs who should receive this report
    sharing_level VARCHAR(20) DEFAULT 'private' CHECK (sharing_level IN ('private', 'school', 'department', 'public')),
    report_tags TEXT[],
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    report_url VARCHAR(500), -- URL to detailed report
    export_formats VARCHAR(20)[] DEFAULT '{"pdf", "excel", "json"}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Predictive Analytics Alerts
CREATE TABLE predictive_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_name VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('student_at_risk', 'attendance_drop', 'performance_decline', 'fee_default_risk', 'resource_shortage', 'capacity_overflow')),
    severity_level VARCHAR(20) NOT NULL CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
    model_id UUID REFERENCES ai_models(id) ON DELETE SET NULL,
    prediction_id UUID REFERENCES ai_predictions(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    alert_description TEXT NOT NULL,
    predicted_outcome TEXT,
    risk_probability DECIMAL(5,4), -- Probability of negative outcome (0-1)
    impact_assessment VARCHAR(20) CHECK (impact_assessment IN ('minimal', 'moderate', 'significant', 'severe')),
    recommended_actions TEXT[],
    intervention_deadline TIMESTAMP,
    trigger_conditions JSONB, -- Conditions that triggered this alert
    alert_data JSONB, -- Additional data supporting the alert
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'investigating', 'resolved', 'dismissed')),
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    escalation_level INTEGER DEFAULT 0, -- Number of escalations
    last_escalated TIMESTAMP,
    notification_sent BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP,
    recipients_notified UUID[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data Mining Jobs & Insights
CREATE TABLE data_mining_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(255) NOT NULL,
    mining_type VARCHAR(50) NOT NULL CHECK (mining_type IN ('association_rules', 'clustering', 'classification', 'regression', 'anomaly_detection', 'pattern_recognition')),
    dataset_description TEXT,
    data_source_query TEXT NOT NULL, -- SQL query to extract data
    algorithm_used VARCHAR(100),
    job_parameters JSONB, -- Algorithm-specific parameters
    job_status VARCHAR(20) DEFAULT 'pending' CHECK (job_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    execution_time_seconds INTEGER,
    records_processed INTEGER,
    patterns_discovered INTEGER,
    insights_generated TEXT[],
    confidence_metrics JSONB,
    output_data JSONB, -- Discovered patterns, rules, clusters, etc.
    visualization_data JSONB, -- Data for charts and graphs
    scheduled_job BOOLEAN DEFAULT false,
    schedule_cron VARCHAR(100), -- Cron expression for scheduled jobs
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    error_details TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Advanced KPI Metrics & Benchmarks
CREATE TABLE advanced_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_name VARCHAR(255) NOT NULL,
    kpi_category VARCHAR(50) NOT NULL CHECK (kpi_category IN ('academic', 'financial', 'operational', 'engagement', 'satisfaction', 'growth', 'efficiency')),
    kpi_type VARCHAR(30) NOT NULL CHECK (kpi_type IN ('percentage', 'ratio', 'count', 'average', 'sum', 'trend', 'score')),
    calculation_method TEXT NOT NULL, -- SQL or formula for calculation
    kpi_description TEXT,
    entity_type VARCHAR(50) NOT NULL, -- student, teacher, school, class, etc.
    entity_id UUID,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    kpi_value DECIMAL(15,4) NOT NULL,
    previous_value DECIMAL(15,4),
    target_value DECIMAL(15,4),
    benchmark_value DECIMAL(15,4), -- Industry/regional benchmark
    variance_from_target DECIMAL(15,4),
    variance_from_benchmark DECIMAL(15,4),
    performance_rating VARCHAR(20) CHECK (performance_rating IN ('excellent', 'good', 'average', 'below_average', 'poor')),
    trend_direction VARCHAR(20) CHECK (trend_direction IN ('improving', 'stable', 'declining', 'volatile')),
    trend_significance DECIMAL(5,4), -- Statistical significance of trend
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'semester')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data_quality_score DECIMAL(3,2), -- Quality of underlying data (0-1)
    confidence_interval JSONB, -- Statistical confidence interval
    additional_metrics JSONB, -- Related metrics and context
    alerts_generated INTEGER DEFAULT 0,
    is_forecasted BOOLEAN DEFAULT false, -- True if this is a predicted value
    forecast_accuracy DECIMAL(5,4), -- Accuracy of forecast if applicable
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Student Learning Analytics
CREATE TABLE student_learning_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    subject_id UUID, -- Reference to subjects if available
    grade_level VARCHAR(20),
    curriculum_type VARCHAR(20), -- CBC, IGCSE, etc.
    
    -- Learning Progress Metrics
    learning_velocity DECIMAL(8,4), -- Rate of learning progress
    comprehension_score DECIMAL(5,2), -- Overall understanding score
    retention_rate DECIMAL(5,2), -- Knowledge retention percentage
    engagement_score DECIMAL(5,2), -- Student engagement level
    effort_score DECIMAL(5,2), -- Effort and participation level
    
    -- Performance Patterns
    peak_performance_time VARCHAR(20), -- Best learning time of day
    learning_style VARCHAR(30), -- visual, auditory, kinesthetic, etc.
    difficulty_areas TEXT[], -- Topics where student struggles
    strength_areas TEXT[], -- Student's academic strengths
    improvement_trajectory VARCHAR(20) CHECK (improvement_trajectory IN ('accelerating', 'steady', 'slowing', 'declining')),
    
    -- Predictive Metrics
    success_probability DECIMAL(5,4), -- Probability of academic success
    at_risk_factors TEXT[], -- Factors contributing to risk
    intervention_recommendations TEXT[],
    predicted_final_grade VARCHAR(10),
    confidence_in_prediction DECIMAL(5,4),
    
    -- Behavioral Analytics
    attendance_pattern VARCHAR(30), -- regular, irregular, declining
    submission_timeliness DECIMAL(5,2), -- Percentage of on-time submissions
    participation_frequency DECIMAL(5,2), -- Class participation rate
    help_seeking_behavior VARCHAR(30), -- proactive, reluctant, never
    
    -- Comparative Analytics
    peer_rank_percentile DECIMAL(5,2), -- Rank among peers (0-100)
    grade_average_comparison DECIMAL(8,4), -- Above/below grade average
    historical_trend VARCHAR(20), -- Compared to student's own history
    
    -- Learning Resource Analytics
    preferred_content_types TEXT[], -- video, text, interactive, etc.
    resource_utilization_score DECIMAL(5,2),
    digital_literacy_score DECIMAL(5,2),
    technology_comfort_level VARCHAR(20),
    
    analysis_date TIMESTAMP DEFAULT NOW(),
    data_freshness INTEGER, -- Days since last data update
    model_version VARCHAR(20), -- Version of analytics model used
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- School Performance Analytics
CREATE TABLE school_performance_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    academic_year VARCHAR(20),
    
    -- Academic Performance Metrics
    overall_academic_score DECIMAL(5,2),
    grade_level_performance JSONB, -- Performance by grade
    subject_performance JSONB, -- Performance by subject
    curriculum_effectiveness JSONB, -- Effectiveness by curriculum type
    student_progress_rate DECIMAL(5,2),
    achievement_gap_analysis JSONB,
    
    -- Operational Efficiency
    teacher_effectiveness_score DECIMAL(5,2),
    resource_utilization_rate DECIMAL(5,2),
    capacity_utilization DECIMAL(5,2),
    cost_per_student DECIMAL(10,2),
    operational_efficiency_score DECIMAL(5,2),
    
    -- Financial Health
    revenue_per_student DECIMAL(10,2),
    fee_collection_rate DECIMAL(5,2),
    profitability_score DECIMAL(5,2),
    budget_variance DECIMAL(8,2),
    financial_sustainability_score DECIMAL(5,2),
    
    -- Engagement & Satisfaction
    student_satisfaction_score DECIMAL(5,2),
    parent_satisfaction_score DECIMAL(5,2),
    teacher_satisfaction_score DECIMAL(5,2),
    community_engagement_score DECIMAL(5,2),
    brand_reputation_score DECIMAL(5,2),
    
    -- Risk Assessment
    dropout_risk_percentage DECIMAL(5,2),
    teacher_turnover_risk DECIMAL(5,2),
    financial_risk_score DECIMAL(5,2),
    compliance_risk_score DECIMAL(5,2),
    overall_risk_rating VARCHAR(20),
    
    -- Growth & Trends
    enrollment_growth_rate DECIMAL(5,2),
    revenue_growth_rate DECIMAL(5,2),
    market_share_trend DECIMAL(5,2),
    competitive_position VARCHAR(20),
    growth_sustainability_score DECIMAL(5,2),
    
    -- Benchmarking
    regional_ranking INTEGER,
    national_ranking INTEGER,
    peer_comparison_score DECIMAL(5,2),
    best_practice_adherence DECIMAL(5,2),
    
    -- Recommendations
    priority_improvement_areas TEXT[],
    strategic_recommendations TEXT[],
    quick_wins TEXT[],
    investment_recommendations JSONB,
    
    analysis_date TIMESTAMP DEFAULT NOW(),
    analyst_id UUID REFERENCES users(id),
    confidence_score DECIMAL(5,2),
    data_quality_assessment JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Chatbot Interactions
CREATE TABLE ai_chatbot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    chat_context VARCHAR(50) NOT NULL CHECK (chat_context IN ('support', 'academic', 'administrative', 'general')),
    language_code VARCHAR(10) DEFAULT 'en',
    session_start TIMESTAMP DEFAULT NOW(),
    session_end TIMESTAMP,
    total_messages INTEGER DEFAULT 0,
    user_satisfaction_rating INTEGER CHECK (user_satisfaction_rating >= 1 AND user_satisfaction_rating <= 5),
    issue_resolved BOOLEAN,
    escalated_to_human BOOLEAN DEFAULT false,
    escalation_reason TEXT,
    session_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Chatbot Messages
CREATE TABLE ai_chatbot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_chatbot_sessions(id) ON DELETE CASCADE,
    message_index INTEGER NOT NULL, -- Order of message in conversation
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'bot', 'system')),
    message_text TEXT NOT NULL,
    message_intent VARCHAR(100), -- Detected user intent
    intent_confidence DECIMAL(5,4),
    entities_extracted JSONB, -- Named entities found in message
    bot_response_type VARCHAR(50), -- text, quick_reply, card, etc.
    response_time_ms INTEGER, -- Bot response time
    user_feedback VARCHAR(20) CHECK (user_feedback IN ('helpful', 'not_helpful', 'partially_helpful')),
    requires_follow_up BOOLEAN DEFAULT false,
    message_metadata JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_models_type ON ai_models(model_type, model_category);
CREATE INDEX idx_ai_models_status ON ai_models(deployment_status, is_active);
CREATE INDEX idx_ai_models_accuracy ON ai_models(model_accuracy DESC);

CREATE INDEX idx_ai_training_jobs_model ON ai_training_jobs(model_id);
CREATE INDEX idx_ai_training_jobs_status ON ai_training_jobs(job_status);
CREATE INDEX idx_ai_training_jobs_date ON ai_training_jobs(created_at DESC);

CREATE INDEX idx_ai_predictions_model ON ai_predictions(model_id);
CREATE INDEX idx_ai_predictions_entity ON ai_predictions(entity_type, entity_id);
CREATE INDEX idx_ai_predictions_school ON ai_predictions(school_id);
CREATE INDEX idx_ai_predictions_date ON ai_predictions(prediction_date DESC);
CREATE INDEX idx_ai_predictions_confidence ON ai_predictions(confidence_score DESC);

CREATE INDEX idx_analytics_reports_type ON analytics_reports(report_type, report_category);
CREATE INDEX idx_analytics_reports_scope ON analytics_reports(report_scope, target_entity_type);
CREATE INDEX idx_analytics_reports_school ON analytics_reports(school_id);
CREATE INDEX idx_analytics_reports_generated ON analytics_reports(last_generated DESC);
CREATE INDEX idx_analytics_reports_automation ON analytics_reports(is_automated, next_generation);

CREATE INDEX idx_predictive_alerts_type ON predictive_alerts(alert_type, severity_level);
CREATE INDEX idx_predictive_alerts_entity ON predictive_alerts(entity_type, entity_id);
CREATE INDEX idx_predictive_alerts_school ON predictive_alerts(school_id);
CREATE INDEX idx_predictive_alerts_status ON predictive_alerts(status);
CREATE INDEX idx_predictive_alerts_risk ON predictive_alerts(risk_probability DESC);

CREATE INDEX idx_data_mining_jobs_type ON data_mining_jobs(mining_type);
CREATE INDEX idx_data_mining_jobs_status ON data_mining_jobs(job_status);
CREATE INDEX idx_data_mining_jobs_scheduled ON data_mining_jobs(scheduled_job, next_run);

CREATE INDEX idx_advanced_kpis_category ON advanced_kpis(kpi_category, kpi_type);
CREATE INDEX idx_advanced_kpis_entity ON advanced_kpis(entity_type, entity_id);
CREATE INDEX idx_advanced_kpis_school ON advanced_kpis(school_id);
CREATE INDEX idx_advanced_kpis_period ON advanced_kpis(period_start, period_end);
CREATE INDEX idx_advanced_kpis_performance ON advanced_kpis(performance_rating);

CREATE INDEX idx_student_learning_analytics_student ON student_learning_analytics(student_id);
CREATE INDEX idx_student_learning_analytics_school ON student_learning_analytics(school_id);
CREATE INDEX idx_student_learning_analytics_year ON student_learning_analytics(academic_year);
CREATE INDEX idx_student_learning_analytics_success ON student_learning_analytics(success_probability DESC);

CREATE INDEX idx_school_performance_analytics_school ON school_performance_analytics(school_id);
CREATE INDEX idx_school_performance_analytics_period ON school_performance_analytics(analysis_period_start, analysis_period_end);
CREATE INDEX idx_school_performance_analytics_score ON school_performance_analytics(overall_academic_score DESC);

CREATE INDEX idx_ai_chatbot_sessions_user ON ai_chatbot_sessions(user_id);
CREATE INDEX idx_ai_chatbot_sessions_school ON ai_chatbot_sessions(school_id);
CREATE INDEX idx_ai_chatbot_sessions_context ON ai_chatbot_sessions(chat_context);
CREATE INDEX idx_ai_chatbot_sessions_start ON ai_chatbot_sessions(session_start DESC);

CREATE INDEX idx_ai_chatbot_messages_session ON ai_chatbot_messages(session_id);
CREATE INDEX idx_ai_chatbot_messages_timestamp ON ai_chatbot_messages(timestamp DESC);
CREATE INDEX idx_ai_chatbot_messages_intent ON ai_chatbot_messages(message_intent);

-- RLS Policies for AI/Analytics tables
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_models_access ON ai_models 
    FOR ALL USING (current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'data_scientist', 'school_admin'));

ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_predictions_school_isolation ON ai_predictions 
    USING (school_id = current_setting('app.current_school_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'data_scientist'));

ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_reports_access ON analytics_reports 
    USING (
        school_id = current_setting('app.current_school_id')::UUID 
        OR sharing_level = 'public' 
        OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'data_scientist')
        OR current_setting('app.current_user_id')::UUID = ANY(recipients)
    );

ALTER TABLE predictive_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY predictive_alerts_school_isolation ON predictive_alerts 
    USING (school_id = current_setting('app.current_school_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'data_scientist'));

ALTER TABLE advanced_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY advanced_kpis_school_isolation ON advanced_kpis 
    USING (school_id = current_setting('app.current_school_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'data_scientist'));

ALTER TABLE student_learning_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_learning_analytics_school_isolation ON student_learning_analytics 
    USING (school_id = current_setting('app.current_school_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'data_scientist'));

ALTER TABLE school_performance_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_performance_analytics_access ON school_performance_analytics 
    USING (school_id = current_setting('app.current_school_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin', 'data_scientist'));

ALTER TABLE ai_chatbot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_chatbot_sessions_access ON ai_chatbot_sessions 
    USING (
        user_id = current_setting('app.current_user_id')::UUID 
        OR school_id = current_setting('app.current_school_id')::UUID 
        OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin')
    );

ALTER TABLE ai_chatbot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_chatbot_messages_session_access ON ai_chatbot_messages 
    USING (session_id IN (SELECT id FROM ai_chatbot_sessions));

-- Initial AI model types and sample data
INSERT INTO ai_models (model_name, model_type, model_category, model_version, model_description, model_algorithm, deployment_status, created_by) 
SELECT 
    'Student Risk Predictor', 'classification', 'risk_prediction', '1.0', 
    'Predicts students at risk of academic failure or dropout', 'Random Forest', 'development',
    id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_models (model_name, model_type, model_category, model_version, model_description, model_algorithm, deployment_status, created_by) 
SELECT 
    'Attendance Forecaster', 'time_series', 'attendance_prediction', '1.0', 
    'Forecasts student attendance patterns and identifies irregular patterns', 'LSTM Neural Network', 'development',
    id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ai_models (model_name, model_type, model_category, model_version, model_description, model_algorithm, deployment_status, created_by) 
SELECT 
    'Fee Payment Predictor', 'classification', 'fee_prediction', '1.0', 
    'Predicts likelihood of timely fee payment and default risk', 'Gradient Boosting', 'development',
    id
FROM users WHERE role = 'super_admin' LIMIT 1
ON CONFLICT DO NOTHING;