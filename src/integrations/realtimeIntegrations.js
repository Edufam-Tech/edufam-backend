const realtimeEventService = require('../services/realtimeEventService');

/**
 * Real-Time Integrations
 * Hooks real-time events into existing modules
 */
class RealtimeIntegrations {

  /**
   * Initialize integrations with existing services
   */
  static initialize() {
    console.log('🔗 Initializing real-time integrations...');
    
    // Integration points will be added here
    // For now, we'll create helper methods that other services can call
  }

  /**
   * Fee Assignment Events
   */
  static async onFeeAssignmentCreated(assignmentData) {
    try {
      await realtimeEventService.createFeeAssignmentEvent(assignmentData);
    } catch (error) {
      console.error('Error creating fee assignment event:', error);
    }
  }

  static async onFeeAssignmentApproved(assignmentData) {
    try {
      await realtimeEventService.createEvent({
        eventType: 'fee_assignment_approved',
        schoolId: assignmentData.schoolId,
        sourceUserId: assignmentData.approvedBy,
        targetUserIds: [assignmentData.createdBy],
        title: 'Fee Assignment Approved',
        message: `Fee assignment "${assignmentData.assignmentName}" has been approved and is now active`,
        eventPayload: {
          assignmentId: assignmentData.id,
          assignmentName: assignmentData.assignmentName,
          approvedBy: assignmentData.approvedByName,
          approvedAt: assignmentData.approvedAt
        },
        priority: 'high',
        sourceEntityType: 'fee_assignment',
        sourceEntityId: assignmentData.id,
        actionUrl: `/finance/fee-assignments/${assignmentData.id}`
      });
    } catch (error) {
      console.error('Error creating fee assignment approved event:', error);
    }
  }

  static async onFeeAssignmentRejected(assignmentData) {
    try {
      await realtimeEventService.createEvent({
        eventType: 'fee_assignment_rejected',
        schoolId: assignmentData.schoolId,
        sourceUserId: assignmentData.rejectedBy,
        targetUserIds: [assignmentData.createdBy],
        title: 'Fee Assignment Rejected',
        message: `Fee assignment "${assignmentData.assignmentName}" has been rejected: ${assignmentData.rejectionReason}`,
        eventPayload: {
          assignmentId: assignmentData.id,
          assignmentName: assignmentData.assignmentName,
          rejectedBy: assignmentData.rejectedByName,
          rejectionReason: assignmentData.rejectionReason
        },
        priority: 'high',
        sourceEntityType: 'fee_assignment',
        sourceEntityId: assignmentData.id,
        actionUrl: `/finance/fee-assignments/${assignmentData.id}`
      });
    } catch (error) {
      console.error('Error creating fee assignment rejected event:', error);
    }
  }

  /**
   * Approval Events
   */
  static async onApprovalRequestCreated(approvalData) {
    try {
      await realtimeEventService.createApprovalEvent(approvalData);
    } catch (error) {
      console.error('Error creating approval request event:', error);
    }
  }

  static async onApprovalRequestApproved(approvalData) {
    try {
      await realtimeEventService.createEvent({
        eventType: 'approval_request_approved',
        schoolId: approvalData.schoolId,
        sourceUserId: approvalData.approvedBy,
        targetUserIds: [approvalData.requestedBy],
        title: 'Request Approved',
        message: `Your request "${approvalData.title}" has been approved`,
        eventPayload: {
          approvalId: approvalData.id,
          requestType: approvalData.requestType,
          approvedBy: approvalData.approvedByName,
          approvalComments: approvalData.approvalComments
        },
        priority: 'normal',
        sourceEntityType: 'approval_request',
        sourceEntityId: approvalData.id,
        actionUrl: `/approvals/${approvalData.id}`
      });
    } catch (error) {
      console.error('Error creating approval approved event:', error);
    }
  }

  static async onApprovalRequestRejected(approvalData) {
    try {
      await realtimeEventService.createEvent({
        eventType: 'approval_request_rejected',
        schoolId: approvalData.schoolId,
        sourceUserId: approvalData.rejectedBy,
        targetUserIds: [approvalData.requestedBy],
        title: 'Request Rejected',
        message: `Your request "${approvalData.title}" has been rejected: ${approvalData.rejectionReason}`,
        eventPayload: {
          approvalId: approvalData.id,
          requestType: approvalData.requestType,
          rejectedBy: approvalData.rejectedByName,
          rejectionReason: approvalData.rejectionReason
        },
        priority: 'high',
        sourceEntityType: 'approval_request',
        sourceEntityId: approvalData.id,
        actionUrl: `/approvals/${approvalData.id}`
      });
    } catch (error) {
      console.error('Error creating approval rejected event:', error);
    }
  }

  /**
   * Multi-School Director Events
   */
  static async onSchoolContextSwitched(directorData) {
    try {
      await realtimeEventService.createSchoolSwitchEvent(
        directorData.directorId,
        directorData.previousSchoolId,
        directorData.currentSchoolId,
        directorData.schoolName
      );
    } catch (error) {
      console.error('Error creating school switch event:', error);
    }
  }

  /**
   * Payment Events
   */
  static async onPaymentReceived(paymentData) {
    try {
      await realtimeEventService.createEvent({
        eventType: 'payment_received',
        schoolId: paymentData.schoolId,
        sourceUserId: paymentData.processedBy,
        targetUserIds: paymentData.parentIds || [],
        targetRoles: ['finance_manager', 'principal'],
        title: 'Payment Received',
        message: `Payment of ${paymentData.currency} ${paymentData.amount} has been received for ${paymentData.studentName}`,
        eventPayload: {
          paymentId: paymentData.id,
          studentId: paymentData.studentId,
          studentName: paymentData.studentName,
          amount: paymentData.amount,
          currency: paymentData.currency,
          paymentMethod: paymentData.paymentMethod,
          reference: paymentData.reference
        },
        priority: 'normal',
        sourceEntityType: 'payment',
        sourceEntityId: paymentData.id,
        actionUrl: `/finance/payments/${paymentData.id}`
      });
    } catch (error) {
      console.error('Error creating payment received event:', error);
    }
  }

  /**
   * User Authentication Events
   */
  static async onUserLogin(userData) {
    try {
      await realtimeEventService.createEvent({
        eventType: 'user_login',
        schoolId: userData.schoolId,
        sourceUserId: userData.userId,
        targetUserIds: [userData.userId],
        title: 'Welcome back!',
        message: `You have successfully logged into the system`,
        eventPayload: {
          loginTime: new Date().toISOString(),
          device: userData.device,
          ipAddress: userData.ipAddress
        },
        priority: 'low',
        sourceEntityType: 'user_session',
        sourceEntityId: userData.userId
      });
    } catch (error) {
      console.error('Error creating user login event:', error);
    }
  }

  /**
   * System Events
   */
  static async onSystemMaintenance(maintenanceData) {
    try {
      await realtimeEventService.createEvent({
        eventType: 'system_maintenance',
        schoolId: null, // Global event
        sourceUserId: maintenanceData.announcedBy,
        targetRoles: null, // All users
        title: 'System Maintenance',
        message: `System maintenance is scheduled for ${maintenanceData.maintenanceTime}. ${maintenanceData.details}`,
        eventPayload: {
          maintenanceStart: maintenanceData.startTime,
          maintenanceEnd: maintenanceData.endTime,
          affectedServices: maintenanceData.affectedServices,
          details: maintenanceData.details
        },
        priority: 'urgent',
        sourceEntityType: 'system_maintenance',
        sourceEntityId: maintenanceData.id
      });
    } catch (error) {
      console.error('Error creating system maintenance event:', error);
    }
  }

  /**
   * Helper method to create custom events
   */
  static async createCustomEvent(eventData) {
    try {
      return await realtimeEventService.createEvent(eventData);
    } catch (error) {
      console.error('Error creating custom event:', error);
      throw error;
    }
  }

  /**
   * Batch event creation
   */
  static async createBatchEvents(eventsData) {
    const results = [];
    
    for (const eventData of eventsData) {
      try {
        const eventId = await realtimeEventService.createEvent(eventData);
        results.push({ success: true, eventId, eventData });
      } catch (error) {
        results.push({ success: false, error: error.message, eventData });
      }
    }

    return results;
  }
}

module.exports = RealtimeIntegrations;