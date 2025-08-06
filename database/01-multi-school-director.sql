-- ====================================
-- MULTI-SCHOOL DIRECTOR MANAGEMENT
-- ====================================
-- This module enables school directors to manage multiple schools
-- with secure context switching and cross-school analytics

-- Multi-School Director Access Control
CREATE TABLE director_school_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    access_level VARCHAR(20) DEFAULT 'full' CHECK (access_level IN ('full', 'read_only', 'financial_only', 'academic_only')),
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP, -- Optional expiration
    access_reason TEXT, -- Why this access was granted
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(director_id, school_id)
);

-- School Context Sessions (Track active contexts)
CREATE TABLE director_active_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active_school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    session_token VARCHAR(255), -- Current session token
    previous_school_id UUID REFERENCES schools(id), -- For audit trail
    last_switched_at TIMESTAMP DEFAULT NOW(),
    switch_reason TEXT, -- Optional reason for switching
    ip_address INET, -- Security tracking
    user_agent TEXT, -- Security tracking
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(director_id)
);

-- Cross-School Analytics Cache
CREATE TABLE cross_school_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analytics_type VARCHAR(50) NOT NULL, -- portfolio_summary, performance_comparison, financial_overview
    school_ids UUID[] NOT NULL, -- Array of school IDs included
    data JSONB NOT NULL, -- Cached analytics data
    parameters JSONB, -- Parameters used to generate analytics
    
    -- Cache management
    generated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    cache_version VARCHAR(20) DEFAULT '1.0',
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- School Switching Audit Trail
CREATE TABLE school_switch_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL REFERENCES users(id),
    from_school_id UUID REFERENCES schools(id),
    to_school_id UUID NOT NULL REFERENCES schools(id),
    switch_timestamp TIMESTAMP DEFAULT NOW(),
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    switch_reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Director Favorite Schools (Quick access)
CREATE TABLE director_favorite_schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 1,
    added_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(director_id, school_id)
);

-- Cross-School Notifications (For directors managing multiple schools)
CREATE TABLE cross_school_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- urgent_approval, critical_alert, summary_report
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Metadata
    source_module VARCHAR(50), -- Which module generated this notification
    source_id UUID, -- ID of the source record
    data JSONB, -- Additional notification data
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Director school access indexes
CREATE INDEX idx_director_school_access_director ON director_school_access(director_id) WHERE is_active = true;
CREATE INDEX idx_director_school_access_school ON director_school_access(school_id) WHERE is_active = true;
CREATE INDEX idx_director_school_access_active ON director_school_access(director_id, is_active);

-- Active contexts indexes
CREATE INDEX idx_director_active_contexts_director ON director_active_contexts(director_id);
CREATE INDEX idx_director_active_contexts_school ON director_active_contexts(active_school_id);

-- Analytics cache indexes
CREATE INDEX idx_cross_school_analytics_director ON cross_school_analytics(director_id);
CREATE INDEX idx_cross_school_analytics_type ON cross_school_analytics(analytics_type);
CREATE INDEX idx_cross_school_analytics_expires ON cross_school_analytics(expires_at);

-- Switch audit indexes
CREATE INDEX idx_school_switch_audit_director ON school_switch_audit(director_id);
CREATE INDEX idx_school_switch_audit_timestamp ON school_switch_audit(switch_timestamp DESC);

-- Notifications indexes
CREATE INDEX idx_cross_school_notifications_director ON cross_school_notifications(director_id);
CREATE INDEX idx_cross_school_notifications_unread ON cross_school_notifications(director_id, is_read) WHERE is_read = false;
CREATE INDEX idx_cross_school_notifications_priority ON cross_school_notifications(priority, created_at DESC);

-- ====================================
-- ROW LEVEL SECURITY POLICIES
-- ====================================

-- Enable RLS on all tables
ALTER TABLE director_school_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE director_active_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_school_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_switch_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE director_favorite_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_school_notifications ENABLE ROW LEVEL SECURITY;

-- Director school access policies
CREATE POLICY director_school_access_policy ON director_school_access
    FOR ALL USING (
        director_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

-- Active contexts policies
CREATE POLICY director_active_contexts_policy ON director_active_contexts
    FOR ALL USING (
        director_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

-- Analytics cache policies
CREATE POLICY cross_school_analytics_policy ON cross_school_analytics
    FOR ALL USING (
        director_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

-- Switch audit policies
CREATE POLICY school_switch_audit_policy ON school_switch_audit
    FOR ALL USING (
        director_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

-- Favorite schools policies
CREATE POLICY director_favorite_schools_policy ON director_favorite_schools
    FOR ALL USING (
        director_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

-- Notifications policies
CREATE POLICY cross_school_notifications_policy ON cross_school_notifications
    FOR ALL USING (
        director_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.current_user_id')::UUID IN (
            SELECT id FROM users WHERE role IN ('super_admin', 'edufam_admin')
        )
    );

-- ====================================
-- HELPER FUNCTIONS
-- ====================================

-- Function to check if user is a multi-school director
CREATE OR REPLACE FUNCTION is_multi_school_director(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM director_school_access 
        WHERE director_id = user_id AND is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get director's accessible schools
CREATE OR REPLACE FUNCTION get_director_schools(director_user_id UUID)
RETURNS TABLE (
    school_id UUID,
    school_name VARCHAR,
    access_level VARCHAR,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        dsa.access_level,
        dsa.is_active
    FROM director_school_access dsa
    JOIN schools s ON s.id = dsa.school_id
    WHERE dsa.director_id = director_user_id
        AND dsa.is_active = true
        AND (dsa.expires_at IS NULL OR dsa.expires_at > NOW())
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- Function to validate director school access
CREATE OR REPLACE FUNCTION validate_director_school_access(
    director_user_id UUID,
    target_school_id UUID,
    required_access_level VARCHAR DEFAULT 'read_only'
)
RETURNS BOOLEAN AS $$
DECLARE
    user_access VARCHAR;
BEGIN
    SELECT access_level INTO user_access
    FROM director_school_access
    WHERE director_id = director_user_id
        AND school_id = target_school_id
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW());
    
    IF user_access IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check access level hierarchy: full > financial_only/academic_only > read_only
    CASE required_access_level
        WHEN 'read_only' THEN
            RETURN TRUE; -- All access levels include read access
        WHEN 'financial_only' THEN
            RETURN user_access IN ('full', 'financial_only');
        WHEN 'academic_only' THEN
            RETURN user_access IN ('full', 'academic_only');
        WHEN 'full' THEN
            RETURN user_access = 'full';
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to log school context switch
CREATE OR REPLACE FUNCTION log_school_switch(
    director_user_id UUID,
    from_school UUID,
    to_school UUID,
    session_token VARCHAR,
    client_ip INET,
    client_user_agent TEXT,
    reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    -- Insert audit record
    INSERT INTO school_switch_audit (
        director_id,
        from_school_id,
        to_school_id,
        session_id,
        ip_address,
        user_agent,
        switch_reason
    ) VALUES (
        director_user_id,
        from_school,
        to_school,
        session_token,
        client_ip,
        client_user_agent,
        reason
    ) RETURNING id INTO audit_id;
    
    -- Update or create active context
    INSERT INTO director_active_contexts (
        director_id,
        active_school_id,
        session_token,
        previous_school_id,
        switch_reason,
        ip_address,
        user_agent
    ) VALUES (
        director_user_id,
        to_school,
        session_token,
        from_school,
        reason,
        client_ip,
        client_user_agent
    )
    ON CONFLICT (director_id) DO UPDATE SET
        active_school_id = EXCLUDED.active_school_id,
        session_token = EXCLUDED.session_token,
        previous_school_id = EXCLUDED.previous_school_id,
        last_switched_at = NOW(),
        switch_reason = EXCLUDED.switch_reason,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        updated_at = NOW();
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- SAMPLE DATA (Optional - for testing)
-- ====================================

-- Grant super admin access to all existing schools (if any)
-- INSERT INTO director_school_access (director_id, school_id, access_level, granted_by)
-- SELECT 
--     u.id as director_id,
--     s.id as school_id,
--     'full' as access_level,
--     u.id as granted_by
-- FROM users u
-- CROSS JOIN schools s
-- WHERE u.role = 'super_admin'
-- ON CONFLICT (director_id, school_id) DO NOTHING;

COMMENT ON TABLE director_school_access IS 'Controls which schools each director can access and their permission level';
COMMENT ON TABLE director_active_contexts IS 'Tracks the currently active school context for each director';
COMMENT ON TABLE cross_school_analytics IS 'Caches cross-school analytics data for performance';
COMMENT ON TABLE school_switch_audit IS 'Audit trail of school context switches for security';
COMMENT ON TABLE director_favorite_schools IS 'Directors can mark schools as favorites for quick access';
COMMENT ON TABLE cross_school_notifications IS 'Notifications that span multiple schools for directors';