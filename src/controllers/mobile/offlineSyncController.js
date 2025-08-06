const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class OfflineSyncController {
  // =============================================================================
  // SYNC CONFIGURATION MANAGEMENT
  // =============================================================================

  // Get sync configuration for user
  static async getSyncConfiguration(req, res, next) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.userType;
      const schoolId = req.user.schoolId;

      // Get user's sync preferences
      const syncPrefs = await query(`
        SELECT * FROM sync_preferences WHERE user_id = $1
      `, [userId]);

      let preferences = {
        autoSync: true,
        syncFrequency: 15, // minutes
        wifiOnly: false,
        syncInBackground: true,
        maxOfflineDays: 7,
        compressionEnabled: true,
        conflictResolution: 'server_wins' // 'server_wins', 'client_wins', 'manual'
      };

      if (syncPrefs.rows.length > 0) {
        preferences = { ...preferences, ...JSON.parse(syncPrefs.rows[0].preferences) };
      }

      // Define sync entities based on user role
      const syncEntities = OfflineSyncController.getSyncEntitiesForRole(userRole);

      // Get last sync information
      const lastSync = await query(`
        SELECT * FROM sync_sessions 
        WHERE user_id = $1 
        ORDER BY started_at DESC 
        LIMIT 1
      `, [userId]);

      res.json({
        success: true,
        data: {
          userId,
          userRole,
          schoolId,
          preferences,
          syncEntities,
          lastSync: lastSync.rows[0] || null,
          serverTime: new Date().toISOString(),
          capabilities: {
            deltaSync: true,
            binaryDiff: true,
            encryption: true,
            compression: true,
            conflictResolution: true,
            batchSync: true
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update sync configuration
  static async updateSyncConfiguration(req, res, next) {
    try {
      const { preferences } = req.body;
      const userId = req.user.userId;

      if (!preferences) {
        throw new ValidationError('Preferences object is required');
      }

      // Validate preferences
      const validKeys = ['autoSync', 'syncFrequency', 'wifiOnly', 'syncInBackground', 'maxOfflineDays', 'compressionEnabled', 'conflictResolution'];
      const invalidKeys = Object.keys(preferences).filter(key => !validKeys.includes(key));
      
      if (invalidKeys.length > 0) {
        throw new ValidationError(`Invalid preference keys: ${invalidKeys.join(', ')}`);
      }

      // Update preferences
      await query(`
        INSERT INTO sync_preferences (user_id, preferences)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET 
          preferences = EXCLUDED.preferences,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, JSON.stringify(preferences)]);

      res.json({
        success: true,
        message: 'Sync configuration updated successfully',
        data: { preferences }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // DELTA SYNC OPERATIONS
  // =============================================================================

  // Get incremental changes since last sync
  static async getDeltaSync(req, res, next) {
    try {
      const { lastSyncToken, entities = [] } = req.query;
      const userId = req.user.userId;
      const userRole = req.user.userType;
      const schoolId = req.user.schoolId;

      if (!lastSyncToken) {
        throw new ValidationError('Last sync token is required for delta sync');
      }

      // Validate entities
      const allowedEntities = OfflineSyncController.getSyncEntitiesForRole(userRole);
      const requestedEntities = entities.length > 0 ? entities : allowedEntities.map(e => e.name);
      const invalidEntities = requestedEntities.filter(e => !allowedEntities.find(ae => ae.name === e));
      
      if (invalidEntities.length > 0) {
        throw new ValidationError(`Invalid entities for your role: ${invalidEntities.join(', ')}`);
      }

      // Parse last sync token to get timestamp
      const lastSyncTime = new Date(lastSyncToken);
      if (isNaN(lastSyncTime.getTime())) {
        throw new ValidationError('Invalid sync token format');
      }

      // Start new sync session
      const syncSession = await query(`
        INSERT INTO sync_sessions (
          user_id, sync_type, status, started_at, last_sync_token
        ) VALUES ($1, 'delta', 'in_progress', CURRENT_TIMESTAMP, $2)
        RETURNING *
      `, [userId, lastSyncToken]);

      const sessionId = syncSession.rows[0].id;

      // Get changes for each entity
      const deltaChanges = {};
      const deletions = {};
      const conflicts = [];

      for (const entityName of requestedEntities) {
        const entityConfig = allowedEntities.find(e => e.name === entityName);
        if (!entityConfig) continue;

        try {
          // Get updated/new records
          const updates = await OfflineSyncController.getEntityUpdates(
            entityName, entityConfig, lastSyncTime, userId, schoolId
          );

          // Get deleted records
          const deletes = await OfflineSyncController.getEntityDeletions(
            entityName, lastSyncTime, userId, schoolId
          );

          // Check for conflicts with pending offline changes
          const entityConflicts = await OfflineSyncController.checkEntityConflicts(
            entityName, userId, lastSyncTime
          );

          deltaChanges[entityName] = updates;
          deletions[entityName] = deletes;
          if (entityConflicts.length > 0) {
            conflicts.push(...entityConflicts);
          }

        } catch (error) {
          console.error(`Error getting delta for entity ${entityName}:`, error);
        }
      }

      // Update sync session with results
      await query(`
        UPDATE sync_sessions 
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            changes_count = $1,
            conflicts_count = $2
        WHERE id = $3
      `, [
        Object.values(deltaChanges).reduce((sum, changes) => sum + changes.length, 0),
        conflicts.length,
        sessionId
      ]);

      const newSyncToken = new Date().toISOString();

      res.json({
        success: true,
        data: {
          syncSessionId: sessionId,
          syncType: 'delta',
          lastSyncToken,
          newSyncToken,
          serverTime: newSyncToken,
          changes: deltaChanges,
          deletions,
          conflicts,
          metadata: {
            entitiesSynced: requestedEntities.length,
            totalChanges: Object.values(deltaChanges).reduce((sum, changes) => sum + changes.length, 0),
            totalDeletions: Object.values(deletions).reduce((sum, dels) => sum + dels.length, 0),
            hasConflicts: conflicts.length > 0
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // CONFLICT RESOLUTION
  // =============================================================================

  // Get pending conflicts for user
  static async getPendingConflicts(req, res, next) {
    try {
      const userId = req.user.userId;

      const conflicts = await query(`
        SELECT 
          sc.*,
          sco.operation_type,
          sco.entity_type,
          sco.entity_id,
          sco.client_data,
          sco.client_version
        FROM sync_conflicts sc
        JOIN sync_conflict_operations sco ON sc.id = sco.conflict_id
        WHERE sc.user_id = $1 AND sc.status = 'pending'
        ORDER BY sc.created_at DESC
      `, [userId]);

      const groupedConflicts = {};
      conflicts.rows.forEach(conflict => {
        if (!groupedConflicts[conflict.id]) {
          groupedConflicts[conflict.id] = {
            id: conflict.id,
            conflictType: conflict.conflict_type,
            resolution: conflict.resolution,
            createdAt: conflict.created_at,
            operations: []
          };
        }

        groupedConflicts[conflict.id].operations.push({
          operationType: conflict.operation_type,
          entityType: conflict.entity_type,
          entityId: conflict.entity_id,
          clientData: JSON.parse(conflict.client_data || '{}'),
          clientVersion: conflict.client_version,
          serverData: JSON.parse(conflict.server_data || '{}'),
          serverVersion: conflict.server_version
        });
      });

      res.json({
        success: true,
        data: {
          conflicts: Object.values(groupedConflicts),
          totalConflicts: Object.keys(groupedConflicts).length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Resolve conflict
  static async resolveConflict(req, res, next) {
    try {
      const { conflictId } = req.params;
      const { resolution, resolvedData } = req.body;
      const userId = req.user.userId;

      if (!resolution || !['client_wins', 'server_wins', 'manual'].includes(resolution)) {
        throw new ValidationError('Valid resolution (client_wins, server_wins, manual) is required');
      }

      if (resolution === 'manual' && !resolvedData) {
        throw new ValidationError('Resolved data is required for manual resolution');
      }

      // Get conflict details
      const conflict = await query(`
        SELECT * FROM sync_conflicts 
        WHERE id = $1 AND user_id = $2 AND status = 'pending'
      `, [conflictId, userId]);

      if (conflict.rows.length === 0) {
        throw new NotFoundError('Conflict not found or already resolved');
      }

      // Get conflict operations
      const operations = await query(`
        SELECT * FROM sync_conflict_operations 
        WHERE conflict_id = $1
      `, [conflictId]);

      // Apply resolution for each operation
      const resolutionResults = [];
      for (const operation of operations.rows) {
        const result = await OfflineSyncController.applyConflictResolution(
          operation, resolution, resolvedData
        );
        resolutionResults.push(result);
      }

      // Update conflict status
      await query(`
        UPDATE sync_conflicts 
        SET status = 'resolved',
            resolution = $1,
            resolved_at = CURRENT_TIMESTAMP,
            resolved_data = $2
        WHERE id = $3
      `, [resolution, JSON.stringify(resolvedData || {}), conflictId]);

      res.json({
        success: true,
        message: 'Conflict resolved successfully',
        data: {
          conflictId,
          resolution,
          operationsResolved: resolutionResults.length,
          resolvedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // BATCH SYNC OPERATIONS
  // =============================================================================

  // Upload batch of offline changes
  static async uploadBatchChanges(req, res, next) {
    try {
      const { changes, batchId, compression = false } = req.body;
      const userId = req.user.userId;

      if (!changes || !Array.isArray(changes)) {
        throw new ValidationError('Changes array is required');
      }

      if (changes.length === 0) {
        throw new ValidationError('At least one change is required');
      }

      // Decompress if needed
      let processedChanges = changes;
      if (compression) {
        processedChanges = OfflineSyncController.decompressChanges(changes);
      }

      // Create batch sync session
      const batchSession = await query(`
        INSERT INTO sync_sessions (
          user_id, sync_type, status, started_at, batch_id, changes_count
        ) VALUES ($1, 'batch_upload', 'in_progress', CURRENT_TIMESTAMP, $2, $3)
        RETURNING *
      `, [userId, batchId || `batch_${Date.now()}`, processedChanges.length]);

      const sessionId = batchSession.rows[0].id;

      // Process changes in transaction
      const results = [];
      const conflicts = [];
      const errors = [];

      try {
        await query('BEGIN');

        for (let i = 0; i < processedChanges.length; i++) {
          const change = processedChanges[i];
          
          try {
            // Validate change structure
            OfflineSyncController.validateChangeStructure(change);

            // Check for conflicts
            const conflictCheck = await OfflineSyncController.checkForConflicts(change, userId);
            
            if (conflictCheck.hasConflict) {
              conflicts.push({
                changeIndex: i,
                changeId: change.id,
                conflict: conflictCheck.conflict
              });
              continue;
            }

            // Apply change
            const result = await OfflineSyncController.applyChange(change, userId, sessionId);
            results.push({
              changeIndex: i,
              changeId: change.id,
              success: true,
              result
            });

          } catch (error) {
            errors.push({
              changeIndex: i,
              changeId: change.id,
              error: error.message
            });
          }
        }

        await query('COMMIT');

        // Update session status
        await query(`
          UPDATE sync_sessions 
          SET status = 'completed',
              completed_at = CURRENT_TIMESTAMP,
              successful_changes = $1,
              failed_changes = $2,
              conflicts_count = $3
          WHERE id = $4
        `, [results.length, errors.length, conflicts.length, sessionId]);

      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }

      res.json({
        success: true,
        message: 'Batch upload completed',
        data: {
          sessionId,
          batchId: batchSession.rows[0].batch_id,
          totalChanges: processedChanges.length,
          successfulChanges: results.length,
          failedChanges: errors.length,
          conflicts: conflicts.length,
          results,
          conflictDetails: conflicts,
          errors
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SYNC HISTORY AND ANALYTICS
  // =============================================================================

  // Get sync history
  static async getSyncHistory(req, res, next) {
    try {
      const userId = req.user.userId;
      const { limit = 20, offset = 0, syncType } = req.query;

      let whereClause = 'WHERE user_id = $1';
      const params = [userId];

      if (syncType) {
        whereClause += ` AND sync_type = $${params.length + 1}`;
        params.push(syncType);
      }

      const sessions = await query(`
        SELECT *
        FROM sync_sessions
        ${whereClause}
        ORDER BY started_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      // Get sync statistics
      const stats = await query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_sessions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sessions,
          SUM(changes_count) as total_changes,
          SUM(conflicts_count) as total_conflicts,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
        FROM sync_sessions
        WHERE user_id = $1 AND started_at >= CURRENT_DATE - INTERVAL '30 days'
      `, [userId]);

      res.json({
        success: true,
        data: {
          sessions: sessions.rows,
          statistics: stats.rows[0],
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: sessions.rows.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get sync analytics
  static async getSyncAnalytics(req, res, next) {
    try {
      const userId = req.user.userId;
      const { period = '7d' } = req.query;

      const timeInterval = period === '1d' ? '1 day' : 
                          period === '7d' ? '7 days' : 
                          period === '30d' ? '30 days' : '7 days';

      const [overview, trends, conflicts, performance] = await Promise.all([
        // Overview statistics
        query(`
          SELECT 
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_sessions,
            SUM(changes_count) as total_changes,
            SUM(successful_changes) as successful_changes,
            SUM(conflicts_count) as total_conflicts,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
          FROM sync_sessions
          WHERE user_id = $1 AND started_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
        `, [userId]),

        // Daily trends
        query(`
          SELECT 
            DATE_TRUNC('day', started_at) as date,
            COUNT(*) as sessions,
            SUM(changes_count) as changes,
            SUM(conflicts_count) as conflicts,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
          FROM sync_sessions
          WHERE user_id = $1 AND started_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY DATE_TRUNC('day', started_at)
          ORDER BY date
        `, [userId]),

        // Conflict analysis
        query(`
          SELECT 
            conflict_type,
            COUNT(*) as count
          FROM sync_conflicts
          WHERE user_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
          GROUP BY conflict_type
        `, [userId]),

        // Performance metrics by sync type
        query(`
          SELECT 
            sync_type,
            COUNT(*) as sessions,
            AVG(changes_count) as avg_changes,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration,
            MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_duration,
            MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_duration
          FROM sync_sessions
          WHERE user_id = $1 
            AND started_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
            AND status = 'completed'
          GROUP BY sync_type
        `, [userId])
      ]);

      res.json({
        success: true,
        data: {
          period,
          overview: overview.rows[0],
          trends: trends.rows,
          conflicts: conflicts.rows,
          performance: performance.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Get sync entities for user role
  static getSyncEntitiesForRole(userRole) {
    const entities = {
      principal: [
        { name: 'grade_submissions', table: 'grade_submissions', fields: ['*'] },
        { name: 'staff', table: 'users', fields: ['id', 'first_name', 'last_name', 'role'] },
        { name: 'alerts', table: 'alerts', fields: ['*'] },
        { name: 'announcements', table: 'announcements', fields: ['*'] }
      ],
      teacher: [
        { name: 'classes', table: 'classes', fields: ['*'] },
        { name: 'students', table: 'students', fields: ['*'] },
        { name: 'timetable', table: 'timetable_entries', fields: ['*'] },
        { name: 'grades', table: 'student_grades', fields: ['*'] },
        { name: 'attendance', table: 'student_attendance', fields: ['*'] }
      ],
      school_director: [
        { name: 'schools', table: 'schools', fields: ['*'] },
        { name: 'approvals', table: 'approval_requests', fields: ['*'] },
        { name: 'analytics', table: 'school_analytics', fields: ['*'] }
      ],
      parent: [
        { name: 'children', table: 'students', fields: ['*'] },
        { name: 'grades', table: 'student_grades', fields: ['*'] },
        { name: 'attendance', table: 'student_attendance', fields: ['*'] },
        { name: 'announcements', table: 'announcements', fields: ['*'] }
      ],
      student: [
        { name: 'grades', table: 'student_grades', fields: ['*'] },
        { name: 'attendance', table: 'student_attendance', fields: ['*'] },
        { name: 'timetable', table: 'timetable_entries', fields: ['*'] },
        { name: 'announcements', table: 'announcements', fields: ['*'] }
      ]
    };

    return entities[userRole] || [];
  }

  // Get entity updates since last sync
  static async getEntityUpdates(entityName, entityConfig, lastSyncTime, userId, schoolId) {
    const { table, fields } = entityConfig;
    const fieldList = fields.includes('*') ? '*' : fields.join(', ');

    // Build query based on entity type and user permissions
    let whereConditions = ['updated_at > $1 OR created_at > $1'];
    let params = [lastSyncTime];

    // Add user-specific filters
    if (table === 'students' && req.user.userType === 'parent') {
      whereConditions.push('id IN (SELECT student_id FROM parent_students WHERE parent_id = $2)');
      params.push(userId);
    } else if (table === 'timetable_entries' && req.user.userType === 'teacher') {
      whereConditions.push('teacher_id = $2');
      params.push(userId);
    } else if (schoolId) {
      whereConditions.push('school_id = $2');
      params.push(schoolId);
    }

    const result = await query(`
      SELECT ${fieldList}
      FROM ${table}
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY updated_at DESC
    `, params);

    return result.rows;
  }

  // Get entity deletions since last sync
  static async getEntityDeletions(entityName, lastSyncTime, userId, schoolId) {
    const result = await query(`
      SELECT entity_id, deleted_at
      FROM deleted_records
      WHERE entity_type = $1 
        AND deleted_at > $2
        AND (user_id = $3 OR school_id = $4)
      ORDER BY deleted_at DESC
    `, [entityName, lastSyncTime, userId, schoolId]);

    return result.rows;
  }

  // Check for conflicts with pending offline changes
  static async checkEntityConflicts(entityName, userId, lastSyncTime) {
    const conflicts = await query(`
      SELECT 
        sc.*,
        sco.entity_type,
        sco.entity_id,
        sco.operation_type
      FROM sync_conflicts sc
      JOIN sync_conflict_operations sco ON sc.id = sco.conflict_id
      WHERE sc.user_id = $1 
        AND sco.entity_type = $2
        AND sc.status = 'pending'
        AND sc.created_at > $3
    `, [userId, entityName, lastSyncTime]);

    return conflicts.rows;
  }

  // Validate change structure
  static validateChangeStructure(change) {
    const required = ['id', 'type', 'entity', 'timestamp'];
    const missing = required.filter(field => !change[field]);
    
    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!['create', 'update', 'delete'].includes(change.type)) {
      throw new ValidationError('Change type must be create, update, or delete');
    }
  }

  // Check for conflicts before applying change
  static async checkForConflicts(change, userId) {
    if (change.type === 'create') {
      return { hasConflict: false };
    }

    // Check if entity has been modified since client's version
    const current = await query(`
      SELECT updated_at, version
      FROM ${change.entity}
      WHERE id = $1
    `, [change.data.id]);

    if (current.rows.length === 0) {
      if (change.type === 'update') {
        return {
          hasConflict: true,
          conflict: {
            type: 'not_found',
            message: 'Entity no longer exists on server'
          }
        };
      }
      return { hasConflict: false };
    }

    const serverRecord = current.rows[0];
    const clientTimestamp = new Date(change.timestamp);
    const serverTimestamp = new Date(serverRecord.updated_at);

    if (serverTimestamp > clientTimestamp) {
      return {
        hasConflict: true,
        conflict: {
          type: 'timestamp_conflict',
          message: 'Server version is newer than client version',
          serverData: serverRecord,
          clientData: change.data
        }
      };
    }

    return { hasConflict: false };
  }

  // Apply change to database
  static async applyChange(change, userId, sessionId) {
    const { type, entity, data } = change;

    // Log the change
    await query(`
      INSERT INTO sync_change_log (
        session_id, change_id, change_type, entity_type, entity_id, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [sessionId, change.id, type, entity, data.id || null, userId]);

    switch (type) {
      case 'create':
        return await OfflineSyncController.applyCreate(entity, data, userId);
      case 'update':
        return await OfflineSyncController.applyUpdate(entity, data, userId);
      case 'delete':
        return await OfflineSyncController.applyDelete(entity, data, userId);
      default:
        throw new ValidationError(`Unknown change type: ${type}`);
    }
  }

  // Apply create operation
  static async applyCreate(entity, data, userId) {
    // Implementation would vary by entity type
    // This is a simplified example
    const fields = Object.keys(data).filter(key => key !== 'id');
    const values = fields.map(field => data[field]);
    const placeholders = fields.map((_, index) => `$${index + 1}`);

    const result = await query(`
      INSERT INTO ${entity} (${fields.join(', ')}, created_by)
      VALUES (${placeholders.join(', ')}, $${fields.length + 1})
      RETURNING id
    `, [...values, userId]);

    return { operation: 'create', id: result.rows[0].id };
  }

  // Apply update operation
  static async applyUpdate(entity, data, userId) {
    const { id, ...updateData } = data;
    const fields = Object.keys(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`);
    const values = fields.map(field => updateData[field]);

    await query(`
      UPDATE ${entity}
      SET ${setClause.join(', ')}, updated_by = $${fields.length + 1}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 2}
    `, [...values, userId, id]);

    return { operation: 'update', id };
  }

  // Apply delete operation
  static async applyDelete(entity, data, userId) {
    const { id } = data;

    // Soft delete by marking as inactive or moving to deleted_records
    await query(`
      INSERT INTO deleted_records (entity_type, entity_id, deleted_by, deleted_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [entity, id, userId]);

    await query(`
      UPDATE ${entity}
      SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [userId, id]);

    return { operation: 'delete', id };
  }

  // Apply conflict resolution
  static async applyConflictResolution(operation, resolution, resolvedData) {
    const { entity_type, entity_id, client_data, server_data } = operation;

    let finalData;
    switch (resolution) {
      case 'client_wins':
        finalData = JSON.parse(client_data);
        break;
      case 'server_wins':
        finalData = JSON.parse(server_data);
        break;
      case 'manual':
        finalData = resolvedData;
        break;
    }

    // Apply the resolved data
    return await OfflineSyncController.applyUpdate(entity_type, finalData, operation.user_id);
  }

  // Decompress changes (placeholder implementation)
  static decompressChanges(compressedChanges) {
    // In production, this would implement actual decompression
    // For now, assume changes are already in correct format
    return compressedChanges;
  }
}

module.exports = OfflineSyncController;