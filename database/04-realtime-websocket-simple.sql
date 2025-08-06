-- ====================================
-- REAL-TIME WEBSOCKET SYSTEM (SIMPLIFIED)
-- ====================================

-- WebSocket Connection Management
CREATE TABLE websocket_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    socket_id VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),
    platform VARCHAR(50),
    status VARCHAR(20) DEFAULT 'connected',
    connected_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    last_ping TIMESTAMP DEFAULT NOW(),
    active_school_context UUID REFERENCES schools(id),
    current_page VARCHAR(255),
    user_role VARCHAR(50),
    disconnected_at TIMESTAMP,
    disconnect_reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-Time Event Types
CREATE TABLE realtime_event_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) UNIQUE NOT NULL,
    event_category VARCHAR(30) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    priority VARCHAR(20) DEFAULT 'normal',
    delivery_methods VARCHAR(20)[] DEFAULT '{"websocket"}',
    require_acknowledgment BOOLEAN DEFAULT false,
    max_retry_attempts INTEGER DEFAULT 3,
    icon VARCHAR(50),
    color VARCHAR(20),
    title_template VARCHAR(255),
    message_template TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-Time Events
CREATE TABLE realtime_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL REFERENCES realtime_event_types(event_type),
    event_source VARCHAR(50) NOT NULL,
    source_user_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    target_user_ids UUID[],
    target_roles VARCHAR(50)[],
    exclude_user_ids UUID[],
    event_data JSONB NOT NULL,
    source_entity_type VARCHAR(50),
    source_entity_id UUID,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    action_label VARCHAR(50),
    scheduled_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'normal',
    delivery_method VARCHAR(30)[] DEFAULT '{"websocket"}',
    require_acknowledgment BOOLEAN DEFAULT false,
    max_retry_attempts INTEGER DEFAULT 3,
    retry_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP,
    first_delivered_at TIMESTAMP,
    total_recipients INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    acknowledgments_received INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Event Deliveries
CREATE TABLE realtime_event_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES realtime_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES websocket_connections(id) ON DELETE SET NULL,
    delivery_method VARCHAR(30) NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    expired_at TIMESTAMP,
    device_type VARCHAR(50),
    platform VARCHAR(50),
    user_action VARCHAR(50),
    interaction_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_id, delivery_method)
);

-- Real-Time Channels
CREATE TABLE realtime_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name VARCHAR(100) UNIQUE NOT NULL,
    channel_type VARCHAR(30) NOT NULL,
    display_name VARCHAR(150),
    description TEXT,
    school_id UUID REFERENCES schools(id),
    entity_type VARCHAR(50),
    entity_id UUID,
    is_public BOOLEAN DEFAULT false,
    requires_invitation BOOLEAN DEFAULT false,
    allowed_roles VARCHAR(50)[],
    max_subscribers INTEGER DEFAULT 1000,
    total_subscribers INTEGER DEFAULT 0,
    active_subscribers INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
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
    subscription_type VARCHAR(20) DEFAULT 'active',
    notification_level VARCHAR(20) DEFAULT 'all',
    push_notifications BOOLEAN DEFAULT true,
    last_read_at TIMESTAMP,
    unread_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- User Activity Tracking
CREATE TABLE realtime_user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    page_route VARCHAR(255),
    action_description VARCHAR(255),
    session_id VARCHAR(255),
    connection_id UUID REFERENCES websocket_connections(id) ON DELETE SET NULL,
    activity_data JSONB,
    device_type VARCHAR(50),
    platform VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- System Metrics
CREATE TABLE realtime_system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_timestamp TIMESTAMP DEFAULT NOW(),
    time_bucket VARCHAR(20) NOT NULL,
    total_connections INTEGER DEFAULT 0,
    active_connections INTEGER DEFAULT 0,
    new_connections INTEGER DEFAULT 0,
    events_created INTEGER DEFAULT 0,
    events_delivered INTEGER DEFAULT 0,
    events_failed INTEGER DEFAULT 0,
    average_latency_ms DECIMAL(10,2),
    school_id UUID REFERENCES schools(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================
-- INDEXES
-- ====================================

CREATE INDEX idx_websocket_connections_user ON websocket_connections(user_id);
CREATE INDEX idx_websocket_connections_school ON websocket_connections(school_id);
CREATE INDEX idx_websocket_connections_status ON websocket_connections(status);
CREATE INDEX idx_websocket_connections_socket_id ON websocket_connections(socket_id);

CREATE INDEX idx_realtime_events_type ON realtime_events(event_type);
CREATE INDEX idx_realtime_events_school ON realtime_events(school_id);
CREATE INDEX idx_realtime_events_status ON realtime_events(status);
CREATE INDEX idx_realtime_events_scheduled ON realtime_events(scheduled_at);

CREATE INDEX idx_realtime_event_deliveries_event ON realtime_event_deliveries(event_id);
CREATE INDEX idx_realtime_event_deliveries_user ON realtime_event_deliveries(user_id);
CREATE INDEX idx_realtime_event_deliveries_status ON realtime_event_deliveries(delivery_status);

CREATE INDEX idx_realtime_channels_school ON realtime_channels(school_id);
CREATE INDEX idx_realtime_channels_type ON realtime_channels(channel_type);

CREATE INDEX idx_realtime_user_activity_user ON realtime_user_activity(user_id);
CREATE INDEX idx_realtime_user_activity_school ON realtime_user_activity(school_id);

-- ====================================
-- ROW LEVEL SECURITY
-- ====================================

ALTER TABLE websocket_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_event_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_system_metrics ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY websocket_connections_school_isolation ON websocket_connections
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

CREATE POLICY realtime_events_school_isolation ON realtime_events
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

CREATE POLICY realtime_event_deliveries_user_access ON realtime_event_deliveries
    FOR ALL USING (
        user_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

CREATE POLICY realtime_channels_school_isolation ON realtime_channels
    FOR ALL USING (
        school_id = current_setting('app.current_school_id')::UUID OR
        is_public = true OR
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
        )
    );

-- Event types readable by all authenticated users
CREATE POLICY realtime_event_types_read_all ON realtime_event_types
    FOR SELECT USING (is_active = true);

-- ====================================
-- INITIAL DATA
-- ====================================

INSERT INTO realtime_event_types (event_type, event_category, display_name, description, priority, title_template, message_template) VALUES
('fee_assignment_created', 'financial', 'Fee Assignment Created', 'New fee assignment has been created', 'normal', 'New Fee Assignment: {assignment_name}', 'A new fee assignment has been created'),
('fee_assignment_approved', 'financial', 'Fee Assignment Approved', 'Fee assignment has been approved', 'high', 'Fee Assignment Approved', 'Fee assignment has been approved'),
('approval_request_pending', 'approval', 'Approval Pending', 'New approval request requires attention', 'high', 'Approval Required', 'You have a new approval request'),
('approval_request_approved', 'approval', 'Request Approved', 'Your request has been approved', 'normal', 'Request Approved', 'Your request has been approved'),
('approval_request_rejected', 'approval', 'Request Rejected', 'Your request has been rejected', 'high', 'Request Rejected', 'Your request has been rejected'),
('school_context_switched', 'system', 'School Context Changed', 'User switched school context', 'low', 'School Context Changed', 'School context has been switched'),
('user_login', 'system', 'User Login', 'User has logged in', 'low', 'Welcome back!', 'You have successfully logged in'),
('payment_received', 'financial', 'Payment Received', 'Payment has been received', 'normal', 'Payment Received', 'Payment has been received'),
('system_maintenance', 'system', 'System Maintenance', 'System maintenance notification', 'urgent', 'System Maintenance', 'System maintenance is scheduled');

COMMENT ON TABLE websocket_connections IS 'Active WebSocket connections with user context';
COMMENT ON TABLE realtime_event_types IS 'Configuration for different types of real-time events';
COMMENT ON TABLE realtime_events IS 'Queue of real-time events to be delivered';
COMMENT ON TABLE realtime_event_deliveries IS 'Individual delivery tracking for each user';
COMMENT ON TABLE realtime_channels IS 'Topic-based channels for group messaging';
COMMENT ON TABLE realtime_user_activity IS 'User activity tracking';