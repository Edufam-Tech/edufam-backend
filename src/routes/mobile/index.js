const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../../middleware/auth');

// Import mobile controllers
const MobileDirectorController = require('../../controllers/mobile/directorController');
const MobilePrincipalController = require('../../controllers/mobile/principalController');
const MobileTeacherController = require('../../controllers/mobile/teacherController');
const MobileNotificationController = require('../../controllers/mobile/notificationController');
const OfflineSyncController = require('../../controllers/mobile/offlineSyncController');

// Apply authentication to all mobile routes
router.use(authenticate);

// =============================================================================
// MOBILE API ROOT - VERSION INFO
// =============================================================================

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Edufam Mobile API',
      version: '1.0.0',
      description: 'Mobile-optimized APIs for the Edufam education management platform',
      features: [
        'Role-based mobile interfaces',
        'Real-time notifications',
        'Offline sync support',
        'Push notifications',
        'WebSocket real-time updates'
      ],
      supportedRoles: [
        'school_director',
        'principal', 
        'teacher',
        'parent',
        'student',
        'hr_staff',
        'finance_staff'
      ],
      documentation: '/api/mobile/docs',
      websocket: '/api/mobile/ws'
    }
  });
});

// =============================================================================
// SCHOOL DIRECTOR MOBILE ROUTES
// =============================================================================

// Director dashboard
router.get('/director/dashboard',
  requireUserType('school_director'),
  MobileDirectorController.getDashboard
);

// School management
router.post('/director/switch-school',
  requireUserType('school_director'),
  MobileDirectorController.switchSchool
);

router.get('/director/schools',
  requireUserType('school_director'),
  MobileDirectorController.getSchools
);

// Approvals management
router.get('/director/approvals/pending',
  requireUserType('school_director'),
  MobileDirectorController.getPendingApprovals
);

router.post('/director/approvals/:id/approve',
  requireUserType('school_director'),
  MobileDirectorController.approveRequest
);

router.post('/director/approvals/:id/reject',
  requireUserType('school_director'),
  MobileDirectorController.rejectRequest
);

// Analytics
router.get('/director/analytics/portfolio',
  requireUserType('school_director'),
  MobileDirectorController.getPortfolioAnalytics
);

router.get('/director/analytics/school/:schoolId',
  requireUserType('school_director'),
  MobileDirectorController.getSchoolAnalytics
);

// =============================================================================
// PRINCIPAL MOBILE ROUTES
// =============================================================================

// Principal dashboard
router.get('/principal/dashboard',
  requireRole(['principal']),
  MobilePrincipalController.getDashboard
);

// Grade approvals
router.get('/principal/grades/pending',
  requireRole(['principal']),
  MobilePrincipalController.getPendingGrades
);

router.get('/principal/grades/:id/review',
  requireRole(['principal']),
  MobilePrincipalController.reviewGradeSubmission
);

router.post('/principal/grades/:id/approve',
  requireRole(['principal']),
  MobilePrincipalController.approveGradeSubmission
);

router.post('/principal/grades/:id/reject',
  requireRole(['principal']),
  MobilePrincipalController.rejectGradeSubmission
);

router.post('/principal/grades/bulk-approve',
  requireRole(['principal']),
  MobilePrincipalController.bulkApproveGrades
);

// Academic analytics
router.get('/principal/analytics/academic',
  requireRole(['principal']),
  MobilePrincipalController.getAcademicAnalytics
);

// Staff management
router.get('/principal/staff/overview',
  requireRole(['principal']),
  MobilePrincipalController.getStaffOverview
);

router.post('/principal/staff/leave/:id/approve',
  requireRole(['principal']),
  MobilePrincipalController.approveLeaveRequest
);

// Daily operations
router.get('/principal/operations/today',
  requireRole(['principal']),
  MobilePrincipalController.getTodayOperations
);

router.post('/principal/operations/announcement',
  requireRole(['principal']),
  MobilePrincipalController.createAnnouncement
);

// =============================================================================
// TEACHER MOBILE ROUTES
// =============================================================================

// Teacher dashboard
router.get('/teacher/dashboard',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.getDashboard
);

// Timetable management
router.get('/teacher/timetable',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.getTimetable
);

router.post('/teacher/timetable/swap',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.requestTimetableSwap
);

router.post('/teacher/timetable/topic-update',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.updatePeriodTopic
);

// Gradebook
router.get('/teacher/gradebook/classes',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.getGradebookClasses
);

router.get('/teacher/gradebook/:classId/students',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.getClassStudentsForGrading
);

router.post('/teacher/gradebook/save',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.saveGrades
);

router.post('/teacher/gradebook/submit',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.submitGrades
);

// Attendance
router.get('/teacher/attendance/current-class',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.getCurrentClassForAttendance
);

router.post('/teacher/attendance/mark',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.markAttendance
);

router.post('/teacher/attendance/quick-mark',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.quickMarkAttendance
);

// Parent communication
router.get('/teacher/communications/conversations',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.getParentConversations
);

router.post('/teacher/communications/send',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.sendMessageToParent
);

router.post('/teacher/communications/broadcast',
  requireRole(['teacher', 'head_teacher']),
  MobileTeacherController.broadcastToClassParents
);

// =============================================================================
// PARENT MOBILE ROUTES
// =============================================================================

// Parent dashboard
router.get('/parent/dashboard',
  requireUserType('parent'),
  async (req, res, next) => {
    try {
      const parentId = req.user.userId;
      const { query } = require('../../config/database');

      const [children, recentGrades, upcomingEvents, notifications] = await Promise.all([
        // Get parent's children
        query(`
          SELECT 
            s.id,
            s.first_name,
            s.last_name,
            s.photo_url,
            c.name as class_name,
            (SELECT AVG(score) FROM student_grades sg 
             JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
             WHERE sg.student_id = s.id AND gs.submitted_at >= CURRENT_DATE - INTERVAL '30 days') as recent_average
          FROM students s
          JOIN parent_students ps ON s.id = ps.student_id
          JOIN classes c ON s.class_id = c.id
          WHERE ps.parent_id = $1 AND s.is_active = true
        `, [parentId]),

        // Recent grades
        query(`
          SELECT 
            s.first_name || ' ' || s.last_name as student_name,
            sub.name as subject_name,
            a.name as assessment_name,
            sg.score,
            sg.grade_letter,
            gs.submitted_at
          FROM student_grades sg
          JOIN students s ON sg.student_id = s.id
          JOIN parent_students ps ON s.id = ps.student_id
          JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
          JOIN assessments a ON sg.assessment_id = a.id
          JOIN subjects sub ON gs.subject_id = sub.id
          WHERE ps.parent_id = $1 AND sg.is_published = true
          ORDER BY gs.submitted_at DESC
          LIMIT 5
        `, [parentId]),

        // Upcoming events
        query(`
          SELECT 
            e.title,
            e.description,
            e.event_date,
            e.event_type
          FROM events e
          JOIN schools s ON e.school_id = s.id
          JOIN students st ON st.school_id = s.id
          JOIN parent_students ps ON st.id = ps.student_id
          WHERE ps.parent_id = $1 
            AND e.event_date >= CURRENT_DATE
            AND e.target_audience @> '["parents"]'
          ORDER BY e.event_date
          LIMIT 3
        `, [parentId]),

        // Recent notifications
        query(`
          SELECT type, title, message, created_at
          FROM notifications
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 5
        `, [parentId])
      ]);

      res.json({
        success: true,
        data: {
          greeting: `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}!`,
          children: children.rows.map(child => ({
            id: child.id,
            name: `${child.first_name} ${child.last_name}`,
            photo: child.photo_url,
            class: child.class_name,
            recentAverage: parseFloat(child.recent_average || 0).toFixed(1)
          })),
          recentGrades: recentGrades.rows,
          upcomingEvents: upcomingEvents.rows,
          notifications: notifications.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Parent child academic performance
router.get('/parent/children/:childId/academic',
  requireUserType('parent'),
  async (req, res, next) => {
    try {
      const { childId } = req.params;
      const parentId = req.user.userId;
      const { query } = require('../../config/database');

      // Verify parent-child relationship
      const relationship = await query(`
        SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2
      `, [parentId, childId]);

      if (relationship.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this student\'s information'
        });
      }

      const [grades, attendance, upcoming] = await Promise.all([
        // Recent grades
        query(`
          SELECT 
            sub.name as subject_name,
            a.name as assessment_name,
            sg.score,
            sg.grade_letter,
            sg.comments,
            gs.submitted_at
          FROM student_grades sg
          JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
          JOIN assessments a ON sg.assessment_id = a.id
          JOIN subjects sub ON gs.subject_id = sub.id
          WHERE sg.student_id = $1 AND sg.is_published = true
          ORDER BY gs.submitted_at DESC
          LIMIT 10
        `, [childId]),

        // Attendance summary
        query(`
          SELECT 
            DATE_TRUNC('week', date) as week,
            COUNT(*) as total_days,
            COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
            COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
            COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days
          FROM student_attendance
          WHERE student_id = $1 AND date >= CURRENT_DATE - INTERVAL '4 weeks'
          GROUP BY DATE_TRUNC('week', date)
          ORDER BY week DESC
        `, [childId]),

        // Upcoming assessments
        query(`
          SELECT 
            a.name,
            a.assessment_type,
            a.date_scheduled,
            sub.name as subject_name
          FROM assessments a
          JOIN subjects sub ON a.subject_id = sub.id
          JOIN students s ON a.class_id = s.class_id
          WHERE s.id = $1 AND a.date_scheduled >= CURRENT_DATE
          ORDER BY a.date_scheduled
          LIMIT 5
        `, [childId])
      ]);

      res.json({
        success: true,
        data: {
          grades: grades.rows,
          attendance: attendance.rows,
          upcomingAssessments: upcoming.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// PUSH NOTIFICATION ROUTES
// =============================================================================

// Send individual notification
router.post('/notifications/send',
  requireRole(['principal', 'school_director', 'admin']),
  MobileNotificationController.sendPushNotification
);

// Schedule notification
router.post('/notifications/schedule',
  requireRole(['principal', 'school_director', 'admin']),
  MobileNotificationController.scheduleNotification
);

// Broadcast notification
router.post('/notifications/broadcast',
  requireRole(['principal', 'school_director', 'admin']),
  MobileNotificationController.broadcastNotification
);

// Notification history
router.get('/notifications/history',
  MobileNotificationController.getNotificationHistory
);

// Notification analytics
router.get('/notifications/analytics',
  requireRole(['principal', 'school_director', 'admin']),
  MobileNotificationController.getNotificationAnalytics
);

// Device registration
router.post('/notifications/register-device',
  MobileNotificationController.registerDevice
);

router.post('/notifications/unregister-device',
  MobileNotificationController.unregisterDevice
);

// Notification preferences
router.get('/notifications/preferences',
  MobileNotificationController.getNotificationPreferences
);

router.put('/notifications/preferences',
  MobileNotificationController.updateNotificationPreferences
);

// =============================================================================
// OFFLINE SYNC ROUTES (Module 37)
// =============================================================================

// Sync configuration
router.get('/sync/config',
  OfflineSyncController.getSyncConfiguration
);

router.put('/sync/config',
  OfflineSyncController.updateSyncConfiguration
);

// Delta sync operations
router.get('/sync/delta',
  OfflineSyncController.getDeltaSync
);

// Conflict resolution
router.get('/sync/conflicts',
  OfflineSyncController.getPendingConflicts
);

router.post('/sync/conflicts/:conflictId/resolve',
  OfflineSyncController.resolveConflict
);

// Batch operations
router.post('/sync/batch-upload',
  OfflineSyncController.uploadBatchChanges
);

// Sync history and analytics
router.get('/sync/history',
  OfflineSyncController.getSyncHistory
);

router.get('/sync/analytics',
  OfflineSyncController.getSyncAnalytics
);

// =============================================================================
// LEGACY SYNC ROUTES (Basic Implementation)
// =============================================================================

// Get role-specific data for offline sync
router.get('/sync/role-data',
  async (req, res, next) => {
    try {
      const { lastSync } = req.query;
      const userId = req.user.userId;
      const userRole = req.user.userType;
      const schoolId = req.user.schoolId;
      const { query } = require('../../config/database');

      let roleSpecificData = {};

      // Build sync data based on user role
      switch (userRole) {
        case 'principal':
          const [pendingGrades, staffList, alerts] = await Promise.all([
            query(`
              SELECT * FROM grade_submissions 
              WHERE school_id = $1 AND status = 'submitted' AND approval_status = 'pending'
              ${lastSync ? 'AND updated_at > $2' : ''}
            `, lastSync ? [schoolId, lastSync] : [schoolId]),

            query(`
              SELECT id, first_name, last_name, role, department_id, is_active
              FROM users 
              WHERE school_id = $1 AND user_type = 'staff'
            `, [schoolId]),

            query(`
              SELECT * FROM alerts 
              WHERE school_id = $1 AND status = 'active'
              ${lastSync ? 'AND created_at > $2' : ''}
            `, lastSync ? [schoolId, lastSync] : [schoolId])
          ]);

          roleSpecificData = {
            pendingGrades: pendingGrades.rows,
            staffList: staffList.rows,
            alerts: alerts.rows
          };
          break;

        case 'teacher':
          const [myClasses, timetable, students] = await Promise.all([
            query(`
              SELECT c.id, c.name, s.name as subject_name
              FROM teacher_classes tc
              JOIN classes c ON tc.class_id = c.id
              JOIN subjects s ON tc.subject_id = s.id
              WHERE tc.teacher_id = $1 AND tc.is_active = true
            `, [userId]),

            query(`
              SELECT * FROM timetable_entries 
              WHERE teacher_id = $1 AND is_active = true
            `, [userId]),

            query(`
              SELECT DISTINCT s.id, s.first_name, s.last_name, s.class_id
              FROM students s
              JOIN teacher_classes tc ON s.class_id = tc.class_id
              WHERE tc.teacher_id = $1 AND s.is_active = true
            `, [userId])
          ]);

          roleSpecificData = {
            myClasses: myClasses.rows,
            timetable: timetable.rows,
            studentLists: students.rows
          };
          break;

        case 'school_director':
          const [schools, approvals, analytics] = await Promise.all([
            query(`
              SELECT s.* FROM schools s
              JOIN school_directors sd ON s.id = sd.school_id
              WHERE sd.director_id = $1 AND s.is_active = true
            `, [userId]),

            query(`
              SELECT ar.* FROM approval_requests ar
              JOIN schools s ON ar.school_id = s.id
              JOIN school_directors sd ON s.id = sd.school_id
              WHERE sd.director_id = $1 AND ar.status = 'pending'
            `, [userId]),

            query(`
              SELECT 'portfolio_metrics' as type, COUNT(*) as value 
              FROM schools s
              JOIN school_directors sd ON s.id = sd.school_id
              WHERE sd.director_id = $1
            `, [userId])
          ]);

          roleSpecificData = {
            schools: schools.rows,
            pendingApprovals: approvals.rows,
            analytics: analytics.rows
          };
          break;

        case 'parent':
          const [children, grades, announcements] = await Promise.all([
            query(`
              SELECT s.*, c.name as class_name
              FROM students s
              JOIN parent_students ps ON s.id = ps.student_id
              JOIN classes c ON s.class_id = c.id
              WHERE ps.parent_id = $1 AND s.is_active = true
            `, [userId]),

            query(`
              SELECT sg.*, sub.name as subject_name, a.name as assessment_name
              FROM student_grades sg
              JOIN students s ON sg.student_id = s.id
              JOIN parent_students ps ON s.id = ps.student_id
              JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
              JOIN assessments a ON sg.assessment_id = a.id
              JOIN subjects sub ON gs.subject_id = sub.id
              WHERE ps.parent_id = $1 AND sg.is_published = true
              ORDER BY gs.submitted_at DESC
              LIMIT 20
            `, [userId]),

            query(`
              SELECT * FROM announcements 
              WHERE school_id = $1 
                AND target_audience @> '["parents"]'
                AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            `, [schoolId])
          ]);

          roleSpecificData = {
            children: children.rows,
            recentGrades: grades.rows,
            announcements: announcements.rows
          };
          break;
      }

      // Common data for all roles
      const [commonAnnouncements, messages] = await Promise.all([
        query(`
          SELECT * FROM announcements 
          WHERE school_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            ${lastSync ? 'AND updated_at > $2' : ''}
        `, lastSync ? [schoolId, lastSync] : [schoolId]),

        query(`
          SELECT m.*, c.subject
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          JOIN conversation_participants cp ON c.id = cp.conversation_id
          WHERE cp.user_id = $1
            ${lastSync ? 'AND m.created_at > $2' : ''}
          ORDER BY m.created_at DESC
          LIMIT 50
        `, lastSync ? [userId, lastSync] : [userId])
      ]);

      const syncToken = new Date().toISOString();
      const nextSync = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

      res.json({
        success: true,
        data: {
          roleSpecificData,
          commonData: {
            announcements: commonAnnouncements.rows,
            messages: messages.rows
          },
          syncMetadata: {
            lastSync: lastSync || null,
            syncToken,
            nextSync,
            userRole,
            syncedAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Upload offline data changes
router.post('/sync/upload',
  async (req, res, next) => {
    try {
      const { changes, lastSyncToken } = req.body;
      const userId = req.user.userId;

      if (!changes || !Array.isArray(changes)) {
        throw new ValidationError('Changes array is required');
      }

      const results = [];
      const conflicts = [];

      // Process each change
      for (const change of changes) {
        try {
          const result = await processOfflineChange(change, userId);
          results.push(result);
        } catch (error) {
          if (error.code === 'CONFLICT') {
            conflicts.push({
              changeId: change.id,
              conflict: error.conflict,
              serverData: error.serverData
            });
          } else {
            results.push({
              changeId: change.id,
              success: false,
              error: error.message
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          processedChanges: results.length,
          successfulChanges: results.filter(r => r.success).length,
          conflicts: conflicts.length,
          conflictDetails: conflicts,
          newSyncToken: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// MOBILE ANALYTICS ROUTES
// =============================================================================

// Get mobile app usage analytics
router.get('/analytics/usage',
  requireRole(['principal', 'school_director', 'admin']),
  async (req, res, next) => {
    try {
      const { period = '7d' } = req.query;
      const schoolId = req.user.schoolId;
      const { query } = require('../../config/database');

      const timeInterval = period === '1d' ? '1 day' : 
                          period === '7d' ? '7 days' : 
                          period === '30d' ? '30 days' : '7 days';

      const [userActivity, featureUsage, sessionStats] = await Promise.all([
        // User activity by role
        query(`
          SELECT 
            user_type,
            COUNT(DISTINCT user_id) as active_users,
            COUNT(*) as total_sessions
          FROM user_sessions
          WHERE school_id = $1 
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
            AND platform = 'mobile'
          GROUP BY user_type
        `, [schoolId]),

        // Feature usage
        query(`
          SELECT 
            feature_name,
            COUNT(*) as usage_count,
            COUNT(DISTINCT user_id) as unique_users
          FROM feature_usage_logs
          WHERE school_id = $1
            AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
            AND platform = 'mobile'
          GROUP BY feature_name
          ORDER BY usage_count DESC
        `, [schoolId]),

        // Session statistics
        query(`
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            COUNT(*) as sessions,
            AVG(EXTRACT(EPOCH FROM (ended_at - created_at))/60) as avg_duration_minutes
          FROM user_sessions
          WHERE school_id = $1
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${timeInterval}'
            AND platform = 'mobile'
            AND ended_at IS NOT NULL
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY date
        `, [schoolId])
      ]);

      res.json({
        success: true,
        data: {
          period,
          userActivity: userActivity.rows,
          featureUsage: featureUsage.rows,
          sessionStats: sessionStats.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Process offline changes with conflict resolution
async function processOfflineChange(change, userId) {
  const { query } = require('../../config/database');
  
  const { id, type, entity, data, timestamp, version } = change;

  // Check for conflicts by comparing timestamps and versions
  if (entity && data.id) {
    const current = await query(`
      SELECT updated_at, version FROM ${entity} WHERE id = $1
    `, [data.id]);

    if (current.rows.length > 0) {
      const serverVersion = current.rows[0].version || 1;
      const serverTimestamp = current.rows[0].updated_at;

      if (version && serverVersion > version) {
        const conflict = {
          code: 'CONFLICT',
          conflict: 'Version conflict',
          serverData: current.rows[0]
        };
        throw conflict;
      }

      if (new Date(serverTimestamp) > new Date(timestamp)) {
        const conflict = {
          code: 'CONFLICT', 
          conflict: 'Timestamp conflict',
          serverData: current.rows[0]
        };
        throw conflict;
      }
    }
  }

  // Process the change based on type
  switch (type) {
    case 'attendance_mark':
      await query(`
        INSERT INTO student_attendance (
          student_id, class_id, date, period, status, marked_by, offline_sync_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (student_id, date, period)
        DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by
      `, [data.studentId, data.classId, data.date, data.period, data.status, userId, id]);
      break;

    case 'grade_save':
      await query(`
        INSERT INTO student_grades (
          student_id, assessment_id, score, grade_letter, comments, teacher_id, offline_sync_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (student_id, assessment_id)
        DO UPDATE SET 
          score = EXCLUDED.score,
          grade_letter = EXCLUDED.grade_letter,
          comments = EXCLUDED.comments
      `, [data.studentId, data.assessmentId, data.score, data.grade, data.comments, userId, id]);
      break;

    case 'message_send':
      await query(`
        INSERT INTO messages (
          conversation_id, sender_id, content, message_type, offline_sync_id
        ) VALUES ($1, $2, $3, $4, $5)
      `, [data.conversationId, userId, data.content, 'text', id]);
      break;

    default:
      throw new Error(`Unknown change type: ${type}`);
  }

  return {
    changeId: id,
    success: true,
    processedAt: new Date().toISOString()
  };
}

module.exports = router;