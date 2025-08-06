-- ====================================
-- REAL-TIME WEBSOCKET SYSTEM
-- ====================================
-- This module handles WebSocket connections, real-time events,
-- and live notifications across the platform

-- WebSocket Connection Management
CREATE TABLE websocket_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(255) UNIQUE NOT NULL, -- Socket.io connection ID
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Connection Details
    socket_id VARCHAR(255) UNIQUE NOT NULL, -- Internal socket identifier
    session_id VARCHAR(255), -- User session ID
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50), -- mobile, desktop, tablet
    platform VARCHAR(50), -- ios, android, web, windows, mac
    
    -- Connection State
    status VARCHAR(20) DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'idle', 'reconnecting')),
    connected_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    last_ping TIMESTAMP DEFAULT NOW(),
    ping_interval INTEGER DEFAULT 30, -- seconds
    
    -- User Context
    active_school_context UUID REFERENCES schools(id), -- For multi-school directors
    current_page VARCHAR(255), -- Current page/route
    user_role VARCHAR(50), -- Cached user role for quick filtering
    permissions TEXT[], -- Cached permissions for event filtering
    
    -- Connection Quality
    latency_ms INTEGER, -- Last measured latency
    connection_quality VARCHAR(20) DEFAULT 'good' CHECK (connection_quality IN ('poor', 'fair', 'good', 'excellent')),
    packet_loss_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Metadata
    timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    locale VARCHAR(10) DEFAULT 'en-KE',
    
    -- Cleanup
    disconnected_at TIMESTAMP,
    disconnect_reason VARCHAR(100), -- client_disconnect, server_disconnect, timeout, error
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-Time Event Types and Templates
CREATE TABLE realtime_event_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) UNIQUE NOT NULL, -- fee_assignment_created, approval_pending, etc.
    event_category VARCHAR(30) NOT NULL, -- financial, academic, approval, system, notification
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Event Configuration
    is_active BOOLEAN DEFAULT true,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
    persistence_level VARCHAR(20) DEFAULT 'session' CHECK (persistence_level IN ('none', 'session', 'short', 'long', 'permanent')),
    
    -- Delivery Configuration
    delivery_methods VARCHAR(20)[] DEFAULT '{"websocket"}', -- websocket, push, sms, email
    require_acknowledgment BOOLEAN DEFAULT false,
    max_retry_attempts INTEGER DEFAULT 3,
    retry_interval_seconds INTEGER DEFAULT 30,
    
    -- Targeting Rules
    default_audience JSONB, -- Default targeting rules
    permission_required VARCHAR(100), -- Permission needed to receive this event
    role_restrictions VARCHAR(50)[], -- Roles that can receive this event
    
    -- Display Configuration
    icon VARCHAR(50), -- Icon for UI display
    color VARCHAR(20), -- Color theme for UI
    sound VARCHAR(50), -- Sound notification
    display_duration_seconds INTEGER DEFAULT 5,
    
    -- Template
    title_template VARCHAR(255), -- "New {type} from {user}"
    message_template TEXT, -- "You have a new {type} requiring your attention"
    action_url_template VARCHAR(255), -- "/approvals/{id}"
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-Time Events Queue
CREATE TABLE realtime_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL REFERENCES realtime_event_types(event_type),
    event_source VARCHAR(50) NOT NULL, -- system, user, webhook, scheduled
    source_user_id UUID REFERENCES users(id), -- Who triggered this event
    
    -- Event Identity
    correlation_id UUID, -- Link related events
    parent_event_id UUID REFERENCES realtime_events(id), -- For event chains
    sequence_number INTEGER DEFAULT 1, -- For ordered events
    
    -- Targeting
    school_id UUID REFERENCES schools(id),
    target_user_ids UUID[], -- Specific users to notify
    target_roles VARCHAR(50)[], -- Roles to notify
    target_classes UUID[], -- Specific classes
    target_schools UUID[], -- For multi-school events
    exclude_user_ids UUID[], -- Users to exclude
    
    -- Event Data
    event_data JSONB NOT NULL, -- Event payload
    source_entity_type VARCHAR(50), -- fee_assignment, approval_request, etc.
    source_entity_id UUID, -- ID of the source entity
    
    -- Message Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500), -- URL for user action
    action_label VARCHAR(50), -- "View Details", "Approve", etc.
    
    -- Scheduling
    scheduled_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- When this event expires
    timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    
    -- Priority and Classification
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
    urgency_level INTEGER DEFAULT 5 CHECK (urgency_level >= 1 AND urgency_level <= 10),
    business_impact VARCHAR(20) DEFAULT 'medium' CHECK (business_impact IN ('low', 'medium', 'high', 'critical')),
    
    -- Delivery Control
    delivery_method VARCHAR(30)[] DEFAULT '{"websocket"}',
    require_acknowledgment BOOLEAN DEFAULT false,
    max_retry_attempts INTEGER DEFAULT 3,
    retry_count INTEGER DEFAULT 0,
    
    -- Status Tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'expired', 'cancelled')),
    processed_at TIMESTAMP,
    first_delivered_at TIMESTAMP,
    last_retry_at TIMESTAMP,
    
    -- Delivery Statistics
    total_recipients INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    acknowledgments_received INTEGER DEFAULT 0,
    
    -- Error Handling
    error_message TEXT,
    error_details JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual Event Deliveries
CREATE TABLE realtime_event_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES realtime_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES websocket_connections(id) ON DELETE SET NULL,
    
    -- Delivery Details
    delivery_method VARCHAR(30) NOT NULL, -- websocket, push, sms, email
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN (
        'pending', 'sent', 'delivered', 'read', 'acknowledged', 'failed', 'expired'
    )),
    
    -- Timing
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP, -- When user opened/viewed
    acknowledged_at TIMESTAMP, -- When user clicked/acknowledged
    expired_at TIMESTAMP,
    
    -- Delivery Context
    device_type VARCHAR(50),
    platform VARCHAR(50),
    app_version VARCHAR(20),
    
    -- User Interaction
    user_action VARCHAR(50), -- clicked, dismissed, ignored, acted_upon
    interaction_data JSONB, -- Additional interaction details
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    retry_attempts INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(event_id, user_id, delivery_method)
);

-- Real-Time Channels (Topic-based messaging)
CREATE TABLE realtime_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name VARCHAR(100) UNIQUE NOT NULL, -- school:{id}, class:{id}, role:finance, global
    channel_type VARCHAR(30) NOT NULL CHECK (channel_type IN ('school', 'class', 'role', 'user', 'global', 'system')),
    display_name VARCHAR(150),
    description TEXT,
    
    -- Channel Scope
    school_id UUID REFERENCES schools(id), -- NULL for global channels
    entity_type VARCHAR(50), -- class, department, grade, subject
    entity_id UUID, -- Specific entity this channel relates to
    
    -- Access Control
    is_public BOOLEAN DEFAULT false,
    requires_invitation BOOLEAN DEFAULT false,
    allowed_roles VARCHAR(50)[],
    allowed_users UUID[],
    moderator_roles VARCHAR(50)[] DEFAULT '{"principal", "school_director"}',
    
    -- Channel Configuration
    max_subscribers INTEGER DEFAULT 1000,
    message_retention_hours INTEGER DEFAULT 24,
    allow_file_sharing BOOLEAN DEFAULT true,
    allow_voice_messages BOOLEAN DEFAULT false,
    moderation_enabled BOOLEAN DEFAULT true,
    
    -- Activity Tracking
    total_subscribers INTEGER DEFAULT 0,
    active_subscribers INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP,
    archived_by UUID REFERENCES users(id),
    
    -- Metadata
    metadata JSONB, -- Additional channel-specific data
    created_by UUID NOT NULL REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Channel Subscriptions
CREATE TABLE realtime_channel_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES realtime_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES websocket_connections(id) ON DELETE CASCADE,
    
    -- Subscription Details
    subscription_type VARCHAR(20) DEFAULT 'active' CHECK (subscription_type IN ('active', 'muted', 'blocked')),
    notification_level VARCHAR(20) DEFAULT 'all' CHECK (notification_level IN ('none', 'mentions', 'important', 'all')),
    
    -- Preferences
    push_notifications BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT false,
    sms_notifications BOOLEAN DEFAULT false,
    
    -- Activity
    last_read_at TIMESTAMP,
    unread_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(channel_id, user_id)
);

-- Live Activity Tracking
CREATE TABLE realtime_user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Activity Details
    activity_type VARCHAR(50) NOT NULL, -- page_view, button_click, form_submit, etc.
    page_route VARCHAR(255),
    action_description VARCHAR(255),
    
    -- Context
    session_id VARCHAR(255),
    connection_id UUID REFERENCES websocket_connections(id) ON DELETE SET NULL,
    browser_session_id VARCHAR(255),
    
    -- Activity Data
    activity_data JSONB,
    duration_seconds INTEGER, -- Time spent on activity
    
    -- Device Context
    device_type VARCHAR(50),
    platform VARCHAR(50),
    screen_resolution VARCHAR(20),
    
    -- Performance Metrics
    page_load_time_ms INTEGER,
    response_time_ms INTEGER,
    
    -- Geolocation (if available)
    country VARCHAR(100),
    city VARCHAR(100),
    timezone VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Real-Time System Metrics
CREATE TABLE realtime_system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Time Period
    metric_timestamp TIMESTAMP DEFAULT NOW(),
    time_bucket VARCHAR(20) NOT NULL, -- minute, hour, day
    
    -- Connection Metrics
    total_connections INTEGER DEFAULT 0,
    active_connections INTEGER DEFAULT 0,
    new_connections INTEGER DEFAULT 0,
    disconnected_connections INTEGER DEFAULT 0,
    
    -- Event Metrics
    events_created INTEGER DEFAULT 0,
    events_delivered INTEGER DEFAULT 0,
    events_failed INTEGER DEFAULT 0,
    average_delivery_time_ms DECIMAL(10,2),
    
    -- Performance Metrics
    average_latency_ms DECIMAL(10,2),
    peak_concurrent_users INTEGER DEFAULT 0,
    peak_events_per_minute INTEGER DEFAULT 0,
    
    -- Channel Metrics
    active_channels INTEGER DEFAULT 0,
    total_channel_messages INTEGER DEFAULT 0,
    
    -- School-specific metrics
    school_id UUID REFERENCES schools(id),
    school_active_users INTEGER DEFAULT 0,
    school_events_sent INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(metric_timestamp, time_bucket, school_id)
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- WebSocket connections indexes
CREATE INDEX idx_websocket_connections_user ON websocket_connections(user_id);
CREATE INDEX idx_websocket_connections_school ON websocket_connections(school_id);
CREATE INDEX idx_websocket_connections_status ON websocket_connections(status) WHERE status = 'connected';
CREATE INDEX idx_websocket_connections_active ON websocket_connections(last_activity DESC) WHERE status = 'connected';
CREATE INDEX idx_websocket_connections_socket_id ON websocket_connections(socket_id);

-- Real-time events indexes
CREATE INDEX idx_realtime_events_type ON realtime_events(event_type);
CREATE INDEX idx_realtime_events_school ON realtime_events(school_id);
CREATE INDEX idx_realtime_events_status ON realtime_events(status);
CREATE INDEX idx_realtime_events_scheduled ON realtime_events(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_realtime_events_priority ON realtime_events(priority, created_at DESC);
CREATE INDEX idx_realtime_events_source_entity ON realtime_events(source_entity_type, source_entity_id);

-- Event deliveries indexes
CREATE INDEX idx_realtime_event_deliveries_event ON realtime_event_deliveries(event_id);
CREATE INDEX idx_realtime_event_deliveries_user ON realtime_event_deliveries(user_id);
CREATE INDEX idx_realtime_event_deliveries_status ON realtime_event_deliveries(delivery_status);
CREATE INDEX idx_realtime_event_deliveries_pending ON realtime_event_deliveries(next_retry_at) 
    WHERE delivery_status = 'failed' AND retry_count < retry_attempts;

-- Channels and subscriptions indexes
CREATE INDEX idx_realtime_channels_school ON realtime_channels(school_id);
CREATE INDEX idx_realtime_channels_type ON realtime_channels(channel_type);
CREATE INDEX idx_realtime_channels_active ON realtime_channels(is_active) WHERE is_active = true;
CREATE INDEX idx_realtime_channel_subscriptions_channel ON realtime_channel_subscriptions(channel_id);
CREATE INDEX idx_realtime_channel_subscriptions_user ON realtime_channel_subscriptions(user_id);
CREATE INDEX idx_realtime_channel_subscriptions_active ON realtime_channel_subscriptions(is_active) WHERE is_active = true;

-- Activity tracking indexes
CREATE INDEX idx_realtime_user_activity_user ON realtime_user_activity(user_id);
CREATE INDEX idx_realtime_user_activity_school ON realtime_user_activity(school_id);
CREATE INDEX idx_realtime_user_activity_type ON realtime_user_activity(activity_type);
CREATE INDEX idx_realtime_user_activity_time ON realtime_user_activity(created_at DESC);

-- Metrics indexes
CREATE INDEX idx_realtime_system_metrics_time ON realtime_system_metrics(metric_timestamp DESC);
CREATE INDEX idx_realtime_system_metrics_bucket ON realtime_system_metrics(time_bucket, metric_timestamp DESC);
CREATE INDEX idx_realtime_system_metrics_school ON realtime_system_metrics(school_id, metric_timestamp DESC);

-- ====================================
-- ROW LEVEL SECURITY POLICIES
-- ====================================

-- Enable RLS on all tables
ALTER TABLE websocket_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_event_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_system_metrics ENABLE ROW LEVEL SECURITY;

-- WebSocket connections policies
CREATE POLICY websocket_connections_school_isolation ON websocket_connections
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = websocket_connections.school_id AND is_active = true
        )
    );

-- Real-time events policies
CREATE POLICY realtime_events_school_isolation ON realtime_events
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = realtime_events.school_id AND is_active = true
        )
    );

-- Event deliveries policies  
CREATE POLICY realtime_event_deliveries_user_access ON realtime_event_deliveries
    FOR ALL USING (
        user_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        EXISTS (
            SELECT 1 FROM realtime_events re 
            WHERE re.id = realtime_event_deliveries.event_id 
            AND (
                re.school_id = current_setting('app.current_school_id')::UUID OR
                current_setting('app.current_user_id')::UUID IN (
                    SELECT director_id FROM director_school_access 
                    WHERE school_id = re.school_id AND is_active = true
                )
            )
        )
    );

-- Similar policies for other tables...
CREATE POLICY realtime_channels_school_isolation ON realtime_channels
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        is_public = true OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = realtime_channels.school_id AND is_active = true
        )
    );

CREATE POLICY realtime_channel_subscriptions_user_access ON realtime_channel_subscriptions
    FOR ALL USING (
        user_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

CREATE POLICY realtime_user_activity_school_isolation ON realtime_user_activity
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        user_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = realtime_user_activity.school_id AND is_active = true
        )
    );

CREATE POLICY realtime_system_metrics_school_isolation ON realtime_system_metrics
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        school_id IS NULL OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        ) OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT director_id FROM director_school_access 
            WHERE school_id = realtime_system_metrics.school_id AND is_active = true
        )
    );

-- Event types policy (readable by all authenticated users)
CREATE POLICY realtime_event_types_read_all ON realtime_event_types
    FOR SELECT USING (is_active = true);

-- ====================================
-- HELPER FUNCTIONS
-- ====================================

-- Function to create real-time event
CREATE OR REPLACE FUNCTION create_realtime_event(
    p_event_type VARCHAR,
    p_school_id UUID,
    p_source_user_id UUID,
    p_event_data JSONB,
    p_title VARCHAR,
    p_message TEXT,
    p_target_user_ids UUID[] DEFAULT NULL,
    p_target_roles VARCHAR[] DEFAULT NULL,
    p_priority VARCHAR DEFAULT 'normal'
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
    event_type_config RECORD;
BEGIN
    -- Get event type configuration
    SELECT * INTO event_type_config
    FROM realtime_event_types
    WHERE event_type = p_event_type AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event type % not found or inactive', p_event_type;
    END IF;
    
    -- Create the event
    INSERT INTO realtime_events (
        event_type,
        event_source,
        source_user_id,
        school_id,
        target_user_ids,
        target_roles,
        event_data,
        title,
        message,
        priority,
        delivery_method,
        require_acknowledgment,
        max_retry_attempts
    ) VALUES (
        p_event_type,
        'system',
        p_source_user_id,
        p_school_id,
        p_target_user_ids,
        p_target_roles,
        p_event_data,
        p_title,
        p_message,
        p_priority,
        event_type_config.delivery_methods,
        event_type_config.require_acknowledgment,
        event_type_config.max_retry_attempts
    ) RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to track user activity
CREATE OR REPLACE FUNCTION track_user_activity(
    p_user_id UUID,
    p_school_id UUID,
    p_activity_type VARCHAR,
    p_page_route VARCHAR DEFAULT NULL,
    p_activity_data JSONB DEFAULT NULL,
    p_connection_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO realtime_user_activity (
        user_id,
        school_id,
        activity_type,
        page_route,
        activity_data,
        connection_id
    ) VALUES (
        p_user_id,
        p_school_id,
        p_activity_type,
        p_page_route,
        p_activity_data,
        p_connection_id
    );
    
    -- Update last activity for connection
    IF p_connection_id IS NOT NULL THEN
        UPDATE websocket_connections
        SET last_activity = NOW(),
            current_page = p_page_route,
            updated_at = NOW()
        WHERE id = p_connection_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old connections
CREATE OR REPLACE FUNCTION cleanup_stale_connections()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Mark connections as disconnected if no activity for 5 minutes
    UPDATE websocket_connections
    SET status = 'disconnected',
        disconnected_at = NOW(),
        disconnect_reason = 'timeout',
        updated_at = NOW()
    WHERE status = 'connected'
      AND last_activity < NOW() - INTERVAL '5 minutes';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Delete very old disconnected connections (older than 24 hours)
    DELETE FROM websocket_connections
    WHERE status = 'disconnected'
      AND disconnected_at < NOW() - INTERVAL '24 hours';
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- INITIAL DATA
-- ====================================

-- Insert default event types
INSERT INTO realtime_event_types (event_type, event_category, display_name, description, priority, title_template, message_template) VALUES
('fee_assignment_created', 'financial', 'Fee Assignment Created', 'New fee assignment has been created', 'normal', 'New Fee Assignment: {assignment_name}', 'A new fee assignment "{assignment_name}" has been created for {target_description}'),
('fee_assignment_approved', 'financial', 'Fee Assignment Approved', 'Fee assignment has been approved', 'high', 'Fee Assignment Approved', 'Fee assignment "{assignment_name}" has been approved and is now active'),
('approval_request_pending', 'approval', 'Approval Pending', 'New approval request requires attention', 'high', 'Approval Required: {request_title}', 'You have a new approval request for {request_title} requiring your attention'),
('approval_request_approved', 'approval', 'Request Approved', 'Your request has been approved', 'normal', 'Request Approved', 'Your request "{request_title}" has been approved'),
('approval_request_rejected', 'approval', 'Request Rejected', 'Your request has been rejected', 'high', 'Request Rejected', 'Your request "{request_title}" has been rejected: {rejection_reason}'),
('school_context_switched', 'system', 'School Context Changed', 'User switched to different school context', 'low', 'School Context: {school_name}', 'You are now viewing data for {school_name}'),
('user_login', 'system', 'User Login', 'User has logged into the system', 'low', 'Welcome back!', 'You have successfully logged into the system'),
('payment_received', 'financial', 'Payment Received', 'Payment has been received for fees', 'normal', 'Payment Received', 'Payment of {amount} has been received for {student_name}'),
('assignment_overdue', 'academic', 'Assignment Overdue', 'Student assignment is overdue', 'high', 'Assignment Overdue', 'Assignment "{assignment_title}" is overdue for {student_name}'),
('system_maintenance', 'system', 'System Maintenance', 'System maintenance notification', 'urgent', 'System Maintenance', 'System maintenance is scheduled for {maintenance_time}');

COMMENT ON TABLE websocket_connections IS 'Active WebSocket connections with user context and quality metrics';
COMMENT ON TABLE realtime_event_types IS 'Configuration and templates for different types of real-time events';
COMMENT ON TABLE realtime_events IS 'Queue of real-time events to be delivered to users';
COMMENT ON TABLE realtime_event_deliveries IS 'Individual delivery tracking for each user and event';
COMMENT ON TABLE realtime_channels IS 'Topic-based channels for group messaging and notifications';
COMMENT ON TABLE realtime_channel_subscriptions IS 'User subscriptions to real-time channels';
COMMENT ON TABLE realtime_user_activity IS 'Tracking of user activities and interactions';
COMMENT ON TABLE realtime_system_metrics IS 'Performance and usage metrics for the real-time system';