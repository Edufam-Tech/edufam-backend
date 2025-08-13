const { pool, query, connectWithRetry } = require('../config/database');

class HealthCheckService {
  async db() {
    try {
      await connectWithRetry(2);
      const result = await query('SELECT NOW() as now');
      return { healthy: true, now: result.rows[0].now };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async summary() {
    const db = await this.db();
    return {
      db,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      node: process.version
    };
  }
}

module.exports = new HealthCheckService();


