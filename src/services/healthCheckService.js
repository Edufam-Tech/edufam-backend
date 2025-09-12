const { sessionPool, query, connectWithRetry, testConnection } = require('../config/database');

class HealthCheckService {
  async db() {
    try {
      await connectWithRetry(2);
      const result = await query('SELECT NOW() as now, ssl_is_used() as ssl_used, version() as pg_version');
      return { 
        healthy: true, 
        now: result.rows[0].now,
        ssl_used: result.rows[0].ssl_used,
        pg_version: result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        error_code: error.code,
        ssl_issue: error.code === 'SELF_SIGNED_CERT_IN_CHAIN' || error.message.includes('SSL')
      };
    }
  }

  async ssl() {
    try {
      const result = await query('SELECT ssl_is_used() as ssl_used, current_setting(\'ssl\') as ssl_setting');
      return { 
        healthy: true, 
        ssl_used: result.rows[0].ssl_used,
        ssl_setting: result.rows[0].ssl_setting
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        error_code: error.code,
        ssl_issue: error.code === 'SELF_SIGNED_CERT_IN_CHAIN' || error.message.includes('SSL')
      };
    }
  }

  async summary() {
    const db = await this.db();
    const ssl = await this.ssl();
    return {
      db,
      ssl,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      node: process.version
    };
  }
}

module.exports = new HealthCheckService();


