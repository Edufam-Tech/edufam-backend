-- ====================================
-- COMPREHENSIVE APPROVAL SYSTEM
-- ====================================
-- Central approval engine for all approval workflows across the platform
-- Supports multi-level approvals, delegation, escalation, and audit

-- Central Approval System
CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Request Classification
    request_type VARCHAR(50) NOT NULL, -- expense, recruitment, fee_assignment, policy, purchase, etc.
    request_category VARCHAR(50), -- financial, hr, academic, operational, administrative
    request_id UUID NOT NULL, -- ID of the actual request (expense_id, recruitment_id, etc)
    related_entity_type VARCHAR(50), -- students, staff, classes, departments
    related_entity_id UUID, -- Specific entity ID if applicable
    
    -- Request Details
    request_title VARCHAR(255) NOT NULL,
    request_description TEXT,
    request_data JSONB NOT NULL, -- Full request details for audit
    business_justification TEXT, -- Why this request is needed
    risk_assessment TEXT, -- Potential risks and mitigation
    
    -- Requester Information
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMP DEFAULT NOW(),
    department VARCHAR(100), -- Requesting department
    cost_center VARCHAR(50), -- For budget tracking
    
    -- Financial Details (if applicable)
    amount DECIMAL(15,2), -- For financial approvals
    currency VARCHAR(3) DEFAULT 'KES',
    budget_year VARCHAR(10), -- 2024, 2024/2025
    budget_category VARCHAR(100), -- Which budget line item
    
    -- Approval Workflow State
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN (
        'pending', 'in_review', 'approved', 'rejected', 'delegated', 
        'escalated', 'cancelled', 'expired', 'withdrawn'
    )),
    current_approval_level INTEGER DEFAULT 1,
    total_approval_levels INTEGER DEFAULT 1,
    
    -- Workflow Metadata
    workflow_template_id UUID, -- Reference to workflow template
    approval_path JSONB, -- Complete approval path configuration
    deadline TIMESTAMP, -- When approval decision is needed
    auto_approve_conditions JSONB, -- Conditions for auto-approval
    
    -- Final Approval Details
    final_approver_id UUID REFERENCES users(id),
    final_approved_at TIMESTAMP,
    final_rejection_reason TEXT,
    final_approval_comments TEXT,
    
    -- Escalation and Delegation
    escalated_to UUID REFERENCES users(id),
    escalated_at TIMESTAMP,
    escalation_reason TEXT,
    escalation_level INTEGER DEFAULT 0,
    max_escalation_level INTEGER DEFAULT 3,
    
    -- Timing and SLA
    expected_approval_date DATE,
    actual_approval_date DATE,
    sla_hours INTEGER DEFAULT 72, -- Service level agreement in hours
    sla_status VARCHAR(20) DEFAULT 'on_time' CHECK (sla_status IN ('on_time', 'at_risk', 'overdue')),
    
    -- Impact and Urgency
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
    impact_level VARCHAR(20) DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
    urgency_level VARCHAR(20) DEFAULT 'medium' CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Compliance and Audit
    requires_audit BOOLEAN DEFAULT false,
    compliance_requirements TEXT[], -- Regulatory requirements to check
    compliance_checked BOOLEAN DEFAULT false,
    compliance_notes TEXT,
    
    -- System Fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_approval_levels CHECK (current_approval_level <= total_approval_levels),
    CONSTRAINT valid_escalation CHECK (escalation_level <= max_escalation_level)
);

-- Approval Workflow Rules and Templates
CREATE TABLE approval_workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Template Details
    template_name VARCHAR(255) NOT NULL,
    template_description TEXT,
    request_type VARCHAR(50) NOT NULL,
    request_category VARCHAR(50),
    
    -- Activation Conditions
    condition_rules JSONB NOT NULL, -- Complex conditions: amount ranges, departments, etc.
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    priority_order INTEGER DEFAULT 100, -- Lower number = higher priority
    
    -- Approval Levels Configuration
    approval_levels JSONB NOT NULL, -- Array of approval level configurations
    escalation_rules JSONB, -- When and how to escalate
    delegation_rules JSONB, -- Who can delegate and to whom
    
    -- Timing and SLA
    default_sla_hours INTEGER DEFAULT 72,
    level_sla_hours JSONB, -- Different SLA for each level
    auto_escalation_hours INTEGER DEFAULT 168, -- 1 week
    
    -- Auto-approval Rules
    auto_approval_enabled BOOLEAN DEFAULT false,
    auto_approval_conditions JSONB,
    auto_approval_max_amount DECIMAL(15,2),
    
    -- Notifications
    notification_rules JSONB, -- When and how to notify
    reminder_intervals INTEGER[] DEFAULT '{24, 48, 72}', -- Hours for reminders
    
    -- Version and Audit
    version VARCHAR(20) DEFAULT '1.0',
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_until DATE,
    created_by UUID NOT NULL REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(school_id, request_type, template_name)
);

-- Individual Approval Level Actions
CREATE TABLE approval_level_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    
    -- Approval Level Details
    approval_level INTEGER NOT NULL,
    level_name VARCHAR(100), -- "Finance Review", "Principal Approval", etc.
    required_approver_role VARCHAR(50), -- finance_manager, principal, director
    required_approver_id UUID REFERENCES users(id), -- Specific approver if required
    approver_group VARCHAR(50), -- Group of users who can approve
    
    -- Action Status
    action_status VARCHAR(20) DEFAULT 'pending' CHECK (action_status IN (
        'pending', 'approved', 'rejected', 'delegated', 'skipped', 'escalated'
    )),
    action_taken_at TIMESTAMP,
    action_taken_by UUID REFERENCES users(id),
    
    -- Action Details
    approval_comments TEXT,
    rejection_reason TEXT,
    conditions_for_approval TEXT,
    conditions_met BOOLEAN DEFAULT false,
    
    -- Delegation
    delegated_to UUID REFERENCES users(id),
    delegated_at TIMESTAMP,
    delegation_reason TEXT,
    delegation_expiry TIMESTAMP,
    
    -- Timing
    received_at TIMESTAMP DEFAULT NOW(),
    due_date TIMESTAMP,
    response_time_hours INTEGER,
    
    -- Decision Support
    supporting_documents TEXT[], -- URLs to uploaded documents
    recommendations TEXT,
    alternative_options TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(approval_request_id, approval_level)
);

-- Approval Notifications and Reminders
CREATE TABLE approval_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    approval_level_action_id UUID REFERENCES approval_level_actions(id),
    
    -- Notification Details
    notification_type VARCHAR(30) NOT NULL, -- pending, approved, rejected, escalated, reminder
    notification_method VARCHAR(20) DEFAULT 'email' CHECK (notification_method IN ('email', 'sms', 'in_app', 'webhook')),
    notification_title VARCHAR(255) NOT NULL,
    notification_message TEXT NOT NULL,
    
    -- Recipient Information
    recipient_id UUID NOT NULL REFERENCES users(id),
    recipient_role VARCHAR(50),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    
    -- Delivery Status
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN (
        'pending', 'sent', 'delivered', 'failed', 'bounced'
    )),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    
    -- Tracking
    notification_id VARCHAR(255), -- External notification service ID
    external_status VARCHAR(50), -- Status from external service
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Approval Decision History and Audit Trail
CREATE TABLE approval_decision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    
    -- Decision Details
    decision_type VARCHAR(30) NOT NULL, -- created, reviewed, approved, rejected, delegated, escalated
    decision_level INTEGER,
    decision_maker_id UUID NOT NULL REFERENCES users(id),
    decision_maker_role VARCHAR(50),
    
    -- Decision Context
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    decision_rationale TEXT,
    decision_data JSONB, -- Full decision context
    
    -- Impact Assessment
    impact_on_timeline TEXT,
    impact_on_budget TEXT,
    impact_on_stakeholders TEXT,
    
    -- System Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    timestamp TIMESTAMP DEFAULT NOW(),
    
    -- Approval Chain
    approval_chain_position INTEGER,
    total_chain_length INTEGER,
    chain_completion_percentage DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Approval Metrics and SLA Tracking
CREATE TABLE approval_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Metric Period
    metric_period VARCHAR(20) NOT NULL, -- daily, weekly, monthly, quarterly
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    
    -- Volume Metrics
    total_requests INTEGER DEFAULT 0,
    approved_requests INTEGER DEFAULT 0,
    rejected_requests INTEGER DEFAULT 0,
    pending_requests INTEGER DEFAULT 0,
    escalated_requests INTEGER DEFAULT 0,
    
    -- SLA Metrics
    on_time_approvals INTEGER DEFAULT 0,
    overdue_approvals INTEGER DEFAULT 0,
    average_approval_time_hours DECIMAL(8,2),
    median_approval_time_hours DECIMAL(8,2),
    
    -- Performance by Type
    metrics_by_type JSONB, -- Breakdown by request_type
    metrics_by_category JSONB, -- Breakdown by category
    metrics_by_priority JSONB, -- Breakdown by priority
    
    -- Bottleneck Analysis
    bottleneck_levels INTEGER[], -- Which levels are slowest
    bottleneck_approvers UUID[], -- Which approvers are slowest
    
    -- Trend Data
    approval_rate_trend DECIMAL(5,2), -- Percentage change from previous period
    volume_trend DECIMAL(5,2), -- Volume change from previous period
    efficiency_score DECIMAL(5,2), -- Overall efficiency score
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(school_id, metric_period, period_start)
);

-- Approval Rule Exceptions and Overrides
CREATE TABLE approval_rule_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    
    -- Exception Details
    exception_type VARCHAR(50) NOT NULL, -- emergency_override, rule_bypass, escalation_skip
    exception_reason TEXT NOT NULL,
    authorized_by UUID NOT NULL REFERENCES users(id),
    authorized_at TIMESTAMP DEFAULT NOW(),
    
    -- Original Rule vs Override
    original_rule JSONB, -- What the rule would have been
    override_rule JSONB, -- What was applied instead
    impact_assessment TEXT,
    
    -- Approval and Audit
    exception_approved_by UUID REFERENCES users(id),
    exception_approval_required BOOLEAN DEFAULT true,
    audit_required BOOLEAN DEFAULT true,
    audit_completed BOOLEAN DEFAULT false,
    audit_findings TEXT,
    
    -- Validity
    valid_until TIMESTAMP,
    is_temporary BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Primary indexes for approval_requests
CREATE INDEX idx_approval_requests_school ON approval_requests(school_id);
CREATE INDEX idx_approval_requests_type ON approval_requests(request_type);
CREATE INDEX idx_approval_requests_status ON approval_requests(approval_status);
CREATE INDEX idx_approval_requests_requester ON approval_requests(requested_by);
CREATE INDEX idx_approval_requests_priority ON approval_requests(priority);
CREATE INDEX idx_approval_requests_deadline ON approval_requests(deadline);
CREATE INDEX idx_approval_requests_sla ON approval_requests(sla_status);

-- Composite indexes
CREATE INDEX idx_approval_requests_school_status ON approval_requests(school_id, approval_status);
CREATE INDEX idx_approval_requests_type_status ON approval_requests(request_type, approval_status);
CREATE INDEX idx_approval_requests_pending_deadline ON approval_requests(deadline) 
    WHERE approval_status IN ('pending', 'in_review');

-- Workflow template indexes
CREATE INDEX idx_approval_workflow_templates_school ON approval_workflow_templates(school_id);
CREATE INDEX idx_approval_workflow_templates_type ON approval_workflow_templates(request_type);
CREATE INDEX idx_approval_workflow_templates_active ON approval_workflow_templates(is_active) 
    WHERE is_active = true;
CREATE INDEX idx_approval_workflow_templates_priority ON approval_workflow_templates(priority_order);

-- Level actions indexes
CREATE INDEX idx_approval_level_actions_request ON approval_level_actions(approval_request_id);
CREATE INDEX idx_approval_level_actions_level ON approval_level_actions(approval_level);
CREATE INDEX idx_approval_level_actions_status ON approval_level_actions(action_status);
CREATE INDEX idx_approval_level_actions_approver ON approval_level_actions(action_taken_by);
CREATE INDEX idx_approval_level_actions_due ON approval_level_actions(due_date) 
    WHERE action_status = 'pending';

-- Notifications indexes
CREATE INDEX idx_approval_notifications_request ON approval_notifications(approval_request_id);
CREATE INDEX idx_approval_notifications_recipient ON approval_notifications(recipient_id);
CREATE INDEX idx_approval_notifications_status ON approval_notifications(delivery_status);
CREATE INDEX idx_approval_notifications_type ON approval_notifications(notification_type);
CREATE INDEX idx_approval_notifications_retry ON approval_notifications(next_retry_at) 
    WHERE delivery_status = 'failed' AND retry_count < max_retries;

-- History and audit indexes
CREATE INDEX idx_approval_decision_history_request ON approval_decision_history(approval_request_id);
CREATE INDEX idx_approval_decision_history_maker ON approval_decision_history(decision_maker_id);
CREATE INDEX idx_approval_decision_history_timestamp ON approval_decision_history(timestamp DESC);
CREATE INDEX idx_approval_decision_history_type ON approval_decision_history(decision_type);

-- Metrics indexes
CREATE INDEX idx_approval_metrics_school ON approval_metrics(school_id);
CREATE INDEX idx_approval_metrics_period ON approval_metrics(metric_period, period_start);

-- Exceptions indexes
CREATE INDEX idx_approval_rule_exceptions_request ON approval_rule_exceptions(approval_request_id);
CREATE INDEX idx_approval_rule_exceptions_authorized ON approval_rule_exceptions(authorized_by);
CREATE INDEX idx_approval_rule_exceptions_type ON approval_rule_exceptions(exception_type);

-- ====================================
-- ROW LEVEL SECURITY POLICIES
-- ====================================

-- Enable RLS on all tables
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_level_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_decision_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_rule_exceptions ENABLE ROW LEVEL SECURITY;

-- Approval requests policies
CREATE POLICY approval_requests_school_isolation ON approval_requests
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = approval_requests.school_id AND is_active = true
        )
    );

-- Workflow templates policies
CREATE POLICY approval_workflow_templates_school_isolation ON approval_workflow_templates
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = approval_workflow_templates.school_id AND is_active = true
        )
    );

-- Level actions policies
CREATE POLICY approval_level_actions_school_isolation ON approval_level_actions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM approval_requests ar 
            WHERE ar.id = approval_level_actions.approval_request_id 
            AND (
                ar.school_id = current_setting('app.current_school_id')::UUID OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
                ) OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT director_id FROM director_school_access 
                    WHERE school_id = ar.school_id AND is_active = true
                )
            )
        )
    );

-- Similar policies for other tables...
CREATE POLICY approval_notifications_school_isolation ON approval_notifications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM approval_requests ar 
            WHERE ar.id = approval_notifications.approval_request_id 
            AND ar.school_id = current_setting('app.current_school_id')::UUID
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

CREATE POLICY approval_decision_history_school_isolation ON approval_decision_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM approval_requests ar 
            WHERE ar.id = approval_decision_history.approval_request_id 
            AND ar.school_id = current_setting('app.current_school_id')::UUID
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

CREATE POLICY approval_metrics_school_isolation ON approval_metrics
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = approval_metrics.school_id AND is_active = true
        )
    );

CREATE POLICY approval_rule_exceptions_school_isolation ON approval_rule_exceptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM approval_requests ar 
            WHERE ar.id = approval_rule_exceptions.approval_request_id 
            AND ar.school_id = current_setting('app.current_school_id')::UUID
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

-- ====================================
-- HELPER FUNCTIONS
-- ====================================

-- Function to determine approval workflow for a request
CREATE OR REPLACE FUNCTION determine_approval_workflow(
    p_school_id UUID,
    p_request_type VARCHAR,
    p_request_category VARCHAR,
    p_amount DECIMAL,
    p_request_data JSONB
)
RETURNS UUID AS $$
DECLARE
    template_id UUID;
    template_record RECORD;
    condition_met BOOLEAN;
BEGIN
    -- Find matching workflow template
    FOR template_record IN
        SELECT *
        FROM approval_workflow_templates
        WHERE school_id = p_school_id
          AND request_type = p_request_type
          AND (request_category IS NULL OR request_category = p_request_category)
          AND is_active = true
        ORDER BY priority_order ASC
    LOOP
        -- Check if conditions are met
        condition_met := true;
        
        -- Simple amount-based condition check
        IF template_record.condition_rules ? 'amount' THEN
            IF p_amount IS NOT NULL THEN
                IF template_record.condition_rules->'amount'->>'min_amount' IS NOT NULL THEN
                    IF p_amount < (template_record.condition_rules->'amount'->>'min_amount')::DECIMAL THEN
                        condition_met := false;
                    END IF;
                END IF;
                
                IF template_record.condition_rules->'amount'->>'max_amount' IS NOT NULL THEN
                    IF p_amount > (template_record.condition_rules->'amount'->>'max_amount')::DECIMAL THEN
                        condition_met := false;
                    END IF;
                END IF;
            END IF;
        END IF;
        
        -- Add more condition checks as needed
        
        IF condition_met THEN
            template_id := template_record.id;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create approval workflow for a request
CREATE OR REPLACE FUNCTION create_approval_workflow(
    p_approval_request_id UUID,
    p_workflow_template_id UUID
)
RETURNS JSONB AS $$
DECLARE
    template_record RECORD;
    level_config JSONB;
    level_num INTEGER;
    result JSONB;
BEGIN
    -- Get template details
    SELECT * INTO template_record
    FROM approval_workflow_templates
    WHERE id = p_workflow_template_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Template not found');
    END IF;
    
    -- Create approval levels
    FOR level_num IN 1..jsonb_array_length(template_record.approval_levels)
    LOOP
        level_config := template_record.approval_levels->level_num-1;
        
        INSERT INTO approval_level_actions (
            approval_request_id,
            approval_level,
            level_name,
            required_approver_role,
            required_approver_id,
            approver_group,
            due_date
        ) VALUES (
            p_approval_request_id,
            level_num,
            level_config->>'level_name',
            level_config->>'approver_role',
            CASE WHEN level_config->>'approver_id' != '' 
                 THEN (level_config->>'approver_id')::UUID 
                 ELSE NULL END,
            level_config->>'approver_group',
            NOW() + (COALESCE((level_config->>'sla_hours')::INTEGER, 72) || ' hours')::INTERVAL
        );
    END LOOP;
    
    -- Update approval request with workflow details
    UPDATE approval_requests
    SET workflow_template_id = p_workflow_template_id,
        total_approval_levels = jsonb_array_length(template_record.approval_levels),
        approval_path = template_record.approval_levels,
        sla_hours = template_record.default_sla_hours
    WHERE id = p_approval_request_id;
    
    result := jsonb_build_object(
        'success', true,
        'workflow_template_id', p_workflow_template_id,
        'total_levels', jsonb_array_length(template_record.approval_levels)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate approval SLA status
CREATE OR REPLACE FUNCTION update_approval_sla_status()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Update SLA status for pending approvals
    UPDATE approval_requests
    SET sla_status = CASE
        WHEN deadline IS NOT NULL AND deadline < NOW() THEN 'overdue'
        WHEN deadline IS NOT NULL AND deadline < NOW() + INTERVAL '24 hours' THEN 'at_risk'
        ELSE 'on_time'
    END,
    updated_at = NOW()
    WHERE approval_status IN ('pending', 'in_review')
      AND sla_status != CASE
        WHEN deadline IS NOT NULL AND deadline < NOW() THEN 'overdue'
        WHEN deadline IS NOT NULL AND deadline < NOW() + INTERVAL '24 hours' THEN 'at_risk'
        ELSE 'on_time'
    END;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE approval_requests IS 'Central approval system for all approval workflows';
COMMENT ON TABLE approval_workflow_templates IS 'Configurable approval workflow templates';
COMMENT ON TABLE approval_level_actions IS 'Individual approval actions at each level';
COMMENT ON TABLE approval_notifications IS 'Notification tracking for approval workflows';
COMMENT ON TABLE approval_decision_history IS 'Complete audit trail of approval decisions';
COMMENT ON TABLE approval_metrics IS 'Performance metrics and SLA tracking';
COMMENT ON TABLE approval_rule_exceptions IS 'Rule exceptions and emergency overrides';