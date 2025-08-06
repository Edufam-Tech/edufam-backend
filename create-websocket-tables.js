const { Pool } = require('pg');

/**
 * Create WebSocket Tables Directly
 */

async function createWebSocketTables() {
  console.log('🚀 Creating WebSocket Tables Directly');
  console.log('===================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables one by one
    console.log('\n📄 Creating WebSocket tables...');

    // 1. WebSocket Connections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS websocket_connections (
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
      )
    `);
    console.log('   ✅ websocket_connections table created');

    // 2. Event Types
    await pool.query(`
      CREATE TABLE IF NOT EXISTS realtime_event_types (
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
      )
    `);
    console.log('   ✅ realtime_event_types table created');

    // 3. Events
    await pool.query(`
      CREATE TABLE IF NOT EXISTS realtime_events (
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
      )
    `);
    console.log('   ✅ realtime_events table created');

    // 4. Event Deliveries
    await pool.query(`
      CREATE TABLE IF NOT EXISTS realtime_event_deliveries (
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
      )
    `);
    console.log('   ✅ realtime_event_deliveries table created');

    // 5. Channels
    await pool.query(`
      CREATE TABLE IF NOT EXISTS realtime_channels (
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
      )
    `);
    console.log('   ✅ realtime_channels table created');

    // 6. Channel Subscriptions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS realtime_channel_subscriptions (
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
      )
    `);
    console.log('   ✅ realtime_channel_subscriptions table created');

    // 7. User Activity
    await pool.query(`
      CREATE TABLE IF NOT EXISTS realtime_user_activity (
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
      )
    `);
    console.log('   ✅ realtime_user_activity table created');

    // 8. System Metrics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS realtime_system_metrics (
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
      )
    `);
    console.log('   ✅ realtime_system_metrics table created');

    // Create indexes
    console.log('\n📄 Creating indexes...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_websocket_connections_user ON websocket_connections(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_websocket_connections_school ON websocket_connections(school_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_websocket_connections_status ON websocket_connections(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_realtime_events_type ON realtime_events(event_type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_realtime_events_school ON realtime_events(school_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_realtime_events_status ON realtime_events(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_realtime_event_deliveries_event ON realtime_event_deliveries(event_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_realtime_event_deliveries_user ON realtime_event_deliveries(user_id)`);
    console.log('   ✅ Indexes created');

    // Insert initial event types
    console.log('\n📄 Inserting initial event types...');
    await pool.query(`
      INSERT INTO realtime_event_types (event_type, event_category, display_name, description, priority, title_template, message_template) 
      VALUES 
      ('fee_assignment_created', 'financial', 'Fee Assignment Created', 'New fee assignment has been created', 'normal', 'New Fee Assignment', 'A new fee assignment has been created'),
      ('approval_request_pending', 'approval', 'Approval Pending', 'New approval request requires attention', 'high', 'Approval Required', 'You have a new approval request'),
      ('user_login', 'system', 'User Login', 'User has logged in', 'low', 'Welcome back!', 'You have successfully logged in'),
      ('system_test', 'system', 'System Test', 'Test notification', 'normal', 'Test Notification', 'This is a test notification')
      ON CONFLICT (event_type) DO NOTHING
    `);
    console.log('   ✅ Initial event types inserted');

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'realtime_%' OR table_name = 'websocket_connections'
      ORDER BY table_name
    `);

    console.log('📋 Created Tables:');
    validation.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    console.log('\n🎉 WebSocket Tables Created Successfully!');
    console.log('\n📚 Ready for Real-Time Features:');
    console.log('   • WebSocket Connection Management');
    console.log('   • Real-Time Event Broadcasting');
    console.log('   • Live Notifications & Alerts');
    console.log('   • User Activity Tracking');

  } catch (error) {
    console.error('❌ Error creating WebSocket tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createWebSocketTables();