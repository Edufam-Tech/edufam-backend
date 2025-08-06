const Attendance = require('../models/attendance');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class AttendanceController {
  // Mark attendance for a student
  static async markAttendance(req, res, next) {
    try {
      const attendanceData = {
        ...req.body,
        markedBy: req.user.id
      };

      // Validate attendance data
      const validationErrors = Attendance.validateAttendanceData(attendanceData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const attendance = await Attendance.markAttendance(attendanceData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Attendance marked successfully',
        data: attendance
      });
    } catch (error) {
      next(error);
    }
  }

  // Get attendance for a specific date and class
  static async getAttendance(req, res, next) {
    try {
      const { date, classId } = req.params;
      const attendance = await Attendance.getAttendanceByRegister(classId, date);

      res.json({
        success: true,
        data: attendance
      });
    } catch (error) {
      next(error);
    }
  }

  // Update attendance record
  static async updateAttendance(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const attendance = await Attendance.updateAttendance(id, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Attendance updated successfully',
        data: attendance
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk mark attendance
  static async bulkMarkAttendance(req, res, next) {
    try {
      const { attendanceData } = req.body;

      if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
        throw new ValidationError('Attendance data array is required');
      }

      // Add markedBy to each attendance record
      const attendanceWithUser = attendanceData.map(record => ({
        ...record,
        markedBy: req.user.id
      }));

      const result = await Attendance.bulkMarkAttendance(attendanceWithUser, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Bulk attendance marking completed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get student attendance history
  static async getStudentHistory(req, res, next) {
    try {
      const { id } = req.params;
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        sessionType: req.query.sessionType,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const history = await Attendance.getAttendanceByStudent(id, filters);

      res.json({
        success: true,
        data: history,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: history.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get class attendance summary
  static async getClassSummary(req, res, next) {
    try {
      const { id } = req.params;
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        sessionType: req.query.sessionType
      };

      const summary = await Attendance.getClassSummary(id, filters);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  // Get attendance reports
  static async getAttendanceReports(req, res, next) {
    try {
      const filters = {
        classId: req.query.classId,
        studentId: req.query.studentId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        reportType: req.query.reportType || 'summary',
        includeAnalytics: req.query.includeAnalytics === 'true'
      };

      const reports = await Attendance.getAttendanceReports(req.user.school_id, filters);

      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      next(error);
    }
  }

  // Notify absent students
  static async notifyAbsentStudents(req, res, next) {
    try {
      const { date, classId, notificationType } = req.body;

      if (!date || !classId || !notificationType) {
        throw new ValidationError('Date, class ID, and notification type are required');
      }

      const result = await Attendance.notifyAbsentStudents(date, classId, notificationType, req.user.id);

      res.json({
        success: true,
        message: 'Absence notifications sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get attendance registers
  static async getAttendanceRegisters(req, res, next) {
    try {
      const filters = {
        classId: req.query.classId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        sessionType: req.query.sessionType,
        subjectId: req.query.subjectId,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const registers = await Attendance.getRegistersByClass(filters.classId, filters);

      res.json({
        success: true,
        data: registers,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: registers.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Create attendance register
  static async createAttendanceRegister(req, res, next) {
    try {
      const registerData = {
        ...req.body,
        schoolId: req.user.school_id,
        createdBy: req.user.id
      };

      const register = await Attendance.createRegister(registerData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Attendance register created successfully',
        data: register
      });
    } catch (error) {
      next(error);
    }
  }

  // Get attendance reasons
  static async getAttendanceReasons(req, res, next) {
    try {
      const reasons = await Attendance.getAttendanceReasons(req.user.school_id);

      res.json({
        success: true,
        data: reasons
      });
    } catch (error) {
      next(error);
    }
  }

  // Create attendance reason
  static async createAttendanceReason(req, res, next) {
    try {
      const reasonData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      const reason = await Attendance.createAttendanceReason(reasonData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Attendance reason created successfully',
        data: reason
      });
    } catch (error) {
      next(error);
    }
  }

  // Get attendance settings
  static async getAttendanceSettings(req, res, next) {
    try {
      const settings = await Attendance.getAttendanceSettings(req.user.school_id);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  // Update attendance settings
  static async updateAttendanceSettings(req, res, next) {
    try {
      const updateData = req.body;
      const settings = await Attendance.updateAttendanceSettings(req.user.school_id, updateData);

      res.json({
        success: true,
        message: 'Attendance settings updated successfully',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  // Create make-up class
  static async createMakeUpClass(req, res, next) {
    try {
      const classData = {
        ...req.body,
        schoolId: req.user.school_id,
        createdBy: req.user.id
      };

      const makeUpClass = await Attendance.createMakeUpClass(classData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Make-up class created successfully',
        data: makeUpClass
      });
    } catch (error) {
      next(error);
    }
  }

  // Get make-up classes
  static async getMakeUpClasses(req, res, next) {
    try {
      const filters = {
        classId: req.query.classId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const makeUpClasses = await Attendance.getMakeUpClasses(req.user.school_id, filters);

      res.json({
        success: true,
        data: makeUpClasses,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: makeUpClasses.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update make-up class
  static async updateMakeUpClass(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const makeUpClass = await Attendance.updateMakeUpClass(id, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Make-up class updated successfully',
        data: makeUpClass
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete make-up class
  static async deleteMakeUpClass(req, res, next) {
    try {
      const { id } = req.params;
      const makeUpClass = await Attendance.deleteMakeUpClass(id, req.user.id);

      res.json({
        success: true,
        message: 'Make-up class deleted successfully',
        data: makeUpClass
      });
    } catch (error) {
      next(error);
    }
  }

  // Create remedial session
  static async createRemedialSession(req, res, next) {
    try {
      const sessionData = {
        ...req.body,
        schoolId: req.user.school_id,
        createdBy: req.user.id
      };

      const remedialSession = await Attendance.createRemedialSession(sessionData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Remedial session created successfully',
        data: remedialSession
      });
    } catch (error) {
      next(error);
    }
  }

  // Get remedial sessions
  static async getRemedialSessions(req, res, next) {
    try {
      const filters = {
        classId: req.query.classId,
        studentId: req.query.studentId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const remedialSessions = await Attendance.getRemedialSessions(req.user.school_id, filters);

      res.json({
        success: true,
        data: remedialSessions,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: remedialSessions.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update remedial session
  static async updateRemedialSession(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const remedialSession = await Attendance.updateRemedialSession(id, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Remedial session updated successfully',
        data: remedialSession
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete remedial session
  static async deleteRemedialSession(req, res, next) {
    try {
      const { id } = req.params;
      const remedialSession = await Attendance.deleteRemedialSession(id, req.user.id);

      res.json({
        success: true,
        message: 'Remedial session deleted successfully',
        data: remedialSession
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate attendance report
  static async generateAttendanceReport(req, res, next) {
    try {
      const { studentId } = req.params;
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        includeAnalytics: req.query.includeAnalytics === 'true',
        includePatterns: req.query.includePatterns === 'true'
      };

      const report = await Attendance.generateAttendanceReport(studentId, filters);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  // Get attendance statistics
  static async getAttendanceStatistics(req, res, next) {
    try {
      const { studentId } = req.params;
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const statistics = await Attendance.getStudentStatistics(studentId, filters);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }

  // Get attendance dashboard
  static async getAttendanceDashboard(req, res, next) {
    try {
      const filters = {
        academicYearId: req.query.academicYearId,
        academicTermId: req.query.academicTermId,
        classId: req.query.classId
      };

      const dashboard = await Attendance.getAttendanceDashboard(req.user.school_id, filters);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  // Export attendance data
  static async exportAttendanceData(req, res, next) {
    try {
      const filters = {
        classId: req.query.classId,
        studentId: req.query.studentId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        format: req.query.format || 'csv'
      };

      const exportData = await Attendance.exportAttendanceData(req.user.school_id, filters);

      res.json({
        success: true,
        data: exportData,
        total: exportData.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Validate attendance data
  static async validateAttendance(req, res, next) {
    try {
      const attendanceData = req.body;
      const errors = Attendance.validateAttendanceData(attendanceData);

      res.json({
        success: true,
        data: {
          isValid: errors.length === 0,
          errors: errors
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // MISSING STAFF ATTENDANCE METHODS
  // =============================================================================

  static async getStaffAttendance(req, res, next) {
    res.status(200).json({ success: true, message: 'Get staff attendance - implementation pending', data: [] });
  }

  static async clockInStaff(req, res, next) {
    res.status(201).json({ success: true, message: 'Clock in staff - implementation pending', data: {} });
  }

  static async clockOutStaff(req, res, next) {
    res.status(200).json({ success: true, message: 'Clock out staff - implementation pending', data: {} });
  }

  static async getStaffAttendanceHistory(req, res, next) {
    res.status(200).json({ success: true, message: 'Get staff attendance history - implementation pending', data: [] });
  }

  static async getAttendancePatterns(req, res, next) {
    res.status(200).json({ success: true, message: 'Get attendance patterns - implementation pending', data: {} });
  }

  static async getChronicAbsenteeism(req, res, next) {
    res.status(200).json({ success: true, message: 'Get chronic absenteeism - implementation pending', data: [] });
  }

  static async getStaffPunctuality(req, res, next) {
    res.status(200).json({ success: true, message: 'Get staff punctuality - implementation pending', data: {} });
  }
}

module.exports = AttendanceController; 