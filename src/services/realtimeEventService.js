const { query } = require('../config/database');
const { DatabaseError, ValidationError } = require('../middleware/errorHandler');

/**
 * Real-Time Event Service
 * Handles creation, processing, and delivery of real-time events
 */
class RealtimeEventService {

  /**
   * Create a new real-time event
   */
  async createEvent(eventData) {
    try {
      const {
        eventType,
        schoolId,
        sourceUserId,
        targetUserIds,
        targetRoles,
        title,
        message,
        eventPayload,
        priority = 'normal',
        sourceEntityType,
        sourceEntityId,
        actionUrl
      } = eventData;

      // Validate required fields
      if (!eventType || !schoolId || !title || !message) {
        throw new ValidationError('Event type, school ID, title, and message are required');
      }

      // Create the event using database function
      const result = await query(`
        SELECT create_realtime_event($1, $2, $3, $4, $5, $6, $7, $8, $9) as event_id
      `, [
        eventType,
        schoolId,
        sourceUserId,
        JSON.stringify(eventPayload || {}),
        title,
        message,
        targetUserIds,
        targetRoles,
        priority
      ]);

      const eventId = result.rows[0].event_id;

      // Update additional fields if provided
      if (sourceEntityType || sourceEntityId || actionUrl) {
        await query(`
          UPDATE realtime_events 
          SET source_entity_type = $1,
              source_entity_id = $2,
              action_url = $3,
              updated_at = NOW()
          WHERE id = $4
        `, [sourceEntityType, sourceEntityId, actionUrl, eventId]);
      }

      // Process the event for delivery
      await this.processEventForDelivery(eventId);

      return eventId;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to create real-time event', error);
    }
  }

  /**
   * Process event for delivery
   */
  async processEventForDelivery(eventId) {
    try {
      // Get event details
      const eventResult = await query(`
        SELECT * FROM realtime_events WHERE id = $1
      `, [eventId]);

      if (eventResult.rows.length === 0) {
        throw new ValidationError('Event not found');
      }

      const event = eventResult.rows[0];

      // Determine target users
      const targetUsers = await this.determineTargetUsers(event);

      // Create delivery records
      if (targetUsers.length > 0) {
        await this.createDeliveryRecords(eventId, targetUsers);
        
        // Update event with recipient count
        await query(`
          UPDATE realtime_events 
          SET total_recipients = $1,
              status = 'processing',
              processed_at = NOW()
          WHERE id = $2
        `, [targetUsers.length, eventId]);

        // If WebSocket service is available, deliver immediately
        const websocketService = require('./websocketService');
        if (websocketService.io) {
          await this.deliverEventViaWebSocket(event, targetUsers);
        }
      }

      return targetUsers.length;
    } catch (error) {
      // Mark event as failed
      await query(`
        UPDATE realtime_events 
        SET status = 'failed',
            error_message = $1
        WHERE id = $2
      `, [error.message, eventId]);
      
      throw error;
    }
  }

  /**
   * Determine target users for an event
   */
  async determineTargetUsers(event) {
    try {
      let targetUsers = [];

      // If specific user IDs are provided
      if (event.target_user_ids && event.target_user_ids.length > 0) {
        const userResult = await query(`
          SELECT id, role, school_id FROM users 
          WHERE id = ANY($1) AND is_active = true
        `, [event.target_user_ids]);
        
        targetUsers = userResult.rows;
      }

      // If target roles are specified
      if (event.target_roles && event.target_roles.length > 0) {
        const roleResult = await query(`
          SELECT id, role, school_id FROM users 
          WHERE role = ANY($1) 
            AND school_id = $2 
            AND is_active = true
        `, [event.target_roles, event.school_id]);
        
        // Merge with existing targets (avoid duplicates)
        const existingIds = new Set(targetUsers.map(u => u.id));
        for (const user of roleResult.rows) {
          if (!existingIds.has(user.id)) {
            targetUsers.push(user);
          }
        }
      }

      // If no specific targets, get all active users in school
      if (targetUsers.length === 0) {
        const allUsersResult = await query(`
          SELECT id, role, school_id FROM users 
          WHERE school_id = $1 AND is_active = true
        `, [event.school_id]);
        
        targetUsers = allUsersResult.rows;
      }

      // Exclude specified users
      if (event.exclude_user_ids && event.exclude_user_ids.length > 0) {
        const excludeSet = new Set(event.exclude_user_ids);
        targetUsers = targetUsers.filter(user => !excludeSet.has(user.id));
      }

      return targetUsers;
    } catch (error) {
      throw new DatabaseError('Failed to determine target users', error);
    }
  }

  /**
   * Create delivery records for target users
   */
  async createDeliveryRecords(eventId, targetUsers) {
    try {
      if (targetUsers.length === 0) return;

      const values = targetUsers.map((user, index) => {
        const offset = index * 3;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
      }).join(', ');

      const params = targetUsers.flatMap(user => [
        eventId,
        user.id,
        'websocket' // Default delivery method
      ]);

      await query(`
        INSERT INTO realtime_event_deliveries (
          event_id,
          user_id,
          delivery_method
        ) VALUES ${values}
      `, params);
    } catch (error) {
      throw new DatabaseError('Failed to create delivery records', error);
    }
  }

  /**
   * Deliver event via WebSocket
   */
  async deliverEventViaWebSocket(event, targetUsers) {
    try {
      const websocketService = require('./websocketService');
      
      const eventData = {
        id: event.id,
        type: event.event_type,
        title: event.title,
        message: event.message,
        priority: event.priority,
        actionUrl: event.action_url,
        actionLabel: event.action_label,
        data: event.event_data,
        sourceEntityType: event.source_entity_type,
        sourceEntityId: event.source_entity_id,
        requireAcknowledgment: event.require_acknowledgment
      };

      const userIds = targetUsers.map(user => user.id);
      
      const deliveries = await websocketService.broadcastToUsers(
        userIds,
        'realtime_event',
        eventData,
        { 
          eventId: event.id,
          requireAcknowledgment: event.require_acknowledgment 
        }
      );

      // Update delivery status
      const successfulDeliveries = deliveries.filter(d => d.status === 'delivered').length;
      const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;

      await query(`
        UPDATE realtime_events 
        SET successful_deliveries = $1,
            failed_deliveries = $2,
            status = CASE 
              WHEN $1 > 0 THEN 'delivered'
              ELSE 'failed'
            END,
            first_delivered_at = CASE 
              WHEN $1 > 0 THEN NOW()
              ELSE first_delivered_at
            END
        WHERE id = $3
      `, [successfulDeliveries, failedDeliveries, event.id]);

      return deliveries;
    } catch (error) {
      console.error('Error delivering event via WebSocket:', error);
      throw error;
    }
  }

  /**
   * Get events for a user
   */
  async getUserEvents(userId, filters = {}) {
    try {
      let whereConditions = ['red.user_id = $1'];
      let queryParams = [userId];
      let paramCount = 1;

      if (filters.status) {
        paramCount++;
        whereConditions.push(`red.delivery_status = $${paramCount}`);
        queryParams.push(filters.status);
      }

      if (filters.eventType) {
        paramCount++;
        whereConditions.push(`re.event_type = $${paramCount}`);
        queryParams.push(filters.eventType);
      }

      if (filters.priority) {
        paramCount++;
        whereConditions.push(`re.priority = $${paramCount}`);
        queryParams.push(filters.priority);
      }

      if (filters.dateFrom) {
        paramCount++;
        whereConditions.push(`re.created_at >= $${paramCount}`);
        queryParams.push(filters.dateFrom);
      }

      if (filters.unreadOnly) {
        whereConditions.push(`red.read_at IS NULL`);
      }

      const limit = Math.min(filters.limit || 50, 100);
      const offset = (filters.page - 1) * limit || 0;

      const result = await query(`
        SELECT 
          re.*,
          red.delivery_status,
          red.delivered_at,
          red.read_at,
          red.acknowledged_at,
          red.user_action,
          ret.display_name as event_type_name,
          ret.icon,
          ret.color
        FROM realtime_events re
        JOIN realtime_event_deliveries red ON red.event_id = re.id
        LEFT JOIN realtime_event_types ret ON ret.event_type = re.event_type
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY re.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get user events', error);
    }
  }

  /**
   * Mark event as read
   */
  async markEventAsRead(eventId, userId) {
    try {
      const result = await query(`
        UPDATE realtime_event_deliveries
        SET delivery_status = CASE 
              WHEN delivery_status = 'delivered' THEN 'read'
              ELSE delivery_status
            END,
            read_at = CASE 
              WHEN read_at IS NULL THEN NOW()
              ELSE read_at
            END
        WHERE event_id = $1 AND user_id = $2
        RETURNING *
      `, [eventId, userId]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to mark event as read', error);
    }
  }

  /**
   * Get event statistics
   */
  async getEventStatistics(schoolId, filters = {}) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered_events,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_events,
          COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_events,
          COUNT(*) FILTER (WHERE priority = 'critical') as critical_events,
          AVG(successful_deliveries::DECIMAL / NULLIF(total_recipients, 0) * 100) as avg_delivery_rate,
          COUNT(DISTINCT event_type) as unique_event_types
        FROM realtime_events
        WHERE school_id = $1
          AND created_at >= COALESCE($2, NOW() - INTERVAL '30 days')
          AND created_at <= COALESCE($3, NOW())
      `, [schoolId, filters.dateFrom, filters.dateTo]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get event statistics', error);
    }
  }

  /**
   * Create predefined event types
   */
  async createFeeAssignmentEvent(assignmentData, targetUsers = null) {
    return await this.createEvent({
      eventType: 'fee_assignment_created',
      schoolId: assignmentData.schoolId,
      sourceUserId: assignmentData.createdBy,
      targetUserIds: targetUsers,
      targetRoles: targetUsers ? null : ['parent', 'student', 'finance_manager'],
      title: `New Fee Assignment: ${assignmentData.assignmentName}`,
      message: `A new fee assignment "${assignmentData.assignmentName}" has been created for ${assignmentData.targetDescription}`,
      eventPayload: {
        assignmentId: assignmentData.id,
        assignmentName: assignmentData.assignmentName,
        amount: assignmentData.totalAmount,
        dueDate: assignmentData.dueDate,
        curriculumType: assignmentData.curriculumType
      },
      priority: 'normal',
      sourceEntityType: 'fee_assignment',
      sourceEntityId: assignmentData.id,
      actionUrl: `/finance/fee-assignments/${assignmentData.id}`
    });
  }

  async createApprovalEvent(approvalData) {
    return await this.createEvent({
      eventType: 'approval_request_pending',
      schoolId: approvalData.schoolId,
      sourceUserId: approvalData.requestedBy,
      targetRoles: [approvalData.approverRole],
      title: `Approval Required: ${approvalData.title}`,
      message: `You have a new approval request for "${approvalData.title}" requiring your attention`,
      eventPayload: {
        approvalId: approvalData.id,
        requestType: approvalData.requestType,
        amount: approvalData.amount,
        priority: approvalData.priority
      },
      priority: approvalData.priority || 'high',
      sourceEntityType: 'approval_request',
      sourceEntityId: approvalData.id,
      actionUrl: `/approvals/${approvalData.id}`
    });
  }

  async createSchoolSwitchEvent(directorId, previousSchoolId, currentSchoolId, schoolName) {
    return await this.createEvent({
      eventType: 'school_context_switched',
      schoolId: currentSchoolId,
      sourceUserId: directorId,
      targetUserIds: [directorId],
      title: `School Context: ${schoolName}`,
      message: `You are now viewing data for ${schoolName}`,
      eventPayload: {
        previousSchoolId,
        currentSchoolId,
        schoolName
      },
      priority: 'low',
      sourceEntityType: 'school_context',
      sourceEntityId: currentSchoolId
    });
  }
}

module.exports = new RealtimeEventService();