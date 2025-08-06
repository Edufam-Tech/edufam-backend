const { Pool } = require('pg');

/**
 * Create Enhanced Security & Compliance Tables Directly
 */

async function createSecurityComplianceTables() {
  console.log('🚀 Creating Enhanced Security & Compliance Tables');
  console.log('===============================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables one by one
    console.log('\n📄 Creating security and compliance tables...');

    // 1. Security Audit Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        event_category VARCHAR(30) NOT NULL,
        severity_level VARCHAR(20) NOT NULL CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
        risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        session_id VARCHAR(255),
        impersonated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ip_address INET NOT NULL,
        user_agent TEXT,
        request_method VARCHAR(10),
        request_url TEXT,
        request_headers JSONB,
        request_body_hash VARCHAR(64),
        response_status INTEGER,
        response_size BIGINT,
        processing_time_ms INTEGER,
        authentication_method VARCHAR(30),
        authorization_context JSONB,
        data_sensitivity VARCHAR(20) CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
        school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
        student_id UUID REFERENCES students(id) ON DELETE SET NULL,
        data_subjects TEXT[],
        legal_basis VARCHAR(50),
        event_description TEXT NOT NULL,
        event_details JSONB,
        success BOOLEAN NOT NULL DEFAULT true,
        failure_reason TEXT,
        threat_indicators TEXT[],
        geolocation JSONB,
        device_fingerprint VARCHAR(255),
        anomaly_score DECIMAL(5,2),
        investigated BOOLEAN DEFAULT false,
        investigation_notes TEXT,
        investigated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        investigation_date TIMESTAMP,
        incident_id UUID,
        retention_period_days INTEGER DEFAULT 2555,
        archived BOOLEAN DEFAULT false,
        archived_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ security_audit_logs table created');

    // 2. Data Protection Records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS data_protection_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_subject_type VARCHAR(30) NOT NULL CHECK (data_subject_type IN ('student', 'parent', 'teacher', 'employee', 'visitor')),
        data_subject_id UUID,
        external_subject_id VARCHAR(255),
        data_categories TEXT[] NOT NULL,
        sensitive_data_categories TEXT[],
        data_locations TEXT[],
        legal_basis VARCHAR(50) NOT NULL CHECK (legal_basis IN ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests')),
        consent_given BOOLEAN DEFAULT false,
        consent_date TIMESTAMP,
        consent_withdrawn BOOLEAN DEFAULT false,
        consent_withdrawal_date TIMESTAMP,
        consent_evidence JSONB,
        processing_purpose TEXT NOT NULL,
        processing_activities TEXT[],
        retention_period_months INTEGER,
        automatic_deletion_date DATE,
        shared_with_third_parties BOOLEAN DEFAULT false,
        third_party_details JSONB,
        international_transfers BOOLEAN DEFAULT false,
        transfer_safeguards TEXT,
        access_requests_count INTEGER DEFAULT 0,
        last_access_request TIMESTAMP,
        rectification_requests_count INTEGER DEFAULT 0,
        last_rectification_request TIMESTAMP,
        erasure_requests_count INTEGER DEFAULT 0,
        last_erasure_request TIMESTAMP,
        portability_requests_count INTEGER DEFAULT 0,
        restriction_requests_count INTEGER DEFAULT 0,
        objection_requests_count INTEGER DEFAULT 0,
        data_accuracy_verified BOOLEAN DEFAULT false,
        last_accuracy_check TIMESTAMP,
        data_completeness_score DECIMAL(5,2),
        data_quality_issues TEXT[],
        encryption_status VARCHAR(20) CHECK (encryption_status IN ('none', 'at_rest', 'in_transit', 'full')),
        access_controls TEXT[],
        security_classification VARCHAR(20) CHECK (security_classification IN ('public', 'internal', 'confidential', 'restricted')),
        gdpr_compliant BOOLEAN DEFAULT false,
        compliance_notes TEXT,
        last_compliance_review TIMESTAMP,
        next_compliance_review DATE,
        breached BOOLEAN DEFAULT false,
        breach_date TIMESTAMP,
        breach_notified BOOLEAN DEFAULT false,
        breach_notification_date TIMESTAMP,
        breach_impact_assessment TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id),
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE
      )
    `);
    console.log('   ✅ data_protection_records table created');

    // 3. Security Incidents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_type VARCHAR(50) NOT NULL,
        incident_category VARCHAR(30) NOT NULL,
        severity_level VARCHAR(20) NOT NULL CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
        urgency_level VARCHAR(20) NOT NULL CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent')),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        impact_assessment TEXT,
        affected_systems TEXT[],
        affected_data_types TEXT[],
        estimated_records_affected INTEGER,
        incident_detected_at TIMESTAMP NOT NULL,
        incident_occurred_at TIMESTAMP,
        incident_reported_at TIMESTAMP DEFAULT NOW(),
        incident_resolved_at TIMESTAMP,
        detected_by VARCHAR(50),
        detection_method VARCHAR(50),
        reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
        external_reporter_details JSONB,
        confidentiality_impact VARCHAR(20) CHECK (confidentiality_impact IN ('none', 'low', 'medium', 'high')),
        integrity_impact VARCHAR(20) CHECK (integrity_impact IN ('none', 'low', 'medium', 'high')),
        availability_impact VARCHAR(20) CHECK (availability_impact IN ('none', 'low', 'medium', 'high')),
        financial_impact DECIMAL(12,2),
        reputational_impact TEXT,
        regulatory_impact TEXT,
        investigation_status VARCHAR(20) DEFAULT 'pending' CHECK (investigation_status IN ('pending', 'in_progress', 'completed', 'closed')),
        assigned_investigator UUID REFERENCES users(id) ON DELETE SET NULL,
        investigation_team TEXT[],
        investigation_findings TEXT,
        root_cause_analysis TEXT,
        containment_actions TEXT[],
        containment_status VARCHAR(20) CHECK (containment_status IN ('none', 'partial', 'full')),
        eradication_actions TEXT[],
        recovery_actions TEXT[],
        lessons_learned TEXT,
        stakeholders_notified TEXT[],
        notification_timeline JSONB,
        public_disclosure_required BOOLEAN DEFAULT false,
        public_disclosure_date TIMESTAMP,
        regulatory_notification_required BOOLEAN DEFAULT false,
        regulatory_notification_date TIMESTAMP,
        evidence_collected TEXT[],
        evidence_storage_location TEXT,
        forensic_analysis_performed BOOLEAN DEFAULT false,
        forensic_report_location TEXT,
        preventive_measures TEXT[],
        process_improvements TEXT[],
        training_required BOOLEAN DEFAULT false,
        policy_updates_required BOOLEAN DEFAULT false,
        law_enforcement_involved BOOLEAN DEFAULT false,
        law_enforcement_case_number VARCHAR(100),
        insurance_claim_filed BOOLEAN DEFAULT false,
        insurance_claim_number VARCHAR(100),
        legal_counsel_involved BOOLEAN DEFAULT false,
        school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
        affects_multiple_schools BOOLEAN DEFAULT false,
        affected_schools UUID[],
        current_status VARCHAR(20) DEFAULT 'open' CHECK (current_status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
        resolution_summary TEXT,
        post_incident_review_completed BOOLEAN DEFAULT false,
        post_incident_review_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ security_incidents table created');

    // 4. Compliance Frameworks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_frameworks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        framework_code VARCHAR(20) UNIQUE NOT NULL,
        framework_name VARCHAR(100) NOT NULL,
        full_name VARCHAR(255),
        description TEXT,
        regulatory_body VARCHAR(100),
        jurisdiction VARCHAR(100),
        framework_version VARCHAR(20),
        effective_date DATE,
        last_updated DATE,
        applies_to_students BOOLEAN DEFAULT false,
        applies_to_staff BOOLEAN DEFAULT false,
        applies_to_financial_data BOOLEAN DEFAULT false,
        applies_to_academic_records BOOLEAN DEFAULT false,
        data_categories TEXT[],
        consent_required BOOLEAN DEFAULT false,
        data_protection_officer_required BOOLEAN DEFAULT false,
        breach_notification_required BOOLEAN DEFAULT false,
        breach_notification_timeline_hours INTEGER,
        data_retention_limits BOOLEAN DEFAULT false,
        right_to_access BOOLEAN DEFAULT false,
        right_to_rectification BOOLEAN DEFAULT false,
        right_to_erasure BOOLEAN DEFAULT false,
        right_to_portability BOOLEAN DEFAULT false,
        maximum_penalty_amount DECIMAL(15,2),
        penalty_currency VARCHAR(3),
        enforcement_actions TEXT[],
        is_active BOOLEAN DEFAULT true,
        mandatory_for_organization BOOLEAN DEFAULT false,
        implementation_deadline DATE,
        framework_url VARCHAR(500),
        guidance_documents JSONB,
        training_materials JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);
    console.log('   ✅ compliance_frameworks table created');

    // 5. Compliance Controls
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_controls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
        control_code VARCHAR(50) NOT NULL,
        control_title VARCHAR(200) NOT NULL,
        control_description TEXT NOT NULL,
        control_category VARCHAR(50),
        implementation_status VARCHAR(20) DEFAULT 'not_implemented' CHECK (implementation_status IN ('not_implemented', 'partially_implemented', 'implemented', 'not_applicable')),
        implementation_evidence TEXT,
        implementation_date DATE,
        responsible_party UUID REFERENCES users(id) ON DELETE SET NULL,
        responsible_department VARCHAR(100),
        last_assessment_date DATE,
        last_assessment_result VARCHAR(20) CHECK (last_assessment_result IN ('compliant', 'non_compliant', 'partially_compliant', 'not_assessed')),
        assessment_notes TEXT,
        assessor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        compliance_gaps TEXT[],
        remediation_actions TEXT[],
        remediation_deadline DATE,
        remediation_cost DECIMAL(10,2),
        remediation_responsible UUID REFERENCES users(id) ON DELETE SET NULL,
        monitoring_frequency VARCHAR(20),
        last_monitoring_date DATE,
        next_monitoring_date DATE,
        automated_monitoring BOOLEAN DEFAULT false,
        monitoring_tools TEXT[],
        inherent_risk_level VARCHAR(20) CHECK (inherent_risk_level IN ('low', 'medium', 'high', 'critical')),
        residual_risk_level VARCHAR(20) CHECK (residual_risk_level IN ('low', 'medium', 'high', 'critical')),
        risk_treatment VARCHAR(30),
        policies_procedures TEXT[],
        training_requirements TEXT[],
        evidence_documents TEXT[],
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        applies_to_all_schools BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(framework_id, control_code, school_id)
      )
    `);
    console.log('   ✅ compliance_controls table created');

    // 6. Data Subject Requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS data_subject_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_type VARCHAR(30) NOT NULL CHECK (request_type IN ('access', 'rectification', 'erasure', 'portability', 'restriction', 'objection')),
        request_reference VARCHAR(50) UNIQUE NOT NULL,
        data_subject_type VARCHAR(30) NOT NULL,
        data_subject_id UUID,
        requester_name VARCHAR(255) NOT NULL,
        requester_email VARCHAR(255) NOT NULL,
        requester_phone VARCHAR(20),
        relationship_to_subject VARCHAR(50),
        identity_verified BOOLEAN DEFAULT false,
        identity_verification_method VARCHAR(50),
        identity_verification_date TIMESTAMP,
        verification_documents TEXT[],
        data_categories_requested TEXT[],
        date_range_from DATE,
        date_range_to DATE,
        specific_records_requested TEXT,
        reason_for_request TEXT,
        received_date TIMESTAMP DEFAULT NOW(),
        acknowledged_date TIMESTAMP,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        processing_status VARCHAR(20) DEFAULT 'received' CHECK (processing_status IN ('received', 'acknowledged', 'processing', 'completed', 'rejected', 'partially_fulfilled')),
        legal_basis_review_required BOOLEAN DEFAULT false,
        legal_basis_confirmed BOOLEAN DEFAULT false,
        legal_review_notes TEXT,
        exemptions_applied TEXT[],
        data_sources_searched TEXT[],
        records_found_count INTEGER DEFAULT 0,
        data_collection_completed BOOLEAN DEFAULT false,
        data_collection_notes TEXT,
        third_parties_contacted BOOLEAN DEFAULT false,
        third_party_responses JSONB,
        response_format VARCHAR(30),
        response_delivery_method VARCHAR(30),
        data_anonymization_applied BOOLEAN DEFAULT false,
        redactions_applied BOOLEAN DEFAULT false,
        redaction_reasons TEXT[],
        response_sent_date TIMESTAMP,
        response_documents TEXT[],
        completion_notes TEXT,
        follow_up_required BOOLEAN DEFAULT false,
        follow_up_actions TEXT[],
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        review_date TIMESTAMP,
        review_approved BOOLEAN DEFAULT false,
        review_comments TEXT,
        statutory_deadline DATE,
        extension_granted BOOLEAN DEFAULT false,
        extension_reason TEXT,
        extended_deadline DATE,
        deadline_met BOOLEAN DEFAULT false,
        communication_log JSONB,
        school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ data_subject_requests table created');

    // 7. Security Configurations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_category VARCHAR(50) NOT NULL,
        config_name VARCHAR(100) NOT NULL,
        config_description TEXT,
        policy_settings JSONB NOT NULL,
        default_settings JSONB,
        current_value JSONB,
        security_level VARCHAR(20) CHECK (security_level IN ('basic', 'standard', 'enhanced', 'maximum')),
        compliance_frameworks TEXT[],
        applies_to VARCHAR(30) CHECK (applies_to IN ('global', 'school', 'user', 'role')),
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        target_role VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        is_enforced BOOLEAN DEFAULT true,
        validation_rules JSONB,
        last_validated TIMESTAMP,
        validation_status VARCHAR(20) CHECK (validation_status IN ('valid', 'invalid', 'warning', 'not_validated')),
        change_reason TEXT,
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approval_date TIMESTAMP,
        implemented_by UUID REFERENCES users(id) ON DELETE SET NULL,
        implementation_date TIMESTAMP,
        rollback_possible BOOLEAN DEFAULT true,
        previous_value JSONB,
        monitoring_enabled BOOLEAN DEFAULT false,
        alert_on_change BOOLEAN DEFAULT false,
        alert_recipients TEXT[],
        configuration_guide TEXT,
        related_policies TEXT[],
        impact_assessment TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL REFERENCES users(id),
        UNIQUE(config_category, config_name, school_id, target_role)
      )
    `);
    console.log('   ✅ security_configurations table created');

    // Create indexes
    console.log('\n📄 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON security_audit_logs(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type ON security_audit_logs(event_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_audit_logs_severity ON security_audit_logs(severity_level)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON security_audit_logs(created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ip_address ON security_audit_logs(ip_address)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_audit_logs_school_id ON security_audit_logs(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_audit_logs_session_id ON security_audit_logs(session_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_audit_logs_anomaly_score ON security_audit_logs(anomaly_score DESC) WHERE anomaly_score > 70');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_protection_records_subject_type ON data_protection_records(data_subject_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_protection_records_subject_id ON data_protection_records(data_subject_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_protection_records_legal_basis ON data_protection_records(legal_basis)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_protection_records_school_id ON data_protection_records(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_protection_records_deletion_date ON data_protection_records(automatic_deletion_date) WHERE automatic_deletion_date IS NOT NULL');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_protection_records_consent ON data_protection_records(consent_given, consent_withdrawn)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity_level)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(current_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_detected_at ON security_incidents(incident_detected_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_school_id ON security_incidents(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_incidents_assigned ON security_incidents(assigned_investigator)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework ON compliance_controls(framework_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_compliance_controls_status ON compliance_controls(implementation_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_compliance_controls_school ON compliance_controls(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_compliance_controls_assessment ON compliance_controls(last_assessment_result)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_compliance_controls_risk ON compliance_controls(residual_risk_level)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_subject_requests_type ON data_subject_requests(request_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status ON data_subject_requests(processing_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_subject_requests_deadline ON data_subject_requests(statutory_deadline)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_subject_requests_received ON data_subject_requests(received_date DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_subject_requests_school ON data_subject_requests(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_data_subject_requests_subject_id ON data_subject_requests(data_subject_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_configurations_category ON security_configurations(config_category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_configurations_school ON security_configurations(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_configurations_active ON security_configurations(is_active) WHERE is_active = true');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_security_configurations_enforced ON security_configurations(is_enforced) WHERE is_enforced = true');
    console.log('   ✅ Indexes created');

    // Insert initial compliance frameworks
    console.log('\n📄 Inserting initial compliance frameworks...');
    
    const superAdminResult = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    const createdById = superAdminResult.rows[0]?.id;

    if (createdById) {
      await pool.query(`
        INSERT INTO compliance_frameworks (
          framework_code, framework_name, full_name, description, regulatory_body,
          jurisdiction, consent_required, breach_notification_required, 
          breach_notification_timeline_hours, right_to_access, right_to_rectification, 
          right_to_erasure, right_to_portability, created_by
        ) VALUES
        ('GDPR', 'GDPR', 'General Data Protection Regulation',
        'EU regulation on data protection and privacy for individuals within the European Union', 
        'European Commission', 'EU', true, true, 72, true, true, true, true, $1),

        ('FERPA', 'FERPA', 'Family Educational Rights and Privacy Act',
        'US federal law that protects the privacy of student education records',
        'US Department of Education', 'US', false, false, NULL, true, true, false, false, $1),

        ('COPPA', 'COPPA', 'Children''s Online Privacy Protection Act',
        'US federal law that imposes requirements on operators of websites or online services directed to children under 13',
        'Federal Trade Commission', 'US', true, false, NULL, true, true, true, false, $1),

        ('DPA2019', 'Kenya DPA', 'Kenya Data Protection Act 2019',
        'Kenya''s data protection law based on GDPR principles',
        'Office of the Data Protection Commissioner', 'Kenya', true, true, 72, true, true, true, true, $1)
        ON CONFLICT (framework_code) DO NOTHING
      `, [createdById]);
      console.log('   ✅ Initial compliance frameworks inserted');
    } else {
      console.log('   ⚠️  No super admin found, skipping framework insertion');
    }

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE 'security_%' OR table_name LIKE 'compliance_%' OR table_name LIKE 'data_%')
        AND table_name NOT LIKE 'data_migrations'
      ORDER BY table_name
    `);

    console.log('📋 Created Security & Compliance Tables:');
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

    console.log('\n🎉 Enhanced Security & Compliance Tables Created Successfully!');
    console.log('\n🔒 Ready for Security Features:');
    console.log('   • Comprehensive Security Audit Logging');
    console.log('   • Advanced Threat Detection & Monitoring');
    console.log('   • Security Incident Management');
    console.log('   • Real-Time Anomaly Detection');
    console.log('   • Risk Assessment & Scoring');

    console.log('\n📋 Ready for Compliance Features:');
    console.log('   • GDPR & Data Protection Compliance');
    console.log('   • Data Subject Rights Management');
    console.log('   • Regulatory Framework Support (GDPR, FERPA, COPPA, Kenya DPA)');
    console.log('   • Consent Management & Tracking');
    console.log('   • Data Retention & Deletion');
    console.log('   • Compliance Control Assessment');
    console.log('   • Breach Notification Management');

    console.log('\n🎯 Supported Compliance Frameworks:');
    console.log('   • GDPR (General Data Protection Regulation) - EU');
    console.log('   • FERPA (Family Educational Rights and Privacy Act) - US');
    console.log('   • COPPA (Children\'s Online Privacy Protection Act) - US');
    console.log('   • Kenya Data Protection Act 2019 - Kenya');

  } catch (error) {
    console.error('❌ Error creating security & compliance tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createSecurityComplianceTables();