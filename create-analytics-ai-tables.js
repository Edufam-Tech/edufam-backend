const { Pool } = require('pg');

/**
 * Create Advanced Analytics & AI Tables Directly
 */

async function createAnalyticsAiTables() {
  console.log('🚀 Creating Advanced Analytics & AI Tables');
  console.log('===========================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables one by one
    console.log('\n📄 Creating analytics AI tables...');

    // 1. AI Models Registry
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_name VARCHAR(255) NOT NULL,
        model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('classification', 'regression', 'clustering', 'recommendation', 'nlp', 'computer_vision', 'time_series')),
        model_category VARCHAR(50) NOT NULL CHECK (model_category IN ('student_performance', 'risk_prediction', 'resource_optimization', 'sentiment_analysis', 'content_recommendation', 'attendance_prediction', 'fee_prediction')),
        model_version VARCHAR(20) NOT NULL,
        model_description TEXT,
        model_algorithm VARCHAR(100),
        training_data_description TEXT,
        feature_columns TEXT[],
        target_column VARCHAR(100),
        model_accuracy DECIMAL(5,4),
        model_precision DECIMAL(5,4),
        model_recall DECIMAL(5,4),
        model_f1_score DECIMAL(5,4),
        model_mae DECIMAL(10,4),
        model_rmse DECIMAL(10,4),
        model_file_path VARCHAR(500),
        model_config JSONB,
        training_date TIMESTAMP,
        last_retrained TIMESTAMP,
        retraining_frequency VARCHAR(20) DEFAULT 'monthly',
        is_active BOOLEAN DEFAULT true,
        deployment_status VARCHAR(20) DEFAULT 'development' CHECK (deployment_status IN ('development', 'testing', 'staging', 'production', 'retired')),
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ ai_models table created');

    // 2. AI Predictions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
        prediction_type VARCHAR(50) NOT NULL,
        input_data JSONB NOT NULL,
        predicted_value JSONB NOT NULL,
        confidence_score DECIMAL(5,4),
        prediction_probabilities JSONB,
        entity_type VARCHAR(50),
        entity_id UUID,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        academic_year VARCHAR(20),
        prediction_date TIMESTAMP DEFAULT NOW(),
        actual_outcome JSONB,
        outcome_date TIMESTAMP,
        prediction_accuracy DECIMAL(5,4),
        feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
        feedback_notes TEXT,
        is_validated BOOLEAN DEFAULT false,
        validation_date TIMESTAMP,
        validated_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ ai_predictions table created');

    // 3. Analytics Reports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_name VARCHAR(255) NOT NULL,
        report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('dashboard', 'insight', 'prediction', 'recommendation', 'alert', 'summary')),
        report_category VARCHAR(50) NOT NULL CHECK (report_category IN ('academic_performance', 'financial_analysis', 'operational_efficiency', 'risk_assessment', 'growth_projection', 'resource_utilization')),
        report_scope VARCHAR(30) NOT NULL CHECK (report_scope IN ('platform', 'school', 'grade', 'subject', 'individual')),
        target_entity_type VARCHAR(50),
        target_entity_id UUID,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        report_data JSONB NOT NULL,
        key_insights TEXT[],
        recommendations TEXT[],
        confidence_level VARCHAR(20) DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high', 'very_high')),
        data_sources TEXT[],
        computation_method VARCHAR(100),
        report_period_start DATE,
        report_period_end DATE,
        generation_time_seconds INTEGER,
        is_automated BOOLEAN DEFAULT false,
        automation_schedule VARCHAR(50),
        last_generated TIMESTAMP DEFAULT NOW(),
        next_generation TIMESTAMP,
        recipients UUID[],
        sharing_level VARCHAR(20) DEFAULT 'private' CHECK (sharing_level IN ('private', 'school', 'department', 'public')),
        report_tags TEXT[],
        view_count INTEGER DEFAULT 0,
        download_count INTEGER DEFAULT 0,
        report_url VARCHAR(500),
        export_formats VARCHAR(20)[] DEFAULT '{"pdf", "excel", "json"}',
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ analytics_reports table created');

    // 4. Predictive Alerts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS predictive_alerts (
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
        risk_probability DECIMAL(5,4),
        impact_assessment VARCHAR(20) CHECK (impact_assessment IN ('minimal', 'moderate', 'significant', 'severe')),
        recommended_actions TEXT[],
        intervention_deadline TIMESTAMP,
        trigger_conditions JSONB,
        alert_data JSONB,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'investigating', 'resolved', 'dismissed')),
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP,
        resolved_by UUID REFERENCES users(id),
        resolved_at TIMESTAMP,
        resolution_notes TEXT,
        follow_up_required BOOLEAN DEFAULT false,
        follow_up_date DATE,
        escalation_level INTEGER DEFAULT 0,
        last_escalated TIMESTAMP,
        notification_sent BOOLEAN DEFAULT false,
        notification_sent_at TIMESTAMP,
        recipients_notified UUID[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ predictive_alerts table created');

    // 5. Student Learning Analytics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_learning_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        academic_year VARCHAR(20) NOT NULL,
        subject_id UUID,
        grade_level VARCHAR(20),
        curriculum_type VARCHAR(20),
        learning_velocity DECIMAL(8,4),
        comprehension_score DECIMAL(5,2),
        retention_rate DECIMAL(5,2),
        engagement_score DECIMAL(5,2),
        effort_score DECIMAL(5,2),
        peak_performance_time VARCHAR(20),
        learning_style VARCHAR(30),
        difficulty_areas TEXT[],
        strength_areas TEXT[],
        improvement_trajectory VARCHAR(20) CHECK (improvement_trajectory IN ('accelerating', 'steady', 'slowing', 'declining')),
        success_probability DECIMAL(5,4),
        at_risk_factors TEXT[],
        intervention_recommendations TEXT[],
        predicted_final_grade VARCHAR(10),
        confidence_in_prediction DECIMAL(5,4),
        attendance_pattern VARCHAR(30),
        submission_timeliness DECIMAL(5,2),
        participation_frequency DECIMAL(5,2),
        help_seeking_behavior VARCHAR(30),
        peer_rank_percentile DECIMAL(5,2),
        grade_average_comparison DECIMAL(8,4),
        historical_trend VARCHAR(20),
        preferred_content_types TEXT[],
        resource_utilization_score DECIMAL(5,2),
        digital_literacy_score DECIMAL(5,2),
        technology_comfort_level VARCHAR(20),
        analysis_date TIMESTAMP DEFAULT NOW(),
        data_freshness INTEGER,
        model_version VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (student_id, school_id, academic_year)
      )
    `);
    console.log('   ✅ student_learning_analytics table created');

    // 6. AI Chatbot Sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_chatbot_sessions (
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
      )
    `);
    console.log('   ✅ ai_chatbot_sessions table created');

    // 7. AI Chatbot Messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_chatbot_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES ai_chatbot_sessions(id) ON DELETE CASCADE,
        message_index INTEGER NOT NULL,
        sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'bot', 'system')),
        message_text TEXT NOT NULL,
        message_intent VARCHAR(100),
        intent_confidence DECIMAL(5,4),
        entities_extracted JSONB,
        bot_response_type VARCHAR(50),
        response_time_ms INTEGER,
        user_feedback VARCHAR(20) CHECK (user_feedback IN ('helpful', 'not_helpful', 'partially_helpful')),
        requires_follow_up BOOLEAN DEFAULT false,
        message_metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ ai_chatbot_messages table created');

    // 8. Data Mining Jobs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS data_mining_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_name VARCHAR(255) NOT NULL,
        mining_type VARCHAR(50) NOT NULL CHECK (mining_type IN ('association_rules', 'clustering', 'classification', 'regression', 'anomaly_detection', 'pattern_recognition')),
        dataset_description TEXT,
        data_source_query TEXT NOT NULL,
        algorithm_used VARCHAR(100),
        job_parameters JSONB,
        job_status VARCHAR(20) DEFAULT 'pending' CHECK (job_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        execution_time_seconds INTEGER,
        records_processed INTEGER,
        patterns_discovered INTEGER,
        insights_generated TEXT[],
        confidence_metrics JSONB,
        output_data JSONB,
        visualization_data JSONB,
        scheduled_job BOOLEAN DEFAULT false,
        schedule_cron VARCHAR(100),
        last_run TIMESTAMP,
        next_run TIMESTAMP,
        error_details TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ data_mining_jobs table created');

    // 9. Advanced KPIs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS advanced_kpis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kpi_name VARCHAR(255) NOT NULL,
        kpi_category VARCHAR(50) NOT NULL CHECK (kpi_category IN ('academic', 'financial', 'operational', 'engagement', 'satisfaction', 'growth', 'efficiency')),
        kpi_type VARCHAR(30) NOT NULL CHECK (kpi_type IN ('percentage', 'ratio', 'count', 'average', 'sum', 'trend', 'score')),
        calculation_method TEXT NOT NULL,
        kpi_description TEXT,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        kpi_value DECIMAL(15,4) NOT NULL,
        previous_value DECIMAL(15,4),
        target_value DECIMAL(15,4),
        benchmark_value DECIMAL(15,4),
        variance_from_target DECIMAL(15,4),
        variance_from_benchmark DECIMAL(15,4),
        performance_rating VARCHAR(20) CHECK (performance_rating IN ('excellent', 'good', 'average', 'below_average', 'poor')),
        trend_direction VARCHAR(20) CHECK (trend_direction IN ('improving', 'stable', 'declining', 'volatile')),
        trend_significance DECIMAL(5,4),
        period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'semester')),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        data_quality_score DECIMAL(3,2),
        confidence_interval JSONB,
        additional_metrics JSONB,
        alerts_generated INTEGER DEFAULT 0,
        is_forecasted BOOLEAN DEFAULT false,
        forecast_accuracy DECIMAL(5,4),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (kpi_name, entity_type, entity_id, period_start, period_end)
      )
    `);
    console.log('   ✅ advanced_kpis table created');

    // Create indexes
    console.log('\n📄 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_models_type ON ai_models(model_type, model_category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_models_status ON ai_models(deployment_status, is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_models_accuracy ON ai_models(model_accuracy DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_predictions_model ON ai_predictions(model_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_predictions_entity ON ai_predictions(entity_type, entity_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_predictions_school ON ai_predictions(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_predictions_date ON ai_predictions(prediction_date DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_predictions_confidence ON ai_predictions(confidence_score DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type, report_category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_reports_scope ON analytics_reports(report_scope, target_entity_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_reports_school ON analytics_reports(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_reports_generated ON analytics_reports(last_generated DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_reports_automation ON analytics_reports(is_automated, next_generation)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_predictive_alerts_type ON predictive_alerts(alert_type, severity_level)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_predictive_alerts_entity ON predictive_alerts(entity_type, entity_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_predictive_alerts_school ON predictive_alerts(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_predictive_alerts_status ON predictive_alerts(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_predictive_alerts_risk ON predictive_alerts(risk_probability DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_student_learning_analytics_student ON student_learning_analytics(student_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_student_learning_analytics_school ON student_learning_analytics(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_student_learning_analytics_year ON student_learning_analytics(academic_year)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_student_learning_analytics_success ON student_learning_analytics(success_probability DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_chatbot_sessions_user ON ai_chatbot_sessions(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_chatbot_sessions_school ON ai_chatbot_sessions(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_chatbot_sessions_context ON ai_chatbot_sessions(chat_context)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_chatbot_sessions_start ON ai_chatbot_sessions(session_start DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_chatbot_messages_session ON ai_chatbot_messages(session_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_chatbot_messages_timestamp ON ai_chatbot_messages(timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ai_chatbot_messages_intent ON ai_chatbot_messages(message_intent)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_mining_jobs_type ON data_mining_jobs(mining_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_mining_jobs_status ON data_mining_jobs(job_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_mining_jobs_scheduled ON data_mining_jobs(scheduled_job, next_run)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_advanced_kpis_category ON advanced_kpis(kpi_category, kpi_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_advanced_kpis_entity ON advanced_kpis(entity_type, entity_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_advanced_kpis_school ON advanced_kpis(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_advanced_kpis_period ON advanced_kpis(period_start, period_end)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_advanced_kpis_performance ON advanced_kpis(performance_rating)');
    console.log('   ✅ Indexes created');

    // Insert initial data
    console.log('\n📄 Inserting initial analytics AI data...');
    
    const superAdminResult = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    const createdById = superAdminResult.rows[0]?.id;

    if (createdById) {
      // Insert sample AI models
      await pool.query(`
        INSERT INTO ai_models (model_name, model_type, model_category, model_version, model_description, model_algorithm, deployment_status, created_by) VALUES
        ('Student Risk Predictor', 'classification', 'risk_prediction', '1.0', 'Predicts students at risk of academic failure or dropout', 'Random Forest', 'development', $1),
        ('Attendance Forecaster', 'time_series', 'attendance_prediction', '1.0', 'Forecasts student attendance patterns and identifies irregular patterns', 'LSTM Neural Network', 'development', $1),
        ('Fee Payment Predictor', 'classification', 'fee_prediction', '1.0', 'Predicts likelihood of timely fee payment and default risk', 'Gradient Boosting', 'development', $1),
        ('Performance Analyzer', 'regression', 'student_performance', '1.0', 'Analyzes and predicts student academic performance trends', 'Linear Regression', 'development', $1),
        ('Resource Optimizer', 'clustering', 'resource_optimization', '1.0', 'Optimizes resource allocation and utilization across schools', 'K-Means Clustering', 'development', $1)
        ON CONFLICT DO NOTHING
      `, [createdById]);

      console.log('   ✅ Initial AI models inserted');
    } else {
      console.log('   ⚠️  No super admin found, skipping data insertion');
    }

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE 'ai_%' OR table_name LIKE 'analytics_%' OR table_name LIKE 'predictive_%' OR table_name LIKE 'student_learning_%' OR table_name LIKE 'data_mining_%' OR table_name LIKE 'advanced_kpis%')
      ORDER BY table_name
    `);

    console.log('📋 Created Analytics AI Tables:');
    validation.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Get counts
    console.log('\n📊 Table Statistics:');
    for (const table of validation.rows) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table.table_name}`);
        console.log(`   📝 ${table.table_name}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`   ❌ ${table.table_name}: Error getting count`);
      }
    }

    console.log('\n🎉 Advanced Analytics & AI Tables Created Successfully!');
    console.log('\n🤖 Ready for AI & ML Features:');
    console.log('   • Machine Learning Model Registry');
    console.log('   • Predictive Analytics & Forecasting');
    console.log('   • Intelligent Risk Assessment');
    console.log('   • Automated Report Generation');
    console.log('   • Student Learning Analytics');
    console.log('   • AI-Powered Chatbot Support');
    console.log('   • Advanced KPI Monitoring');
    console.log('   • Data Mining & Pattern Recognition');
    console.log('   • Predictive Alert System');
    console.log('   • Real-time Analytics Dashboard');

    console.log('\n🎯 AI Models Created:');
    console.log('   • Student Risk Predictor - Identifies at-risk students');
    console.log('   • Attendance Forecaster - Predicts attendance patterns');
    console.log('   • Fee Payment Predictor - Forecasts payment behavior');
    console.log('   • Performance Analyzer - Analyzes academic trends');
    console.log('   • Resource Optimizer - Optimizes resource allocation');

  } catch (error) {
    console.error('❌ Error creating analytics AI tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createAnalyticsAiTables();