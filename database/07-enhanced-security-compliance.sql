-- ====================================
-- ENHANCED SECURITY & COMPLIANCE SYSTEM
-- ====================================
-- This module handles advanced security features, audit logging,
-- compliance monitoring, and regulatory requirements (GDPR, etc.)

-- Security Audit Logs
CREATE TABLE security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event Classification
    event_type VARCHAR(50) NOT NULL, -- login, logout, data_access, data_modification, permission_change, etc.
    event_category VARCHAR(30) NOT NULL, -- authentication, authorization, data_access, system_admin, compliance
    severity_level VARCHAR(20) NOT NULL CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    
    -- User and Session Information
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    impersonated_by UUID REFERENCES users(id) ON DELETE SET NULL, -- For admin impersonation
    
    -- Request Information
    ip_address INET NOT NULL,
    user_agent TEXT,
    request_method VARCHAR(10), -- GET, POST, PUT, DELETE, etc.
    request_url TEXT,
    request_headers JSONB,
    request_body_hash VARCHAR(64), -- SHA256 hash for sensitive data
    
    -- Response Information
    response_status INTEGER,
    response_size BIGINT,
    processing_time_ms INTEGER,
    
    -- Security Context
    authentication_method VARCHAR(30), -- password, mfa, sso, api_key, etc.
    authorization_context JSONB, -- Roles, permissions, school context
    data_sensitivity VARCHAR(20) CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
    
    -- Compliance and Business Context
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL, -- For student data access
    data_subjects TEXT[], -- For GDPR compliance
    legal_basis VARCHAR(50), -- consent, contract, legal_obligation, etc.
    
    -- Event Details
    event_description TEXT NOT NULL,
    event_details JSONB, -- Additional structured data
    success BOOLEAN NOT NULL DEFAULT true,
    failure_reason TEXT, -- If success = false
    
    -- Detection and Analysis
    threat_indicators TEXT[], -- Suspicious patterns detected
    geolocation JSONB, -- Country, city, coordinates
    device_fingerprint VARCHAR(255),
    anomaly_score DECIMAL(5,2), -- 0.00 to 100.00
    
    -- Investigation and Response
    investigated BOOLEAN DEFAULT false,
    investigation_notes TEXT,
    investigated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    investigation_date TIMESTAMP,
    incident_id UUID, -- Link to security incidents
    
    -- Retention and Compliance
    retention_period_days INTEGER DEFAULT 2555, -- 7 years default
    archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data Protection & Privacy Management
CREATE TABLE data_protection_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Data Subject Information
    data_subject_type VARCHAR(30) NOT NULL CHECK (data_subject_type IN ('student', 'parent', 'teacher', 'employee', 'visitor')),
    data_subject_id UUID, -- Reference to the actual user/student
    external_subject_id VARCHAR(255), -- For non-system users
    
    -- Personal Data Categories
    data_categories TEXT[] NOT NULL, -- personal_details, academic_records, financial_data, health_data, etc.
    sensitive_data_categories TEXT[], -- health, religion, ethnicity, political_opinions, etc.
    data_locations TEXT[], -- database, file_storage, backup, archive, third_party
    
    -- Legal Basis for Processing
    legal_basis VARCHAR(50) NOT NULL CHECK (legal_basis IN ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests')),
    consent_given BOOLEAN DEFAULT false,
    consent_date TIMESTAMP,
    consent_withdrawn BOOLEAN DEFAULT false,
    consent_withdrawal_date TIMESTAMP,
    consent_evidence JSONB, -- How consent was obtained
    
    -- Processing Purpose
    processing_purpose TEXT NOT NULL,
    processing_activities TEXT[], -- collection, storage, analysis, sharing, etc.
    retention_period_months INTEGER,
    automatic_deletion_date DATE,
    
    -- Data Sharing and Transfers
    shared_with_third_parties BOOLEAN DEFAULT false,
    third_party_details JSONB, -- Partner organizations, service providers
    international_transfers BOOLEAN DEFAULT false,
    transfer_safeguards TEXT, -- adequacy_decision, standard_contractual_clauses, etc.
    
    -- Data Subject Rights
    access_requests_count INTEGER DEFAULT 0,
    last_access_request TIMESTAMP,
    rectification_requests_count INTEGER DEFAULT 0,
    last_rectification_request TIMESTAMP,
    erasure_requests_count INTEGER DEFAULT 0,
    last_erasure_request TIMESTAMP,
    portability_requests_count INTEGER DEFAULT 0,
    restriction_requests_count INTEGER DEFAULT 0,
    objection_requests_count INTEGER DEFAULT 0,
    
    -- Data Quality and Accuracy
    data_accuracy_verified BOOLEAN DEFAULT false,
    last_accuracy_check TIMESTAMP,
    data_completeness_score DECIMAL(5,2), -- 0.00 to 100.00
    data_quality_issues TEXT[],
    
    -- Security Measures
    encryption_status VARCHAR(20) CHECK (encryption_status IN ('none', 'at_rest', 'in_transit', 'full')),
    access_controls TEXT[], -- rbac, mfa, encryption, pseudonymization
    security_classification VARCHAR(20) CHECK (security_classification IN ('public', 'internal', 'confidential', 'restricted')),
    
    -- Compliance Status
    gdpr_compliant BOOLEAN DEFAULT false,
    compliance_notes TEXT,
    last_compliance_review TIMESTAMP,
    next_compliance_review DATE,
    
    -- Data Breach Information
    breached BOOLEAN DEFAULT false,
    breach_date TIMESTAMP,
    breach_notified BOOLEAN DEFAULT false,
    breach_notification_date TIMESTAMP,
    breach_impact_assessment TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- School Context
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE
);

-- Security Incidents and Threats
CREATE TABLE security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Incident Classification
    incident_type VARCHAR(50) NOT NULL, -- data_breach, unauthorized_access, malware, phishing, ddos, etc.
    incident_category VARCHAR(30) NOT NULL, -- security, privacy, operational, compliance
    severity_level VARCHAR(20) NOT NULL CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
    urgency_level VARCHAR(20) NOT NULL CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent')),
    
    -- Incident Details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact_assessment TEXT,
    affected_systems TEXT[],
    affected_data_types TEXT[],
    estimated_records_affected INTEGER,
    
    -- Timeline
    incident_detected_at TIMESTAMP NOT NULL,
    incident_occurred_at TIMESTAMP, -- Estimated time of actual incident
    incident_reported_at TIMESTAMP DEFAULT NOW(),
    incident_resolved_at TIMESTAMP,
    
    -- Detection and Reporting
    detected_by VARCHAR(50), -- automated_system, user_report, audit, third_party
    detection_method VARCHAR(50), -- log_analysis, anomaly_detection, user_complaint, etc.
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    external_reporter_details JSONB, -- If reported by external party
    
    -- Impact Assessment
    confidentiality_impact VARCHAR(20) CHECK (confidentiality_impact IN ('none', 'low', 'medium', 'high')),
    integrity_impact VARCHAR(20) CHECK (integrity_impact IN ('none', 'low', 'medium', 'high')),
    availability_impact VARCHAR(20) CHECK (availability_impact IN ('none', 'low', 'medium', 'high')),
    financial_impact DECIMAL(12,2),
    reputational_impact TEXT,
    regulatory_impact TEXT,
    
    -- Investigation
    investigation_status VARCHAR(20) DEFAULT 'pending' CHECK (investigation_status IN ('pending', 'in_progress', 'completed', 'closed')),
    assigned_investigator UUID REFERENCES users(id) ON DELETE SET NULL,
    investigation_team TEXT[], -- List of team members
    investigation_findings TEXT,
    root_cause_analysis TEXT,
    
    -- Response and Containment
    containment_actions TEXT[],
    containment_status VARCHAR(20) CHECK (containment_status IN ('none', 'partial', 'full')),
    eradication_actions TEXT[],
    recovery_actions TEXT[],
    lessons_learned TEXT,
    
    -- Communication and Notification
    stakeholders_notified TEXT[], -- management, legal, hr, affected_users, regulators
    notification_timeline JSONB, -- When each stakeholder was notified
    public_disclosure_required BOOLEAN DEFAULT false,
    public_disclosure_date TIMESTAMP,
    regulatory_notification_required BOOLEAN DEFAULT false,
    regulatory_notification_date TIMESTAMP,
    
    -- Evidence and Documentation
    evidence_collected TEXT[],
    evidence_storage_location TEXT,
    forensic_analysis_performed BOOLEAN DEFAULT false,
    forensic_report_location TEXT,
    
    -- Follow-up Actions
    preventive_measures TEXT[],
    process_improvements TEXT[],
    training_required BOOLEAN DEFAULT false,
    policy_updates_required BOOLEAN DEFAULT false,
    
    -- External Parties
    law_enforcement_involved BOOLEAN DEFAULT false,
    law_enforcement_case_number VARCHAR(100),
    insurance_claim_filed BOOLEAN DEFAULT false,
    insurance_claim_number VARCHAR(100),
    legal_counsel_involved BOOLEAN DEFAULT false,
    
    -- School Context
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    affects_multiple_schools BOOLEAN DEFAULT false,
    affected_schools UUID[], -- Array of school IDs
    
    -- Status and Resolution
    current_status VARCHAR(20) DEFAULT 'open' CHECK (current_status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
    resolution_summary TEXT,
    post_incident_review_completed BOOLEAN DEFAULT false,
    post_incident_review_date TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Compliance Framework Management
CREATE TABLE compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Framework Details
    framework_code VARCHAR(20) UNIQUE NOT NULL, -- GDPR, FERPA, COPPA, ISO27001, etc.
    framework_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255),
    description TEXT,
    
    -- Regulatory Information
    regulatory_body VARCHAR(100), -- European Commission, US Department of Education, etc.
    jurisdiction VARCHAR(100), -- EU, US, Kenya, International
    framework_version VARCHAR(20),
    effective_date DATE,
    last_updated DATE,
    
    -- Applicability
    applies_to_students BOOLEAN DEFAULT false,
    applies_to_staff BOOLEAN DEFAULT false,
    applies_to_financial_data BOOLEAN DEFAULT false,
    applies_to_academic_records BOOLEAN DEFAULT false,
    data_categories TEXT[], -- What types of data this framework covers
    
    -- Requirements
    consent_required BOOLEAN DEFAULT false,
    data_protection_officer_required BOOLEAN DEFAULT false,
    breach_notification_required BOOLEAN DEFAULT false,
    breach_notification_timeline_hours INTEGER, -- Hours to notify
    data_retention_limits BOOLEAN DEFAULT false,
    right_to_access BOOLEAN DEFAULT false,
    right_to_rectification BOOLEAN DEFAULT false,
    right_to_erasure BOOLEAN DEFAULT false,
    right_to_portability BOOLEAN DEFAULT false,
    
    -- Penalties and Enforcement
    maximum_penalty_amount DECIMAL(15,2),
    penalty_currency VARCHAR(3),
    enforcement_actions TEXT[], -- fines, cease_orders, criminal_prosecution
    
    -- Implementation Status
    is_active BOOLEAN DEFAULT true,
    mandatory_for_organization BOOLEAN DEFAULT false,
    implementation_deadline DATE,
    
    -- Documentation
    framework_url VARCHAR(500),
    guidance_documents JSONB,
    training_materials JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Compliance Assessments and Controls
CREATE TABLE compliance_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    
    -- Control Details
    control_code VARCHAR(50) NOT NULL, -- GDPR.Art.6, FERPA.99.31, etc.
    control_title VARCHAR(200) NOT NULL,
    control_description TEXT NOT NULL,
    control_category VARCHAR(50), -- technical, administrative, physical
    
    -- Implementation
    implementation_status VARCHAR(20) DEFAULT 'not_implemented' CHECK (implementation_status IN ('not_implemented', 'partially_implemented', 'implemented', 'not_applicable')),
    implementation_evidence TEXT,
    implementation_date DATE,
    responsible_party UUID REFERENCES users(id) ON DELETE SET NULL,
    responsible_department VARCHAR(100),
    
    -- Assessment
    last_assessment_date DATE,
    last_assessment_result VARCHAR(20) CHECK (last_assessment_result IN ('compliant', 'non_compliant', 'partially_compliant', 'not_assessed')),
    assessment_notes TEXT,
    assessor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Gaps and Remediation
    compliance_gaps TEXT[],
    remediation_actions TEXT[],
    remediation_deadline DATE,
    remediation_cost DECIMAL(10,2),
    remediation_responsible UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Monitoring and Testing
    monitoring_frequency VARCHAR(20), -- daily, weekly, monthly, quarterly, annually
    last_monitoring_date DATE,
    next_monitoring_date DATE,
    automated_monitoring BOOLEAN DEFAULT false,
    monitoring_tools TEXT[],
    
    -- Risk Assessment
    inherent_risk_level VARCHAR(20) CHECK (inherent_risk_level IN ('low', 'medium', 'high', 'critical')),
    residual_risk_level VARCHAR(20) CHECK (residual_risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_treatment VARCHAR(30), -- accept, mitigate, transfer, avoid
    
    -- Documentation
    policies_procedures TEXT[], -- Related policies and procedures
    training_requirements TEXT[],
    evidence_documents TEXT[],
    
    -- School Implementation
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE, -- NULL for global controls
    applies_to_all_schools BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(framework_id, control_code, school_id)
);

-- Data Subject Rights Requests (GDPR, etc.)
CREATE TABLE data_subject_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request Details
    request_type VARCHAR(30) NOT NULL CHECK (request_type IN ('access', 'rectification', 'erasure', 'portability', 'restriction', 'objection')),
    request_reference VARCHAR(50) UNIQUE NOT NULL, -- Generated reference number
    
    -- Data Subject Information
    data_subject_type VARCHAR(30) NOT NULL, -- student, parent, teacher, employee
    data_subject_id UUID, -- If they have an account
    requester_name VARCHAR(255) NOT NULL,
    requester_email VARCHAR(255) NOT NULL,
    requester_phone VARCHAR(20),
    relationship_to_subject VARCHAR(50), -- self, parent, guardian, legal_representative
    
    -- Identity Verification
    identity_verified BOOLEAN DEFAULT false,
    identity_verification_method VARCHAR(50), -- document_upload, in_person, email_verification
    identity_verification_date TIMESTAMP,
    verification_documents TEXT[],
    
    -- Request Scope
    data_categories_requested TEXT[], -- If specific categories requested
    date_range_from DATE, -- If specific time period requested
    date_range_to DATE,
    specific_records_requested TEXT,
    reason_for_request TEXT,
    
    -- Processing
    received_date TIMESTAMP DEFAULT NOW(),
    acknowledged_date TIMESTAMP,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    processing_status VARCHAR(20) DEFAULT 'received' CHECK (processing_status IN ('received', 'acknowledged', 'processing', 'completed', 'rejected', 'partially_fulfilled')),
    
    -- Legal Assessment
    legal_basis_review_required BOOLEAN DEFAULT false,
    legal_basis_confirmed BOOLEAN DEFAULT false,
    legal_review_notes TEXT,
    exemptions_applied TEXT[], -- law_enforcement, freedom_of_expression, etc.
    
    -- Data Identification and Collection
    data_sources_searched TEXT[], -- databases, file_systems, backups, third_parties
    records_found_count INTEGER DEFAULT 0,
    data_collection_completed BOOLEAN DEFAULT false,
    data_collection_notes TEXT,
    
    -- Third Party Involvement
    third_parties_contacted BOOLEAN DEFAULT false,
    third_party_responses JSONB, -- Responses from external parties
    
    -- Response Preparation
    response_format VARCHAR(30), -- pdf, csv, json, hard_copy
    response_delivery_method VARCHAR(30), -- email, postal, secure_download, in_person
    data_anonymization_applied BOOLEAN DEFAULT false,
    redactions_applied BOOLEAN DEFAULT false,
    redaction_reasons TEXT[],
    
    -- Completion and Delivery
    response_sent_date TIMESTAMP,
    response_documents TEXT[], -- File paths or references
    completion_notes TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_actions TEXT[],
    
    -- Quality Assurance
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_date TIMESTAMP,
    review_approved BOOLEAN DEFAULT false,
    review_comments TEXT,
    
    -- Timeline Compliance
    statutory_deadline DATE, -- Based on regulation (30 days for GDPR)
    extension_granted BOOLEAN DEFAULT false,
    extension_reason TEXT,
    extended_deadline DATE,
    deadline_met BOOLEAN DEFAULT false,
    
    -- Communication Log
    communication_log JSONB, -- Timeline of all communications
    
    -- School Context
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Security Configuration and Policies
CREATE TABLE security_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Configuration Details
    config_category VARCHAR(50) NOT NULL, -- authentication, authorization, encryption, monitoring, etc.
    config_name VARCHAR(100) NOT NULL,
    config_description TEXT,
    
    -- Policy Settings
    policy_settings JSONB NOT NULL, -- JSON object with specific settings
    default_settings JSONB, -- Default/recommended settings
    current_value JSONB, -- Currently applied value
    
    -- Security Level
    security_level VARCHAR(20) CHECK (security_level IN ('basic', 'standard', 'enhanced', 'maximum')),
    compliance_frameworks TEXT[], -- Which frameworks require this setting
    
    -- Implementation
    applies_to VARCHAR(30) CHECK (applies_to IN ('global', 'school', 'user', 'role')),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE, -- NULL for global settings
    target_role VARCHAR(50), -- If applies to specific role
    
    -- Status and Validation
    is_active BOOLEAN DEFAULT true,
    is_enforced BOOLEAN DEFAULT true,
    validation_rules JSONB, -- Rules to validate the configuration
    last_validated TIMESTAMP,
    validation_status VARCHAR(20) CHECK (validation_status IN ('valid', 'invalid', 'warning', 'not_validated')),
    
    -- Change Management
    change_reason TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_date TIMESTAMP,
    implemented_by UUID REFERENCES users(id) ON DELETE SET NULL,
    implementation_date TIMESTAMP,
    rollback_possible BOOLEAN DEFAULT true,
    previous_value JSONB, -- For rollback purposes
    
    -- Monitoring and Alerts
    monitoring_enabled BOOLEAN DEFAULT false,
    alert_on_change BOOLEAN DEFAULT false,
    alert_recipients TEXT[], -- Email addresses or user IDs
    
    -- Documentation
    configuration_guide TEXT,
    related_policies TEXT[],
    impact_assessment TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    
    UNIQUE(config_category, config_name, school_id, target_role)
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Security audit logs indexes
CREATE INDEX idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX idx_security_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX idx_security_audit_logs_severity ON security_audit_logs(severity_level);
CREATE INDEX idx_security_audit_logs_created_at ON security_audit_logs(created_at DESC);
CREATE INDEX idx_security_audit_logs_ip_address ON security_audit_logs(ip_address);
CREATE INDEX idx_security_audit_logs_school_id ON security_audit_logs(school_id);
CREATE INDEX idx_security_audit_logs_session_id ON security_audit_logs(session_id);
CREATE INDEX idx_security_audit_logs_anomaly_score ON security_audit_logs(anomaly_score DESC) WHERE anomaly_score > 70;

-- Data protection records indexes
CREATE INDEX idx_data_protection_records_subject_type ON data_protection_records(data_subject_type);
CREATE INDEX idx_data_protection_records_subject_id ON data_protection_records(data_subject_id);
CREATE INDEX idx_data_protection_records_legal_basis ON data_protection_records(legal_basis);
CREATE INDEX idx_data_protection_records_school_id ON data_protection_records(school_id);
CREATE INDEX idx_data_protection_records_deletion_date ON data_protection_records(automatic_deletion_date) WHERE automatic_deletion_date IS NOT NULL;
CREATE INDEX idx_data_protection_records_consent ON data_protection_records(consent_given, consent_withdrawn);

-- Security incidents indexes
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity_level);
CREATE INDEX idx_security_incidents_status ON security_incidents(current_status);
CREATE INDEX idx_security_incidents_detected_at ON security_incidents(incident_detected_at DESC);
CREATE INDEX idx_security_incidents_school_id ON security_incidents(school_id);
CREATE INDEX idx_security_incidents_type ON security_incidents(incident_type);
CREATE INDEX idx_security_incidents_assigned ON security_incidents(assigned_investigator);

-- Compliance controls indexes
CREATE INDEX idx_compliance_controls_framework ON compliance_controls(framework_id);
CREATE INDEX idx_compliance_controls_status ON compliance_controls(implementation_status);
CREATE INDEX idx_compliance_controls_school ON compliance_controls(school_id);
CREATE INDEX idx_compliance_controls_assessment ON compliance_controls(last_assessment_result);
CREATE INDEX idx_compliance_controls_risk ON compliance_controls(residual_risk_level);

-- Data subject requests indexes
CREATE INDEX idx_data_subject_requests_type ON data_subject_requests(request_type);
CREATE INDEX idx_data_subject_requests_status ON data_subject_requests(processing_status);
CREATE INDEX idx_data_subject_requests_deadline ON data_subject_requests(statutory_deadline);
CREATE INDEX idx_data_subject_requests_received ON data_subject_requests(received_date DESC);
CREATE INDEX idx_data_subject_requests_school ON data_subject_requests(school_id);
CREATE INDEX idx_data_subject_requests_subject_id ON data_subject_requests(data_subject_id);

-- Security configurations indexes
CREATE INDEX idx_security_configurations_category ON security_configurations(config_category);
CREATE INDEX idx_security_configurations_school ON security_configurations(school_id);
CREATE INDEX idx_security_configurations_active ON security_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_security_configurations_enforced ON security_configurations(is_enforced) WHERE is_enforced = true;

-- ====================================
-- INITIAL DATA
-- ====================================

-- Insert major compliance frameworks
INSERT INTO compliance_frameworks (
    framework_code, framework_name, full_name, description, regulatory_body,
    jurisdiction, consent_required, breach_notification_required, 
    breach_notification_timeline_hours, right_to_access, right_to_rectification, 
    right_to_erasure, right_to_portability, created_by
) VALUES
('GDPR', 'GDPR', 'General Data Protection Regulation',
'EU regulation on data protection and privacy for individuals within the European Union', 
'European Commission', 'EU', true, true, 72, true, true, true, true,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

('FERPA', 'FERPA', 'Family Educational Rights and Privacy Act',
'US federal law that protects the privacy of student education records',
'US Department of Education', 'US', false, false, NULL, true, true, false, false,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

('COPPA', 'COPPA', 'Children''s Online Privacy Protection Act',
'US federal law that imposes requirements on operators of websites or online services directed to children under 13',
'Federal Trade Commission', 'US', true, false, NULL, true, true, true, false,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),

('DPA2019', 'Kenya DPA', 'Kenya Data Protection Act 2019',
'Kenya''s data protection law based on GDPR principles',
'Office of the Data Protection Commissioner', 'Kenya', true, true, 72, true, true, true, true,
(SELECT id FROM users WHERE role = 'super_admin' LIMIT 1));

COMMENT ON TABLE security_audit_logs IS 'Comprehensive audit trail for all security-relevant events';
COMMENT ON TABLE data_protection_records IS 'GDPR and privacy compliance tracking for data subjects';
COMMENT ON TABLE security_incidents IS 'Security incident management and response tracking';
COMMENT ON TABLE compliance_frameworks IS 'Regulatory compliance frameworks (GDPR, FERPA, etc.)';
COMMENT ON TABLE compliance_controls IS 'Implementation status of compliance requirements';
COMMENT ON TABLE data_subject_requests IS 'GDPR data subject rights requests management';
COMMENT ON TABLE security_configurations IS 'Security policy settings and configurations';