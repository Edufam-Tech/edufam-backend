const { query } = require('../config/database');
const { DatabaseError } = require('../middleware/errorHandler');

class TokenCleanupService {
  constructor() {
    this.isRunning = false;
    this.cleanupInterval = null;
    this.cleanupIntervalMs = parseInt(process.env.TOKEN_CLEANUP_INTERVAL_MS || '3600000', 10); // 1 hour default
    this.batchSize = parseInt(process.env.TOKEN_CLEANUP_BATCH_SIZE || '1000', 10);
  }

  // Start the cleanup service
  start() {
    if (this.isRunning) {
      console.log('⚠️  Token cleanup service is already running');
      return;
    }

    console.log('🧹 Starting token cleanup service...');
    console.log(`   Cleanup interval: ${this.cleanupIntervalMs / 1000}s`);
    console.log(`   Batch size: ${this.batchSize}`);

    this.isRunning = true;
    
    // Run cleanup immediately on start
    this.runCleanup();
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.cleanupIntervalMs);

    console.log('✅ Token cleanup service started');
  }

  // Stop the cleanup service
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Token cleanup service is not running');
      return;
    }

    console.log('🛑 Stopping token cleanup service...');
    
    this.isRunning = false;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log('✅ Token cleanup service stopped');
  }

  // Run cleanup process
  async runCleanup() {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🧹 Running token cleanup...');
      
      const startTime = Date.now();
      let totalDeleted = 0;
      let batchCount = 0;

      // Clean up expired tokens in batches
      while (true) {
        const deleted = await this.cleanupExpiredTokens();
        totalDeleted += deleted;
        batchCount++;

        // If we deleted fewer tokens than the batch size, we're done
        if (deleted < this.batchSize) {
          break;
        }

        // Add a small delay between batches to avoid overwhelming the database
        await this.sleep(100);
      }

      const duration = Date.now() - startTime;
      
      if (totalDeleted > 0) {
        console.log(`✅ Token cleanup completed: ${totalDeleted} tokens deleted in ${batchCount} batches (${duration}ms)`);
      } else {
        console.log(`✅ Token cleanup completed: No expired tokens found (${duration}ms)`);
      }

      // Log cleanup statistics
      await this.logCleanupStats(totalDeleted, batchCount, duration);

    } catch (error) {
      console.error('💥 Token cleanup failed:', error.message);
      
      // Log the error
      try {
        await this.logCleanupError(error);
      } catch (logError) {
        console.error('💥 Failed to log cleanup error:', logError.message);
      }
    }
  }

  // Clean up expired tokens (batch operation)
  async cleanupExpiredTokens() {
    try {
      const result = await query(`
        DELETE FROM refresh_tokens 
        WHERE expires_at < NOW() 
           OR revoked = TRUE
        AND id IN (
          SELECT id FROM refresh_tokens 
          WHERE expires_at < NOW() 
             OR revoked = TRUE
          LIMIT $1
        )
      `, [this.batchSize]);

      return result.rowCount || 0;
    } catch (error) {
      throw new DatabaseError(`Failed to cleanup expired tokens: ${error.message}`);
    }
  }

  // Get cleanup statistics
  async getCleanupStats() {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_tokens,
          COUNT(CASE WHEN revoked = TRUE THEN 1 END) as revoked_tokens,
          COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_tokens,
          COUNT(CASE WHEN revoked = FALSE AND expires_at > NOW() THEN 1 END) as active_tokens
        FROM refresh_tokens
      `);

      return stats.rows[0];
    } catch (error) {
      throw new DatabaseError(`Failed to get cleanup stats: ${error.message}`);
    }
  }

  // Log cleanup statistics
  async logCleanupStats(deletedCount, batchCount, duration) {
    try {
      // Only log if we have an audit_logs table
      await query(`
        INSERT INTO audit_logs (
          table_name,
          operation,
          details,
          created_at
        ) VALUES (
          'refresh_tokens',
          'CLEANUP_STATS',
          $1,
          NOW()
        )
      `, [JSON.stringify({
        deleted_count: deletedCount,
        batch_count: batchCount,
        duration_ms: duration,
        cleanup_time: new Date().toISOString()
      })]);

    } catch (error) {
      // If audit_logs table doesn't exist, just log to console
      if (!error.message.includes('relation "audit_logs" does not exist')) {
        throw error;
      }
    }
  }

  // Log cleanup errors
  async logCleanupError(error) {
    try {
      // Only log if we have an audit_logs table
      await query(`
        INSERT INTO audit_logs (
          table_name,
          operation,
          details,
          created_at
        ) VALUES (
          'refresh_tokens',
          'CLEANUP_ERROR',
          $1,
          NOW()
        )
      `, [JSON.stringify({
        error_message: error.message,
        error_stack: error.stack,
        cleanup_time: new Date().toISOString()
      })]);

    } catch (logError) {
      // If audit_logs table doesn't exist, just log to console
      if (!logError.message.includes('relation "audit_logs" does not exist')) {
        throw logError;
      }
    }
  }

  // Manual cleanup (for testing or on-demand cleanup)
  async manualCleanup() {
    console.log('🧹 Running manual token cleanup...');
    
    const startTime = Date.now();
    const deleted = await this.cleanupExpiredTokens();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Manual cleanup completed: ${deleted} tokens deleted (${duration}ms)`);
    
    return {
      deletedCount: deleted,
      duration: duration
    };
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      cleanupIntervalMs: this.cleanupIntervalMs,
      batchSize: this.batchSize,
      nextCleanup: this.cleanupInterval ? 
        new Date(Date.now() + this.cleanupIntervalMs).toISOString() : null
    };
  }

  // Utility function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const tokenCleanupService = new TokenCleanupService();

module.exports = tokenCleanupService;
