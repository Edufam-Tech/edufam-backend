/**
 * Maintenance Mode Utility
 * 
 * Provides robust maintenance mode checking with environment override,
 * database fallback, and comprehensive error handling.
 */

const { query } = require('../config/database');

/**
 * Check maintenance mode status from environment variable or database
 * @returns {Promise<Object>} Maintenance status object
 */
async function checkMaintenanceMode() {
  // 1. Check environment variable first (highest priority)
  if (process.env.MAINTENANCE_MODE === 'true') {
    console.log('🔧 Maintenance mode: ENABLED via MAINTENANCE_MODE environment variable');
    return {
      active: true,
      message: 'System under scheduled maintenance (env override)',
      scheduled_start: null,
      scheduled_end: null,
      source: 'env'
    };
  }

  // 2. Check database for maintenance mode records
  try {
    const now = new Date();
    
    const maintenanceResult = await query(`
      SELECT 
        id,
        is_active,
        message,
        scheduled_start,
        scheduled_end
      FROM maintenance_mode 
      WHERE is_active = true
      ORDER BY scheduled_start DESC
      LIMIT 1
    `);
    
    if (maintenanceResult.rows.length > 0) {
      const record = maintenanceResult.rows[0];
      let shouldBeActive = true;
      
      // Check if maintenance should have started
      if (record.scheduled_start) {
        const startTime = new Date(record.scheduled_start);
        if (now < startTime) {
          shouldBeActive = false;
          console.log(`🔧 Maintenance mode: SCHEDULED but not yet started (starts at ${startTime.toISOString()})`);
        }
      }
      
      // Check if maintenance has expired
      if (record.scheduled_end) {
        const endTime = new Date(record.scheduled_end);
        if (now > endTime) {
          shouldBeActive = false;
          console.log(`🔧 Maintenance mode: EXPIRED (ended at ${endTime.toISOString()})`);
        }
      }
      
      if (shouldBeActive) {
        console.log('🔧 Maintenance mode: ENABLED via database record');
        console.log(`   ID: ${record.id}`);
        console.log(`   Message: ${record.message || 'System maintenance in progress'}`);
        console.log(`   Period: ${record.scheduled_start || 'Immediate'} - ${record.scheduled_end || 'Ongoing'}`);
        
        return {
          active: true,
          message: record.message || 'System maintenance in progress',
          scheduled_start: record.scheduled_start,
          scheduled_end: record.scheduled_end,
          source: 'db'
        };
      }
    }
    
    console.log('🔧 Maintenance mode: DISABLED (no active records)');
    return { 
      active: false, 
      message: null, 
      scheduled_start: null, 
      scheduled_end: null, 
      source: 'db' 
    };
    
  } catch (error) {
    console.error('⚠️  Error checking maintenance mode in database:', error.message);
    console.log('🔧 Maintenance mode: DISABLED (database query failed - using fallback)');
    
    // Fallback to inactive when database is unavailable
    return { 
      active: false, 
      message: null, 
      scheduled_start: null, 
      scheduled_end: null, 
      source: 'fallback' 
    };
  }
}

/**
 * Synchronous check for maintenance mode (for quick checks without async overhead)
 * This is a simplified version that only checks the environment variable
 * @returns {Object} Maintenance status object
 */
function isMaintenanceActive() {
  if (process.env.MAINTENANCE_MODE === 'true') {
    return {
      active: true,
      message: 'System under scheduled maintenance (env override)',
      scheduled_start: null,
      scheduled_end: null,
      source: 'env'
    };
  }
  
  return { 
    active: false, 
    message: null, 
    scheduled_start: null, 
    scheduled_end: null, 
    source: 'sync' 
  };
}

/**
 * Create a maintenance record in the database
 * @param {Object} options - Maintenance record options
 * @param {string} options.message - Maintenance message
 * @param {Date|string} options.scheduled_start - When maintenance starts (optional)
 * @param {Date|string} options.scheduled_end - When maintenance ends (optional)
 * @returns {Promise<Object>} Created maintenance record
 */
async function createMaintenanceRecord(options = {}) {
  try {
    const { message = 'System maintenance in progress', scheduled_start = null, scheduled_end = null } = options;
    
    const result = await query(`
      INSERT INTO maintenance_mode (is_active, message, scheduled_start, scheduled_end)
      VALUES (true, $1, $2, $3)
      RETURNING *
    `, [message, scheduled_start, scheduled_end]);
    
    console.log('✅ Maintenance record created:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error creating maintenance record:', error.message);
    throw error;
  }
}

/**
 * End all active maintenance records
 * @returns {Promise<number>} Number of records updated
 */
async function endMaintenance() {
  try {
    const result = await query(`
      UPDATE maintenance_mode 
      SET is_active = false 
      WHERE is_active = true
    `);
    
    console.log(`✅ Ended ${result.rowCount} maintenance record(s)`);
    return result.rowCount;
  } catch (error) {
    console.error('❌ Error ending maintenance:', error.message);
    throw error;
  }
}

/**
 * Get all maintenance records (for admin purposes)
 * @returns {Promise<Array>} Array of maintenance records
 */
async function getAllMaintenanceRecords() {
  try {
    const result = await query(`
      SELECT 
        id,
        is_active,
        message,
        scheduled_start,
        scheduled_end,
        created_at,
        updated_at
      FROM maintenance_mode 
      ORDER BY created_at DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching maintenance records:', error.message);
    throw error;
  }
}

module.exports = {
  checkMaintenanceMode,
  isMaintenanceActive,
  createMaintenanceRecord,
  endMaintenance,
  getAllMaintenanceRecords
};
