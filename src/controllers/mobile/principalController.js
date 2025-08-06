const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class MobilePrincipalController {
  // =============================================================================
  // PRINCIPAL DASHBOARD - MOBILE OPTIMIZED
  // =============================================================================

  // Get principal dashboard overview
  static async getDashboard(req, res, next) {
    try {
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      const [
        principalProfile,
        schoolMetrics,
        pendingTasks,
        todaySchedule,
        alerts,
        attendanceToday
      ] = await Promise.all([
        // Principal profile
        query(`
          SELECT first_name, last_name, role, photo_url
          FROM users 
          WHERE id = $1
        `, [principalId]),

        // School metrics
        query(`
          SELECT 
            s.name as school_name,
            (SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = true) as total_students,
            (SELECT COUNT(*) FROM users WHERE school_id = $1 AND user_type = 'staff' AND is_active = true) as total_teachers,
            (SELECT AVG(overall_score) FROM academic_reports WHERE school_id = $1 AND term = (SELECT id FROM academic_terms WHERE is_current = true LIMIT 1)) as academic_performance
          FROM schools s
          WHERE s.id = $1
        `, [schoolId]),

        // Pending tasks
        query(`
          SELECT 
            (SELECT COUNT(*) FROM grade_submissions WHERE school_id = $1 AND status = 'submitted' AND approval_status = 'pending') as grade_approvals,
            (SELECT COUNT(*) FROM leave_requests WHERE school_id = $1 AND status = 'pending' AND requires_principal_approval = true) as leave_requests,
            (SELECT COUNT(*) FROM disciplinary_incidents WHERE school_id = $1 AND status = 'open') as disciplinary_issues,
            (SELECT COUNT(*) FROM parent_meetings WHERE school_id = $1 AND status = 'scheduled' AND meeting_date >= CURRENT_DATE) as parent_meetings
        `, [schoolId]),

        // Today's schedule
        query(`
          SELECT 
            ps.time_slot,
            ps.event_type,
            ps.title,
            ps.location,
            ps.description,
            ps.participants
          FROM principal_schedule ps
          WHERE ps.school_id = $1 
            AND ps.principal_id = $2
            AND ps.schedule_date = CURRENT_DATE
            AND ps.is_active = true
          ORDER BY ps.time_slot
        `, [schoolId, principalId]),

        // Critical alerts
        query(`
          SELECT 
            type,
            title,
            message,
            severity,
            created_at,
            metadata
          FROM alerts
          WHERE school_id = $1
            AND status = 'active'
            AND severity IN ('critical', 'high')
          ORDER BY 
            CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
            created_at DESC
          LIMIT 3
        `, [schoolId]),

        // Today's attendance
        query(`
          SELECT 
            attendance_type,
            total_expected,
            present_count,
            absent_count,
            late_count,
            ROUND((present_count::decimal / total_expected * 100), 1) as percentage
          FROM daily_attendance
          WHERE school_id = $1 AND date = CURRENT_DATE
        `, [schoolId])
      ]);

      const profile = principalProfile.rows[0];
      const metrics = schoolMetrics.rows[0];
      const tasks = pendingTasks.rows[0];
      
      const currentTime = new Date().getHours();
      const greeting = `Good ${currentTime < 12 ? 'morning' : currentTime < 17 ? 'afternoon' : 'evening'}, Principal ${profile.first_name}`;

      // Process attendance data
      const attendance = {
        students: attendanceToday.rows.find(a => a.attendance_type === 'student') || { present_count: 0, total_expected: 0, percentage: 0 },
        staff: attendanceToday.rows.find(a => a.attendance_type === 'staff') || { present_count: 0, total_expected: 0, percentage: 0 }
      };

      res.json({
        success: true,
        data: {
          greeting,
          schoolName: metrics.school_name,
          schoolMetrics: {
            totalStudents: parseInt(metrics.total_students),
            totalTeachers: parseInt(metrics.total_teachers),
            todayAttendance: {
              students: {
                present: parseInt(attendance.students.present_count),
                total: parseInt(attendance.students.total_expected),
                percentage: parseFloat(attendance.students.percentage || 0)
              },
              staff: {
                present: parseInt(attendance.staff.present_count),
                total: parseInt(attendance.staff.total_expected),
                percentage: parseFloat(attendance.staff.percentage || 0)
              }
            },
            academicPerformance: {
              average: parseFloat(metrics.academic_performance || 0).toFixed(1),
              trend: 'stable', // This would be calculated from historical data
              status: parseFloat(metrics.academic_performance || 0) >= 75 ? 'good' : parseFloat(metrics.academic_performance || 0) >= 60 ? 'average' : 'needs_improvement'
            }
          },
          pendingTasks: {
            gradeApprovals: parseInt(tasks.grade_approvals),
            leaveRequests: parseInt(tasks.leave_requests),
            disciplinaryIssues: parseInt(tasks.disciplinary_issues),
            parentMeetings: parseInt(tasks.parent_meetings),
            total: parseInt(tasks.grade_approvals) + parseInt(tasks.leave_requests) + parseInt(tasks.disciplinary_issues) + parseInt(tasks.parent_meetings)
          },
          todaySchedule: todaySchedule.rows.map(item => ({
            time: item.time_slot,
            event: item.title,
            type: item.event_type,
            location: item.location,
            description: item.description,
            participants: item.participants ? JSON.parse(item.participants) : []
          })),
          alerts: alerts.rows.map(alert => ({
            type: alert.severity,
            message: alert.message,
            timestamp: alert.created_at,
            metadata: alert.metadata ? JSON.parse(alert.metadata) : {}
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // GRADE APPROVAL SYSTEM
  // =============================================================================

  // Get pending grade submissions
  static async getPendingGrades(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { 
        classId, 
        subjectId, 
        teacherId,
        page = 1, 
        limit = 20 
      } = req.query;

      let whereClause = 'WHERE gs.school_id = $1 AND gs.status = $2 AND gs.approval_status = $3';
      const params = [schoolId, 'submitted', 'pending'];
      let paramIndex = 4;

      if (classId) {
        whereClause += ` AND gs.class_id = $${paramIndex}`;
        params.push(classId);
        paramIndex++;
      }

      if (subjectId) {
        whereClause += ` AND gs.subject_id = $${paramIndex}`;
        params.push(subjectId);
        paramIndex++;
      }

      if (teacherId) {
        whereClause += ` AND gs.teacher_id = $${paramIndex}`;
        params.push(teacherId);
        paramIndex++;
      }

      const offset = (page - 1) * limit;

      const [gradeSubmissions, bulkInfo] = await Promise.all([
        // Get grade submissions
        query(`
          SELECT 
            gs.*,
            c.name as class_name,
            s.name as subject_name,
            u.first_name,
            u.last_name,
            u.photo_url,
            a.name as assessment_name,
            a.assessment_type,
            a.total_marks,
            (SELECT COUNT(*) FROM student_grades WHERE grade_submission_id = gs.id) as student_count,
            (SELECT AVG(score) FROM student_grades WHERE grade_submission_id = gs.id) as average_score,
            (SELECT MAX(score) FROM student_grades WHERE grade_submission_id = gs.id) as highest_score,
            (SELECT MIN(score) FROM student_grades WHERE grade_submission_id = gs.id) as lowest_score
          FROM grade_submissions gs
          JOIN classes c ON gs.class_id = c.id
          JOIN subjects s ON gs.subject_id = s.id
          JOIN users u ON gs.teacher_id = u.id
          JOIN assessments a ON gs.assessment_id = a.id
          ${whereClause}
          ORDER BY gs.submitted_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]),

        // Get bulk action info
        query(`
          SELECT COUNT(*) as total_pending
          FROM grade_submissions
          WHERE school_id = $1 AND status = 'submitted' AND approval_status = 'pending'
        `, [schoolId])
      ]);

      const formattedSubmissions = await Promise.all(gradeSubmissions.rows.map(async (submission) => {
        // Get grade distribution
        const gradeDistribution = await query(`
          SELECT 
            grade_letter,
            COUNT(*) as count
          FROM student_grades
          WHERE grade_submission_id = $1
          GROUP BY grade_letter
          ORDER BY grade_letter
        `, [submission.id]);

        // Check for flagged concerns
        const concerns = [];
        if (submission.average_score > 85) {
          concerns.push({
            type: 'high_average',
            message: 'Unusually high class average'
          });
        }
        if (submission.highest_score - submission.lowest_score > 70) {
          concerns.push({
            type: 'wide_range',
            message: 'Large score variation in class'
          });
        }

        return {
          id: submission.id,
          class: submission.class_name,
          subject: submission.subject_name,
          assessment: {
            name: submission.assessment_name,
            type: submission.assessment_type,
            totalMarks: submission.total_marks
          },
          teacher: {
            name: `${submission.first_name} ${submission.last_name}`,
            photo: submission.photo_url
          },
          submittedAt: submission.submitted_at,
          statistics: {
            totalStudents: parseInt(submission.student_count),
            average: parseFloat(submission.average_score || 0).toFixed(1),
            highest: parseInt(submission.highest_score || 0),
            lowest: parseInt(submission.lowest_score || 0),
            passed: gradeDistribution.rows.filter(g => !['D', 'E', 'F'].includes(g.grade_letter)).reduce((sum, g) => sum + parseInt(g.count), 0),
            failed: gradeDistribution.rows.filter(g => ['D', 'E', 'F'].includes(g.grade_letter)).reduce((sum, g) => sum + parseInt(g.count), 0)
          },
          gradeDistribution: gradeDistribution.rows.reduce((acc, row) => {
            acc[row.grade_letter] = parseInt(row.count);
            return acc;
          }, {}),
          flaggedConcerns: concerns
        };
      }));

      res.json({
        success: true,
        data: {
          pendingGrades: formattedSubmissions,
          bulkActions: {
            canApproveAll: formattedSubmissions.length > 0,
            totalPending: parseInt(bulkInfo.rows[0].total_pending)
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(bulkInfo.rows[0].total_pending)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Review individual grade submission
  static async reviewGradeSubmission(req, res, next) {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const [submission, grades, analytics] = await Promise.all([
        // Get submission details
        query(`
          SELECT 
            gs.*,
            c.name as class_name,
            s.name as subject_name,
            u.first_name,
            u.last_name,
            a.name as assessment_name,
            a.assessment_type,
            a.total_marks
          FROM grade_submissions gs
          JOIN classes c ON gs.class_id = c.id
          JOIN subjects s ON gs.subject_id = s.id
          JOIN users u ON gs.teacher_id = u.id
          JOIN assessments a ON gs.assessment_id = a.id
          WHERE gs.id = $1 AND gs.school_id = $2
        `, [id, schoolId]),

        // Get individual student grades
        query(`
          SELECT 
            sg.*,
            st.first_name,
            st.last_name,
            st.admission_number,
            st.photo_url,
            (SELECT AVG(score) FROM student_grades sg2 
             JOIN grade_submissions gs2 ON sg2.grade_submission_id = gs2.id
             WHERE sg2.student_id = sg.student_id 
               AND gs2.subject_id = (SELECT subject_id FROM grade_submissions WHERE id = $1)
               AND gs2.submitted_at < (SELECT submitted_at FROM grade_submissions WHERE id = $1)
             LIMIT 5) as previous_average
          FROM student_grades sg
          JOIN students st ON sg.student_id = st.id
          WHERE sg.grade_submission_id = $1
          ORDER BY st.last_name, st.first_name
        `, [id]),

        // Get class/subject analytics
        query(`
          SELECT 
            (SELECT AVG(score) FROM student_grades sg3 
             JOIN grade_submissions gs3 ON sg3.grade_submission_id = gs3.id
             WHERE gs3.class_id = (SELECT class_id FROM grade_submissions WHERE id = $1)
               AND gs3.submitted_at >= CURRENT_DATE - INTERVAL '30 days') as class_average,
            (SELECT AVG(score) FROM student_grades sg4 
             JOIN grade_submissions gs4 ON sg4.grade_submission_id = gs4.id
             WHERE gs4.subject_id = (SELECT subject_id FROM grade_submissions WHERE id = $1)
               AND gs4.submitted_at >= CURRENT_DATE - INTERVAL '30 days') as subject_average,
            (SELECT AVG(score) FROM student_grades sg5 
             JOIN grade_submissions gs5 ON sg5.grade_submission_id = gs5.id
             WHERE gs5.teacher_id = (SELECT teacher_id FROM grade_submissions WHERE id = $1)
               AND gs5.submitted_at >= CURRENT_DATE - INTERVAL '30 days') as teacher_average
        `, [id])
      ]);

      if (submission.rows.length === 0) {
        throw new NotFoundError('Grade submission not found');
      }

      const submissionData = submission.rows[0];
      const analyticsData = analytics.rows[0];

      const formattedGrades = grades.rows.map(grade => ({
        studentId: grade.student_id,
        studentName: `${grade.first_name} ${grade.last_name}`,
        admissionNumber: grade.admission_number,
        photo: grade.photo_url,
        score: grade.score,
        grade: grade.grade_letter,
        previousAverage: parseFloat(grade.previous_average || 0).toFixed(1),
        improvement: grade.previous_average ? 
          (grade.score - grade.previous_average).toFixed(1) : null,
        comments: grade.comments
      }));

      res.json({
        success: true,
        data: {
          submission: {
            id: submissionData.id,
            class: submissionData.class_name,
            subject: submissionData.subject_name,
            assessment: submissionData.assessment_name,
            teacher: `${submissionData.first_name} ${submissionData.last_name}`,
            submittedAt: submissionData.submitted_at
          },
          grades: formattedGrades,
          analytics: {
            classAverage: parseFloat(analyticsData.class_average || 0).toFixed(1),
            subjectAverage: parseFloat(analyticsData.subject_average || 0).toFixed(1),
            teacherAverage: parseFloat(analyticsData.teacher_average || 0).toFixed(1)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Approve grade submission
  static async approveGradeSubmission(req, res, next) {
    try {
      const { id } = req.params;
      const { comments, releaseDate } = req.body;
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      // Verify submission exists and is pending
      const submission = await query(`
        SELECT * FROM grade_submissions
        WHERE id = $1 AND school_id = $2 AND approval_status = 'pending'
      `, [id, schoolId]);

      if (submission.rows.length === 0) {
        throw new NotFoundError('Grade submission not found or already processed');
      }

      // Update approval status
      await query(`
        UPDATE grade_submissions 
        SET approval_status = 'approved',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_comments = $2,
            grade_release_date = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [principalId, comments, releaseDate || new Date(), id]);

      // If release date is now or in the past, publish grades
      if (!releaseDate || new Date(releaseDate) <= new Date()) {
        await query(`
          UPDATE student_grades 
          SET is_published = true, published_at = CURRENT_TIMESTAMP
          WHERE grade_submission_id = $1
        `, [id]);
      }

      res.json({
        success: true,
        message: 'Grades approved successfully',
        data: {
          submissionId: id,
          status: 'approved',
          approvedAt: new Date().toISOString(),
          releaseDate: releaseDate || new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Reject grade submission
  static async rejectGradeSubmission(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, concerns = [] } = req.body;
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      if (!reason) {
        throw new ValidationError('Rejection reason is required');
      }

      // Verify submission exists and is pending
      const submission = await query(`
        SELECT * FROM grade_submissions
        WHERE id = $1 AND school_id = $2 AND approval_status = 'pending'
      `, [id, schoolId]);

      if (submission.rows.length === 0) {
        throw new NotFoundError('Grade submission not found or already processed');
      }

      // Update approval status
      await query(`
        UPDATE grade_submissions 
        SET approval_status = 'rejected',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_comments = $2,
            rejection_concerns = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [principalId, reason, JSON.stringify(concerns), id]);

      res.json({
        success: true,
        message: 'Grade submission rejected',
        data: {
          submissionId: id,
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          reason
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk approve grades
  static async bulkApproveGrades(req, res, next) {
    try {
      const { gradeIds, releaseDate } = req.body;
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      if (!gradeIds || !Array.isArray(gradeIds) || gradeIds.length === 0) {
        throw new ValidationError('Grade IDs array is required');
      }

      // Verify all submissions exist and are pending
      const submissions = await query(`
        SELECT id FROM grade_submissions
        WHERE id = ANY($1) AND school_id = $2 AND approval_status = 'pending'
      `, [gradeIds, schoolId]);

      const validIds = submissions.rows.map(s => s.id);
      
      if (validIds.length === 0) {
        throw new ValidationError('No valid pending submissions found');
      }

      // Bulk approve
      await query(`
        UPDATE grade_submissions 
        SET approval_status = 'approved',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_comments = 'Bulk approved',
            grade_release_date = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($3)
      `, [principalId, releaseDate || new Date(), validIds]);

      // If release date is now or in the past, publish grades
      if (!releaseDate || new Date(releaseDate) <= new Date()) {
        await query(`
          UPDATE student_grades 
          SET is_published = true, published_at = CURRENT_TIMESTAMP
          WHERE grade_submission_id = ANY($1)
        `, [validIds]);
      }

      res.json({
        success: true,
        message: `${validIds.length} grade submissions approved successfully`,
        data: {
          approvedCount: validIds.length,
          skippedCount: gradeIds.length - validIds.length,
          releaseDate: releaseDate || new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ACADEMIC ANALYTICS
  // =============================================================================

  // Get academic analytics overview
  static async getAcademicAnalytics(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { period = 'month' } = req.query;

      const timeInterval = period === 'week' ? '7 days' : 
                          period === 'month' ? '30 days' : 
                          period === 'term' ? '90 days' : '30 days';

      const [
        performanceOverview,
        classPerformance,
        teacherPerformance,
        studentProgress,
        recommendations
      ] = await Promise.all([
        // Overall performance overview
        query(`
          SELECT 
            AVG(sg.score) as school_average,
            (SELECT AVG(sg2.score) FROM student_grades sg2 
             JOIN grade_submissions gs2 ON sg2.grade_submission_id = gs2.id
             WHERE gs2.school_id = $1 
               AND gs2.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}' - INTERVAL '${timeInterval}'
               AND gs2.submitted_at < CURRENT_DATE - INTERVAL '${timeInterval}') as previous_average,
            (SELECT s.name FROM subjects s 
             JOIN grade_submissions gs3 ON s.id = gs3.subject_id
             JOIN student_grades sg3 ON gs3.id = sg3.grade_submission_id
             WHERE gs3.school_id = $1 AND gs3.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
             GROUP BY s.id, s.name
             ORDER BY AVG(sg3.score) DESC LIMIT 1) as top_subject,
            (SELECT s.name FROM subjects s 
             JOIN grade_submissions gs4 ON s.id = gs4.subject_id
             JOIN student_grades sg4 ON gs4.id = sg4.grade_submission_id
             WHERE gs4.school_id = $1 AND gs4.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
             GROUP BY s.id, s.name
             ORDER BY AVG(sg4.score) ASC LIMIT 1) as weakest_subject
          FROM student_grades sg
          JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
          WHERE gs.school_id = $1 AND gs.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
        `, [schoolId]),

        // Class performance
        query(`
          SELECT 
            c.id,
            c.name,
            AVG(sg.score) as average_score,
            COUNT(DISTINCT sg.student_id) as student_count,
            COUNT(DISTINCT gs.teacher_id) as teacher_count
          FROM classes c
          LEFT JOIN grade_submissions gs ON c.id = gs.class_id
          LEFT JOIN student_grades sg ON gs.id = sg.grade_submission_id
          WHERE c.school_id = $1 
            AND gs.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
          GROUP BY c.id, c.name
          ORDER BY average_score DESC
        `, [schoolId]),

        // Teacher performance
        query(`
          SELECT 
            u.id,
            u.first_name,
            u.last_name,
            s.name as primary_subject,
            AVG(sg.score) as classes_average,
            COUNT(DISTINCT gs.class_id) as classes_taught,
            COUNT(DISTINCT sg.student_id) as students_taught,
            (AVG(sg.score) / 100 * 5) as effectiveness_score
          FROM users u
          JOIN grade_submissions gs ON u.id = gs.teacher_id
          JOIN student_grades sg ON gs.id = sg.grade_submission_id
          JOIN subjects s ON gs.subject_id = s.id
          WHERE u.school_id = $1 
            AND u.user_type = 'staff'
            AND gs.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
          GROUP BY u.id, u.first_name, u.last_name, s.name
          ORDER BY classes_average DESC
        `, [schoolId]),

        // Student progress analysis
        query(`
          SELECT 
            COUNT(CASE WHEN recent_avg > previous_avg + 5 THEN 1 END) as improving,
            COUNT(CASE WHEN ABS(recent_avg - previous_avg) <= 5 THEN 1 END) as stable,
            COUNT(CASE WHEN recent_avg < previous_avg - 5 THEN 1 END) as declining,
            COUNT(CASE WHEN recent_avg < 50 THEN 1 END) as at_risk
          FROM (
            SELECT 
              st.id,
              AVG(CASE WHEN gs.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}' THEN sg.score END) as recent_avg,
              AVG(CASE WHEN gs.submitted_at < CURRENT_DATE - INTERVAL '${timeInterval}' 
                       AND gs.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}' - INTERVAL '${timeInterval}' 
                       THEN sg.score END) as previous_avg
            FROM students st
            JOIN student_grades sg ON st.id = sg.student_id
            JOIN grade_submissions gs ON sg.grade_submission_id = gs.id
            WHERE st.school_id = $1
            GROUP BY st.id
            HAVING AVG(CASE WHEN gs.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}' THEN sg.score END) IS NOT NULL
               AND AVG(CASE WHEN gs.submitted_at < CURRENT_DATE - INTERVAL '${timeInterval}' 
                            AND gs.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}' - INTERVAL '${timeInterval}' 
                            THEN sg.score END) IS NOT NULL
          ) student_progress
        `, [schoolId]),

        // Recommendations based on data
        query(`
          SELECT 
            'intervention' as type,
            'high' as priority,
            'Extra tutoring needed for ' || s.name as suggestion,
            COUNT(*) as affected_students
          FROM subjects s
          JOIN grade_submissions gs ON s.id = gs.subject_id
          JOIN student_grades sg ON gs.id = sg.grade_submission_id
          WHERE gs.school_id = $1 
            AND gs.submitted_at >= CURRENT_DATE - INTERVAL '${timeInterval}'
          GROUP BY s.id, s.name
          HAVING AVG(sg.score) < 60
          ORDER BY AVG(sg.score)
          LIMIT 3
        `, [schoolId])
      ]);

      const overview = performanceOverview.rows[0];
      const trend = overview.previous_average ? 
        ((overview.school_average - overview.previous_average) / overview.previous_average * 100).toFixed(1) : '0';

      res.json({
        success: true,
        data: {
          period,
          performanceOverview: {
            schoolAverage: parseFloat(overview.school_average || 0).toFixed(1),
            trend: `${trend > 0 ? '+' : ''}${trend}%`,
            trendDirection: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
            topSubject: overview.top_subject,
            weakestSubject: overview.weakest_subject
          },
          classPerformance: classPerformance.rows.map(cls => ({
            class: cls.name,
            average: parseFloat(cls.average_score || 0).toFixed(1),
            studentCount: parseInt(cls.student_count),
            teacherCount: parseInt(cls.teacher_count),
            status: cls.average_score >= 75 ? 'excellent' : cls.average_score >= 60 ? 'good' : 'needs_improvement'
          })),
          teacherPerformance: teacherPerformance.rows.map(teacher => ({
            name: `${teacher.first_name} ${teacher.last_name}`,
            subject: teacher.primary_subject,
            classesAverage: parseFloat(teacher.classes_average || 0).toFixed(1),
            classesTaught: parseInt(teacher.classes_taught),
            studentsTaught: parseInt(teacher.students_taught),
            effectivenessScore: parseFloat(teacher.effectiveness_score || 0).toFixed(1)
          })),
          studentProgress: {
            improving: parseInt(studentProgress.rows[0].improving || 0),
            stable: parseInt(studentProgress.rows[0].stable || 0),
            declining: parseInt(studentProgress.rows[0].declining || 0),
            atRisk: parseInt(studentProgress.rows[0].at_risk || 0)
          },
          recommendations: recommendations.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // STAFF MANAGEMENT
  // =============================================================================

  // Get staff overview
  static async getStaffOverview(req, res, next) {
    try {
      const schoolId = req.user.schoolId;

      const [staffSummary, departments, leaveRequests, performanceAlerts] = await Promise.all([
        // Staff summary
        query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN last_login_at >= CURRENT_DATE THEN 1 END) as present_today,
            (SELECT COUNT(*) FROM leave_requests WHERE school_id = $1 AND status = 'approved' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE) as on_leave,
            COUNT(CASE WHEN last_login_at < CURRENT_DATE OR last_login_at IS NULL THEN 1 END) as absent
          FROM users
          WHERE school_id = $1 AND user_type = 'staff' AND is_active = true
        `, [schoolId]),

        // Department summary
        query(`
          SELECT 
            d.name,
            d.head_of_department,
            u.first_name as hod_first_name,
            u.last_name as hod_last_name,
            COUNT(staff.id) as teacher_count,
            AVG(CASE WHEN gs.submitted_at >= CURRENT_DATE - INTERVAL '30 days' THEN sg.score END) as department_performance
          FROM departments d
          LEFT JOIN users u ON d.head_of_department = u.id
          LEFT JOIN users staff ON d.id = staff.department_id AND staff.user_type = 'staff' AND staff.is_active = true
          LEFT JOIN grade_submissions gs ON staff.id = gs.teacher_id
          LEFT JOIN student_grades sg ON gs.id = sg.grade_submission_id
          WHERE d.school_id = $1
          GROUP BY d.id, d.name, d.head_of_department, u.first_name, u.last_name
          ORDER BY d.name
        `, [schoolId]),

        // Recent leave requests
        query(`
          SELECT 
            lr.*,
            u.first_name,
            u.last_name,
            u.photo_url,
            u.role,
            substitute.first_name as substitute_first_name,
            substitute.last_name as substitute_last_name
          FROM leave_requests lr
          JOIN users u ON lr.user_id = u.id
          LEFT JOIN users substitute ON lr.substitute_teacher_id = substitute.id
          WHERE lr.school_id = $1 
            AND lr.status = 'pending'
            AND lr.requires_principal_approval = true
          ORDER BY lr.created_at DESC
          LIMIT 10
        `, [schoolId]),

        // Performance alerts
        query(`
          SELECT 
            u.first_name,
            u.last_name,
            'Late arrivals' as issue,
            COUNT(*) as count
          FROM users u
          JOIN attendance_logs al ON u.id = al.user_id
          WHERE u.school_id = $1 
            AND al.check_in_time > '08:30:00'
            AND al.date >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY u.id, u.first_name, u.last_name
          HAVING COUNT(*) >= 3
          LIMIT 5
        `, [schoolId])
      ]);

      res.json({
        success: true,
        data: {
          staffSummary: {
            total: parseInt(staffSummary.rows[0].total),
            present: parseInt(staffSummary.rows[0].present_today),
            onLeave: parseInt(staffSummary.rows[0].on_leave),
            absent: parseInt(staffSummary.rows[0].absent)
          },
          departments: departments.rows.map(dept => ({
            name: dept.name,
            head: dept.hod_first_name ? `${dept.hod_first_name} ${dept.hod_last_name}` : 'Not assigned',
            teachers: parseInt(dept.teacher_count),
            performance: parseFloat(dept.department_performance || 0).toFixed(1)
          })),
          leaveRequests: leaveRequests.rows.map(request => ({
            id: request.id,
            staff: {
              name: `${request.first_name} ${request.last_name}`,
              role: request.role,
              photo: request.photo_url
            },
            type: request.leave_type,
            dates: {
              from: request.start_date,
              to: request.end_date,
              days: request.days_requested
            },
            reason: request.reason,
            substitute: request.substitute_first_name ? 
              `${request.substitute_first_name} ${request.substitute_last_name}` : null
          })),
          performanceAlerts: performanceAlerts.rows.map(alert => ({
            staff: `${alert.first_name} ${alert.last_name}`,
            issue: `${alert.count} ${alert.issue.toLowerCase()} this week`,
            action: 'Review needed'
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Approve leave request
  static async approveLeaveRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { substitute, comments } = req.body;
      const principalId = req.user.userId;
      const schoolId = req.user.schoolId;

      // Update leave request
      await query(`
        UPDATE leave_requests 
        SET status = 'approved',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP,
            approval_comments = $2,
            substitute_teacher_id = $3
        WHERE id = $4 AND school_id = $5 AND status = 'pending'
      `, [principalId, comments, substitute, id, schoolId]);

      res.json({
        success: true,
        message: 'Leave request approved successfully',
        data: {
          leaveRequestId: id,
          status: 'approved',
          substitute,
          approvedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // DAILY OPERATIONS
  // =============================================================================

  // Get today's operations overview
  static async getTodayOperations(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const principalId = req.user.userId;

      const [schedule, inspections, meetings, incidents] = await Promise.all([
        // Principal's schedule
        query(`
          SELECT *
          FROM principal_schedule
          WHERE school_id = $1 
            AND principal_id = $2
            AND schedule_date = CURRENT_DATE
          ORDER BY time_slot
        `, [schoolId, principalId]),

        // Scheduled inspections
        query(`
          SELECT *
          FROM inspection_schedules
          WHERE school_id = $1 
            AND inspection_date = CURRENT_DATE
            AND status = 'scheduled'
          ORDER BY scheduled_time
        `, [schoolId]),

        // Scheduled meetings
        query(`
          SELECT 
            pm.*,
            s.first_name as student_first_name,
            s.last_name as student_last_name,
            p.first_name as parent_first_name,
            p.last_name as parent_last_name
          FROM parent_meetings pm
          LEFT JOIN students s ON pm.student_id = s.id
          LEFT JOIN users p ON pm.parent_id = p.id
          WHERE pm.school_id = $1 
            AND pm.meeting_date = CURRENT_DATE
            AND pm.status = 'scheduled'
          ORDER BY pm.meeting_time
        `, [schoolId]),

        // Today's incidents
        query(`
          SELECT 
            di.*,
            s.first_name,
            s.last_name,
            s.admission_number
          FROM disciplinary_incidents di
          JOIN students s ON di.student_id = s.id
          WHERE di.school_id = $1 
            AND di.incident_date = CURRENT_DATE
          ORDER BY di.created_at DESC
        `, [schoolId])
      ]);

      res.json({
        success: true,
        data: {
          schedule: schedule.rows.map(item => ({
            time: item.time_slot,
            event: item.title,
            type: item.event_type,
            status: item.status || 'pending',
            location: item.location,
            description: item.description
          })),
          inspections: inspections.rows.map(inspection => ({
            area: inspection.area,
            time: inspection.scheduled_time,
            checklist: inspection.checklist ? JSON.parse(inspection.checklist) : [],
            inspector: inspection.inspector_name
          })),
          meetings: meetings.rows.map(meeting => ({
            time: meeting.meeting_time,
            title: `Parent Meeting - ${meeting.student_first_name} ${meeting.student_last_name}`,
            parent: `${meeting.parent_first_name} ${meeting.parent_last_name}`,
            agenda: meeting.agenda,
            location: meeting.location || 'Principal Office',
            type: meeting.meeting_type
          })),
          incidents: incidents.rows.map(incident => ({
            time: incident.created_at,
            type: incident.incident_type,
            severity: incident.severity,
            student: `${incident.first_name} ${incident.last_name} (${incident.admission_number})`,
            description: incident.description,
            action: incident.action_taken || 'Under review'
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Create announcement
  static async createAnnouncement(req, res, next) {
    try {
      const { title, message, targetAudience, priority = 'normal' } = req.body;
      const schoolId = req.user.schoolId;
      const principalId = req.user.userId;

      if (!title || !message || !targetAudience) {
        throw new ValidationError('Title, message, and target audience are required');
      }

      const result = await query(`
        INSERT INTO announcements (
          school_id, title, message, target_audience, priority, 
          created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        schoolId, title, message, JSON.stringify(targetAudience), priority,
        principalId, req.user.firstName + ' ' + req.user.lastName
      ]);

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: {
          announcementId: result.rows[0].id,
          title,
          targetAudience: JSON.parse(result.rows[0].target_audience),
          createdAt: result.rows[0].created_at
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MobilePrincipalController;