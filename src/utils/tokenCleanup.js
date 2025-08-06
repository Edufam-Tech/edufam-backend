const authService = require('../services/authService');
const { query } = require('../config/database');

class TokenCleanup {
  constructor() {
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  // Start automated cleanup process
  start() {
    if (this.isRunning) {
      console.log('🧹 Token cleanup already running');
      return;
    }

    this.isRunning = true;
    console.log('🧹 Starting automated token cleanup...');

    // Run cleanup immediately
    this.runCleanup();

    // Schedule cleanup every 6 hours
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, 6 * 60 * 60 * 1000); // 6 hours

    console.log('✅ Token cleanup scheduled every 6 hours');
  }

  // Stop automated cleanup
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.isRunning = false;
    console.log('🛑 Token cleanup stopped');
  }

  // Run cleanup process
  async runCleanup() {
    try {
      console.log('🧹 Running token cleanup...');
      
      const startTime = Date.now();
      
      // Cleanup expired refresh tokens
      const expiredTokens = await authService.cleanupExpiredTokens();
      
      // Cleanup expired password reset tokens
      const expiredResetTokens = await authService.cleanupExpiredResetTokens();
      
      // Cleanup old audit logs (keep 90 days)
      const auditCleanup = await this.cleanupOldAuditLogs();
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ Token cleanup completed in ${duration}ms:`);
      console.log(`   🗑️  Expired sessions: ${expiredTokens}`);
      console.log(`   🗑️  Expired reset tokens: ${expiredResetTokens}`);
      console.log(`   🗑️  Old audit logs: ${auditCleanup}`);
      
      // Log cleanup activity
      await query(`
        INSERT INTO audit_logs (user_id, action, table_name, new_values)
        VALUES (NULL, 'TOKEN_CLEANUP', 'system', $1)
      `, [JSON.stringify({
        expiredTokens,
        expiredResetTokens,
        auditCleanup,
        duration
      })]);
      
    } catch (error) {
      console.error('❌ Token cleanup failed:', error);
      
      // Log cleanup failure
      try {
        await query(`
          INSERT INTO audit_logs (user_id, action, table_name, new_values)
          VALUES (NULL, 'TOKEN_CLEANUP_FAILED', 'system', $1)
        `, [JSON.stringify({ error: error.message })]);
      } catch (logError) {
        console.error('Failed to log cleanup failure:', logError);
      }
    }
  }

  // Cleanup old audit logs (keep 90 days)
  async cleanupOldAuditLogs() {
    try {
      const result = await query(`
        DELETE FROM audit_logs 
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);
      
      return result.rowCount;
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
      return 0;
    }
  }

  // Manual cleanup trigger
  async manualCleanup() {
    console.log('🧹 Running manual token cleanup...');
    await this.runCleanup();
  }

  // Get cleanup statistics
  async getCleanupStats() {
    try {
      const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM user_sessions WHERE is_active = true AND expires_at > NOW()) as active_sessions,
          (SELECT COUNT(*) FROM user_sessions WHERE is_active = false OR expires_at <= NOW()) as expired_sessions,
          (SELECT COUNT(*) FROM password_reset_tokens WHERE used = false AND expires_at > NOW()) as active_reset_tokens,
          (SELECT COUNT(*) FROM password_reset_tokens WHERE used = true OR expires_at <= NOW()) as expired_reset_tokens,
          (SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '90 days') as recent_audit_logs,
          (SELECT COUNT(*) FROM audit_logs WHERE created_at <= NOW() - INTERVAL '90 days') as old_audit_logs
      `);
      
      return stats.rows[0];
    } catch (error) {
      console.error('Failed to get cleanup stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const tokenCleanup = new TokenCleanup();

// Graceful shutdown
process.on('SIGINT', () => {
  tokenCleanup.stop();
});

process.on('SIGTERM', () => {
  tokenCleanup.stop();
});

module.exports = tokenCleanup; 