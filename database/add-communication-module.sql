-- Communication Module Database Schema
-- This file contains all tables and indexes for the communication module

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Messages table (for direct messaging)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message details
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'message' CHECK (type IN ('message', 'notification', 'alert', 'reminder')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Scheduling
    scheduled_for TIMESTAMP,
    is_urgent BOOLEAN DEFAULT false,
    
    -- Threading
    thread_id UUID,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message recipients table
CREATE TABLE message_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Recipient details
    recipient_type VARCHAR(20) DEFAULT 'user' CHECK (recipient_type IN ('user', 'group', 'role')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'bounced')),
    
    -- Tracking
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_message_recipient UNIQUE (message_id, recipient_id)
);

-- Message threads table
CREATE TABLE message_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Thread details
    title VARCHAR(255),
    type VARCHAR(20) DEFAULT 'group' CHECK (type IN ('direct', 'group', 'broadcast')),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Thread participants table
CREATE TABLE thread_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Participation details
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    
    CONSTRAINT unique_thread_participant UNIQUE (thread_id, user_id)
);

-- Announcements table (for school-wide announcements)
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Announcement details
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    target_audience VARCHAR(20) DEFAULT 'all' CHECK (target_audience IN ('all', 'students', 'parents', 'teachers', 'staff')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Visibility
    is_urgent BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table (for system notifications)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Notification details
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'general' CHECK (type IN ('general', 'academic', 'financial', 'attendance', 'announcement', 'reminder')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Action
    action_url VARCHAR(500),
    action_label VARCHAR(50),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification recipients table
CREATE TABLE notification_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_notification_recipient UNIQUE (notification_id, recipient_id)
);

-- Communication templates table
CREATE TABLE communication_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Template details
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'notification', 'announcement')),
    subject VARCHAR(255),
    content TEXT NOT NULL,
    
    -- Variables for templating
    variables JSONB DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_template_name UNIQUE (school_id, name)
);

-- Scheduled communications table
CREATE TABLE scheduled_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Communication details
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'notification', 'reminder')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    recipients JSONB NOT NULL, -- Array of recipient IDs
    
    -- Scheduling
    scheduled_for TIMESTAMP NOT NULL,
    frequency VARCHAR(20) CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly')),
    frequency_data JSONB, -- Additional frequency configuration
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'completed', 'failed', 'cancelled')),
    last_sent_at TIMESTAMP,
    next_send_at TIMESTAMP,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communication logs table (for tracking all outbound communications)
CREATE TABLE communication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Communication details
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'push', 'call')),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    content TEXT,
    
    -- Tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    external_id VARCHAR(100), -- ID from external service
    error_message TEXT,
    
    -- Cost tracking
    cost DECIMAL(8,4),
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- References
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communication settings table
CREATE TABLE communication_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Notification preferences
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    push_notifications BOOLEAN DEFAULT true,
    
    -- Automation settings
    auto_reminders BOOLEAN DEFAULT true,
    reminder_frequency VARCHAR(20) DEFAULT 'daily' CHECK (reminder_frequency IN ('daily', 'weekly', 'monthly')),
    
    -- Integration settings
    email_provider VARCHAR(50),
    email_settings JSONB,
    sms_provider VARCHAR(50),
    sms_settings JSONB,
    push_provider VARCHAR(50),
    push_settings JSONB,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_communication_settings UNIQUE (school_id)
);

-- Parent communication preferences table
CREATE TABLE parent_communication_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Preferences
    preferred_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_method IN ('email', 'sms', 'push', 'call')),
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    
    -- Communication topics
    academic_updates BOOLEAN DEFAULT true,
    attendance_alerts BOOLEAN DEFAULT true,
    financial_reminders BOOLEAN DEFAULT true,
    event_notifications BOOLEAN DEFAULT true,
    emergency_alerts BOOLEAN DEFAULT true,
    
    -- Frequency settings
    digest_frequency VARCHAR(20) DEFAULT 'weekly' CHECK (digest_frequency IN ('immediate', 'daily', 'weekly', 'monthly')),
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_parent_student_preferences UNIQUE (parent_id, student_id)
);

-- Communication groups table
CREATE TABLE communication_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Group details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'custom' CHECK (type IN ('class', 'department', 'role', 'custom')),
    
    -- Visibility
    is_public BOOLEAN DEFAULT false,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_school_group_name UNIQUE (school_id, name)
);

-- Communication group members table
CREATE TABLE communication_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES communication_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Membership details
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

-- Update messages table to support threading
ALTER TABLE messages ADD COLUMN thread_id UUID REFERENCES message_threads(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_messages_school ON messages(school_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_scheduled_for ON messages(scheduled_for);

CREATE INDEX idx_message_recipients_message ON message_recipients(message_id);
CREATE INDEX idx_message_recipients_recipient ON message_recipients(recipient_id);
CREATE INDEX idx_message_recipients_status ON message_recipients(status);
CREATE INDEX idx_message_recipients_read_at ON message_recipients(read_at);

CREATE INDEX idx_announcements_school ON announcements(school_id);
CREATE INDEX idx_announcements_target_audience ON announcements(target_audience);
CREATE INDEX idx_announcements_created_at ON announcements(created_at);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);

CREATE INDEX idx_notifications_school ON notifications(school_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE INDEX idx_notification_recipients_notification ON notification_recipients(notification_id);
CREATE INDEX idx_notification_recipients_recipient ON notification_recipients(recipient_id);
CREATE INDEX idx_notification_recipients_read_at ON notification_recipients(read_at);

CREATE INDEX idx_communication_logs_school ON communication_logs(school_id);
CREATE INDEX idx_communication_logs_type ON communication_logs(type);
CREATE INDEX idx_communication_logs_status ON communication_logs(status);
CREATE INDEX idx_communication_logs_created_at ON communication_logs(created_at);
CREATE INDEX idx_communication_logs_student ON communication_logs(student_id);

CREATE INDEX idx_scheduled_communications_school ON scheduled_communications(school_id);
CREATE INDEX idx_scheduled_communications_status ON scheduled_communications(status);
CREATE INDEX idx_scheduled_communications_scheduled_for ON scheduled_communications(scheduled_for);
CREATE INDEX idx_scheduled_communications_next_send_at ON scheduled_communications(next_send_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_threads_updated_at BEFORE UPDATE ON message_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communication_templates_updated_at BEFORE UPDATE ON communication_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_communications_updated_at BEFORE UPDATE ON scheduled_communications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communication_settings_updated_at BEFORE UPDATE ON communication_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parent_communication_preferences_updated_at BEFORE UPDATE ON parent_communication_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communication_groups_updated_at BEFORE UPDATE ON communication_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_group_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for school-based access
CREATE POLICY communication_school_policy ON messages FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON message_recipients FOR ALL USING (
    message_id IN (
        SELECT m.id FROM messages m
        JOIN schools s ON m.school_id = s.id
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON message_threads FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON announcements FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON notifications FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON communication_templates FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON scheduled_communications FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON communication_logs FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON communication_settings FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY communication_school_policy ON communication_groups FOR ALL USING (
    school_id IN (
        SELECT s.id FROM schools s
        JOIN users u ON s.id = u.school_id
        WHERE u.id = auth.uid()
    )
);

-- Add comments for documentation
COMMENT ON TABLE messages IS 'Direct messages between users';
COMMENT ON TABLE message_recipients IS 'Recipients of messages with delivery tracking';
COMMENT ON TABLE message_threads IS 'Message threads for group conversations';
COMMENT ON TABLE thread_participants IS 'Participants in message threads';
COMMENT ON TABLE announcements IS 'School-wide announcements';
COMMENT ON TABLE notifications IS 'System notifications to users';
COMMENT ON TABLE notification_recipients IS 'Recipients of notifications with read tracking';
COMMENT ON TABLE communication_templates IS 'Reusable communication templates';
COMMENT ON TABLE scheduled_communications IS 'Scheduled communications and reminders';
COMMENT ON TABLE communication_logs IS 'Log of all outbound communications';
COMMENT ON TABLE communication_settings IS 'School communication preferences and settings';
COMMENT ON TABLE parent_communication_preferences IS 'Parent communication preferences per student';
COMMENT ON TABLE communication_groups IS 'Custom communication groups';
COMMENT ON TABLE communication_group_members IS 'Members of communication groups';