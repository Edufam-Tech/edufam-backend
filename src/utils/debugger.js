const { query } = require('../config/database');

class DebugUtils {
  // Check database schema integrity
  static async checkSchema() {
    try {
      const tables = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      console.log('📊 Database Tables:', tables.rows.map(r => r.table_name));
      
      // Check for required tables
      const requiredTables = [
        'users', 'schools', 'user_sessions', 'password_reset_tokens',
        'students', 'staff', 'file_uploads', 'audit_logs', 'maintenance_mode',
        'system_settings', 'subscription_plans', 'school_subscriptions'
      ];
      
      const existingTables = tables.rows.map(r => r.table_name);
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        console.log('❌ Missing required tables:', missingTables);
        return false;
      }
      
      console.log('✅ All required tables exist');
      return true;
    } catch (error) {
      console.error('❌ Schema check failed:', error.message);
      return false;
    }
  }

  // Check RLS policies
  static async checkRLSPolicies() {
    try {
      const policies = await query(`
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
        FROM pg_policies 
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `);
      
      console.log('🔒 RLS Policies:', policies.rows.length);
      
      if (policies.rows.length === 0) {
        console.log('⚠️  No RLS policies found - this may be a security concern');
        return false;
      }
      
      // Group policies by table
      const policiesByTable = {};
      policies.rows.forEach(policy => {
        if (!policiesByTable[policy.tablename]) {
          policiesByTable[policy.tablename] = [];
        }
        policiesByTable[policy.tablename].push(policy);
      });
      
      console.log('📋 Policies by table:');
      Object.keys(policiesByTable).forEach(table => {
        console.log(`   ${table}: ${policiesByTable[table].length} policies`);
      });
      
      return true;
    } catch (error) {
      console.error('❌ RLS policy check failed:', error.message);
      return false;
    }
  }

  // Check active sessions
  static async checkActiveSessions() {
    try {
      const sessions = await query(`
        SELECT COUNT(*) as active_sessions 
        FROM user_sessions 
        WHERE is_active = true AND expires_at > NOW()
      `);
      
      console.log('👥 Active Sessions:', sessions.rows[0].active_sessions);
      
      // Check for expired sessions
      const expiredSessions = await query(`
        SELECT COUNT(*) as expired_sessions 
        FROM user_sessions 
        WHERE expires_at < NOW() OR is_active = false
      `);
      
      console.log('⏰ Expired/Inactive Sessions:', expiredSessions.rows[0].expired_sessions);
      
      return sessions.rows[0].active_sessions;
    } catch (error) {
      console.error('❌ Session check failed:', error.message);
      return 0;
    }
  }

  // Check user statistics
  static async checkUserStatistics() {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE user_type = 'school_user') as school_users,
          COUNT(*) FILTER (WHERE user_type = 'admin_user') as admin_users,
          COUNT(*) FILTER (WHERE activation_status = 'active') as active_users,
          COUNT(*) FILTER (WHERE activation_status = 'pending') as pending_users,
          COUNT(*) FILTER (WHERE activation_status = 'suspended') as suspended_users,
          COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as active_last_week,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_users_month
        FROM users
      `);
      
      const userStats = stats.rows[0];
      console.log('👥 User Statistics:');
      console.log(`   Total Users: ${userStats.total_users}`);
      console.log(`   School Users: ${userStats.school_users}`);
      console.log(`   Admin Users: ${userStats.admin_users}`);
      console.log(`   Active Users: ${userStats.active_users}`);
      console.log(`   Pending Users: ${userStats.pending_users}`);
      console.log(`   Suspended Users: ${userStats.suspended_users}`);
      console.log(`   Active Last Week: ${userStats.active_last_week}`);
      console.log(`   New Users This Month: ${userStats.new_users_month}`);
      
      return userStats;
    } catch (error) {
      console.error('❌ User statistics check failed:', error.message);
      return null;
    }
  }

  // Check database indexes
  static async checkIndexes() {
    try {
      const indexes = await query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);
      
      console.log('📈 Database Indexes:', indexes.rows.length);
      
      // Check for critical indexes
      const criticalIndexes = [
        'idx_users_email',
        'idx_users_type_role',
        'idx_sessions_user_active',
        'idx_sessions_token',
        'idx_password_reset_token'
      ];
      
      const existingIndexes = indexes.rows.map(idx => idx.indexname);
      const missingIndexes = criticalIndexes.filter(idx => !existingIndexes.includes(idx));
      
      if (missingIndexes.length > 0) {
        console.log('⚠️  Missing critical indexes:', missingIndexes);
        return false;
      }
      
      console.log('✅ All critical indexes exist');
      return true;
    } catch (error) {
      console.error('❌ Index check failed:', error.message);
      return false;
    }
  }

  // Check system settings
  static async checkSystemSettings() {
    try {
      const settings = await query(`
        SELECT setting_key, setting_value, data_type, is_public
        FROM system_settings
        ORDER BY setting_key
      `);
      
      console.log('⚙️  System Settings:', settings.rows.length);
      
      settings.rows.forEach(setting => {
        console.log(`   ${setting.setting_key}: ${setting.setting_value} (${setting.data_type})`);
      });
      
      return settings.rows;
    } catch (error) {
      console.error('❌ System settings check failed:', error.message);
      return [];
    }
  }

  // Check maintenance mode status
  static async checkMaintenanceMode() {
    try {
      const maintenance = await query(`
        SELECT scope, is_active, message, scheduled_start, scheduled_end
        FROM maintenance_mode
        WHERE is_active = true
        ORDER BY created_at DESC
      `);
      
      if (maintenance.rows.length > 0) {
        console.log('🔧 Active Maintenance Mode:');
        maintenance.rows.forEach(mode => {
          console.log(`   Scope: ${mode.scope}`);
          console.log(`   Message: ${mode.message}`);
          console.log(`   Scheduled: ${mode.scheduled_start} to ${mode.scheduled_end}`);
        });
        return true;
      } else {
        console.log('✅ No active maintenance mode');
        return false;
      }
    } catch (error) {
      console.error('❌ Maintenance mode check failed:', error.message);
      return false;
    }
  }

  // Check file uploads
  static async checkFileUploads() {
    try {
      const files = await query(`
        SELECT 
          COUNT(*) as total_files,
          COUNT(*) FILTER (WHERE file_type = 'profile_picture') as profile_pictures,
          COUNT(*) FILTER (WHERE file_type = 'document') as documents,
          SUM(file_size) as total_size_bytes
        FROM file_uploads
      `);
      
      const fileStats = files.rows[0];
      const totalSizeMB = Math.round((fileStats.total_size_bytes || 0) / (1024 * 1024));
      
      console.log('📁 File Upload Statistics:');
      console.log(`   Total Files: ${fileStats.total_files}`);
      console.log(`   Profile Pictures: ${fileStats.profile_pictures}`);
      console.log(`   Documents: ${fileStats.documents}`);
      console.log(`   Total Size: ${totalSizeMB} MB`);
      
      return fileStats;
    } catch (error) {
      console.error('❌ File upload check failed:', error.message);
      return null;
    }
  }

  // Check audit logs
  static async checkAuditLogs() {
    try {
      const logs = await query(`
        SELECT 
          COUNT(*) as total_logs,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as logs_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as logs_7d,
          COUNT(DISTINCT user_id) as unique_users_logged
        FROM audit_logs
      `);
      
      const logStats = logs.rows[0];
      console.log('📝 Audit Log Statistics:');
      console.log(`   Total Logs: ${logStats.total_logs}`);
      console.log(`   Last 24 Hours: ${logStats.logs_24h}`);
      console.log(`   Last 7 Days: ${logStats.logs_7d}`);
      console.log(`   Unique Users Logged: ${logStats.unique_users_logged}`);
      
      return logStats;
    } catch (error) {
      console.error('❌ Audit log check failed:', error.message);
      return null;
    }
  }

  // Check database performance
  static async checkDatabasePerformance() {
    try {
      // Check for slow queries (if pg_stat_statements is available)
      // First check if the extension exists
      const extensionCheck = await query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as extension_exists
      `);
      
      let slowQueries = { rows: [] };
      
      if (extensionCheck.rows[0].extension_exists) {
        slowQueries = await query(`
          SELECT 
            query,
            calls,
            total_exec_time as total_time,
            mean_exec_time as mean_time,
            rows
          FROM pg_stat_statements 
          WHERE mean_exec_time > 100
          ORDER BY mean_exec_time DESC
          LIMIT 5
        `).catch(() => ({ rows: [] }));
      }
      
      if (slowQueries.rows.length > 0) {
        console.log('🐌 Slow Queries Detected:');
        slowQueries.rows.forEach((query, index) => {
          console.log(`   ${index + 1}. Mean time: ${query.mean_time}ms, Calls: ${query.calls}`);
        });
      } else {
        console.log('✅ No slow queries detected');
      }
      
      // Check connection pool status
      const poolStatus = await query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      const pool = poolStatus.rows[0];
      console.log('🔌 Connection Pool Status:');
      console.log(`   Total Connections: ${pool.total_connections}`);
      console.log(`   Active Connections: ${pool.active_connections}`);
      console.log(`   Idle Connections: ${pool.idle_connections}`);
      
      return { slowQueries: slowQueries.rows, poolStatus: pool };
    } catch (error) {
      console.error('❌ Performance check failed:', error.message);
      return null;
    }
  }

  // Comprehensive system health check
  static async systemHealth() {
    console.log('🏥 Running Comprehensive System Health Check...\n');
    
    const results = {
      schema: await this.checkSchema(),
      rlsPolicies: await this.checkRLSPolicies(),
      indexes: await this.checkIndexes(),
      activeSessions: await this.checkActiveSessions(),
      userStats: await this.checkUserStatistics(),
      systemSettings: await this.checkSystemSettings(),
      maintenanceMode: await this.checkMaintenanceMode(),
      fileUploads: await this.checkFileUploads(),
      auditLogs: await this.checkAuditLogs(),
      performance: await this.checkDatabasePerformance()
    };
    
    console.log('\n📊 Health Check Summary:');
    console.log(`   Schema Integrity: ${results.schema ? '✅' : '❌'}`);
    console.log(`   RLS Policies: ${results.rlsPolicies ? '✅' : '❌'}`);
    console.log(`   Database Indexes: ${results.indexes ? '✅' : '❌'}`);
    console.log(`   Active Sessions: ${results.activeSessions}`);
    console.log(`   Maintenance Mode: ${results.maintenanceMode ? '🔧' : '✅'}`);
    
    const criticalIssues = [
      !results.schema && 'Database schema issues',
      !results.rlsPolicies && 'Missing RLS policies',
      !results.indexes && 'Missing critical indexes'
    ].filter(Boolean);
    
    if (criticalIssues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES DETECTED:');
      criticalIssues.forEach(issue => console.log(`   - ${issue}`));
      return false;
    }
    
    console.log('\n✅ System Health Check Complete - All critical systems operational');
    return true;
  }

  // Generate detailed health report
  static async generateHealthReport() {
    const report = {
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    try {
      report.checks.schema = await this.checkSchema();
      report.checks.rlsPolicies = await this.checkRLSPolicies();
      report.checks.indexes = await this.checkIndexes();
      report.checks.activeSessions = await this.checkActiveSessions();
      report.checks.userStats = await this.checkUserStatistics();
      report.checks.systemSettings = await this.checkSystemSettings();
      report.checks.maintenanceMode = await this.checkMaintenanceMode();
      report.checks.fileUploads = await this.checkFileUploads();
      report.checks.auditLogs = await this.checkAuditLogs();
      report.checks.performance = await this.checkDatabasePerformance();
      
      return report;
    } catch (error) {
      console.error('❌ Health report generation failed:', error.message);
      return null;
    }
  }
}

module.exports = DebugUtils; 