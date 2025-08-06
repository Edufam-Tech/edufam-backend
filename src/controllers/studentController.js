const StudentService = require('../services/studentService');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class StudentController {
  // Student Management Controllers
  static async createStudent(req, res) {
    try {
      const studentData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      const student = await StudentService.createStudent(studentData, req.user.id);
      
      res.status(201).json({
        success: true,
        data: student,
        message: 'Student created successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT_ERROR',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create student'
        }
      });
    }
  }

  static async getStudent(req, res) {
    try {
      const { studentId } = req.params;
      const studentDetails = await StudentService.getStudentDetails(studentId, req.user.id);
      
      res.json({
        success: true,
        data: studentDetails,
        message: 'Student details retrieved successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve student details'
        }
      });
    }
  }

  static async getAllStudents(req, res) {
    try {
      const { page, limit, search, classId, curriculumType, enrollmentStatus, gender } = req.query;
      
      const filters = {
        schoolId: req.user.school_id,
        classId,
        curriculumType,
        enrollmentStatus,
        gender
      };

      const pagination = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10
      };

      let result;
      if (search) {
        result = await StudentService.searchStudents(req.user.school_id, search, filters, pagination);
      } else {
        result = await StudentService.getAllStudents(filters, pagination);
      }
      
      res.json({
        success: true,
        data: result.students,
        message: 'Students retrieved successfully',
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve students'
        }
      });
    }
  }

  static async updateStudent(req, res) {
    try {
      const { studentId } = req.params;
      const updateData = req.body;

      const student = await StudentService.updateStudent(studentId, updateData, req.user.id);
      
      res.json({
        success: true,
        data: student,
        message: 'Student updated successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT_ERROR',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update student'
        }
      });
    }
  }

  static async deactivateStudent(req, res) {
    try {
      const { studentId } = req.params;
      const student = await StudentService.deactivateStudent(studentId, req.user.id);
      
      res.json({
        success: true,
        data: student,
        message: 'Student deactivated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to deactivate student'
        }
      });
    }
  }

  static async reactivateStudent(req, res) {
    try {
      const { studentId } = req.params;
      const student = await StudentService.reactivateStudent(studentId, req.user.id);
      
      res.json({
        success: true,
        data: student,
        message: 'Student reactivated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reactivate student'
        }
      });
    }
  }

  // Class Management Controllers
  static async createClass(req, res) {
    try {
      const classData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      const classRecord = await StudentService.createClass(classData, req.user.id);
      
      res.status(201).json({
        success: true,
        data: classRecord,
        message: 'Class created successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT_ERROR',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create class'
        }
      });
    }
  }

  static async getClass(req, res) {
    try {
      const { classId } = req.params;
      const classDetails = await StudentService.getClassDetails(classId);
      
      res.json({
        success: true,
        data: classDetails,
        message: 'Class details retrieved successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve class details'
        }
      });
    }
  }

  static async getAllClasses(req, res) {
    try {
      const { page, limit, academicYearId, curriculumType, gradeLevel, teacherId } = req.query;
      
      const filters = {
        schoolId: req.user.school_id,
        academicYearId,
        curriculumType,
        gradeLevel,
        teacherId
      };

      const pagination = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10
      };

      const result = await StudentService.getAllClasses(filters, pagination);
      
      res.json({
        success: true,
        data: result.classes,
        message: 'Classes retrieved successfully',
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve classes'
        }
      });
    }
  }

  static async updateClass(req, res) {
    try {
      const { classId } = req.params;
      const updateData = req.body;

      const classRecord = await StudentService.updateClass(classId, updateData, req.user.id);
      
      res.json({
        success: true,
        data: classRecord,
        message: 'Class updated successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT_ERROR',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update class'
        }
      });
    }
  }

  // Enrollment Management Controllers
  static async enrollStudent(req, res) {
    try {
      const enrollmentData = {
        ...req.body,
        schoolId: req.user.school_id
      };

      const enrollment = await StudentService.enrollStudent(enrollmentData, req.user.id);
      
      res.status(201).json({
        success: true,
        data: enrollment,
        message: 'Student enrolled successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT_ERROR',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to enroll student'
        }
      });
    }
  }

  static async getEnrollment(req, res) {
    try {
      const { enrollmentId } = req.params;
      const enrollment = await StudentService.getEnrollmentDetails(enrollmentId);
      
      res.json({
        success: true,
        data: enrollment,
        message: 'Enrollment details retrieved successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve enrollment details'
        }
      });
    }
  }

  static async getAllEnrollments(req, res) {
    try {
      const { page, limit, academicYearId, classId, enrollmentStatus, enrollmentType } = req.query;
      
      const filters = {
        schoolId: req.user.school_id,
        academicYearId,
        classId,
        enrollmentStatus,
        enrollmentType
      };

      const pagination = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10
      };

      const result = await StudentService.getAllEnrollments(filters, pagination);
      
      res.json({
        success: true,
        data: result.enrollments,
        message: 'Enrollments retrieved successfully',
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve enrollments'
        }
      });
    }
  }

  static async updateEnrollment(req, res) {
    try {
      const { enrollmentId } = req.params;
      const updateData = req.body;

      const enrollment = await StudentService.updateEnrollment(enrollmentId, updateData, req.user.id);
      
      res.json({
        success: true,
        data: enrollment,
        message: 'Enrollment updated successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update enrollment'
        }
      });
    }
  }

  static async transferStudentClass(req, res) {
    try {
      const { enrollmentId } = req.params;
      const { newClassId, notes } = req.body;

      const enrollment = await StudentService.transferStudentClass(enrollmentId, newClassId, req.user.id, notes);
      
      res.json({
        success: true,
        data: enrollment,
        message: 'Student transferred to new class successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to transfer student class'
        }
      });
    }
  }

  // ID Card Generation
  static async generateIdCard(req, res) {
    try {
      const { studentId } = req.params;
      const idCardData = await StudentService.generateStudentIdCard(studentId);
      
      res.json({
        success: true,
        data: idCardData,
        message: 'Student ID card generated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate student ID card'
        }
      });
    }
  }

  // Bulk Operations
  static async bulkImportStudents(req, res) {
    try {
      const { students } = req.body;
      
      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Students array is required and must not be empty'
          }
        });
      }

      const results = await StudentService.bulkImportStudents(req.user.school_id, students, req.user.id);
      
      res.status(201).json({
        success: true,
        data: results,
        message: `Bulk import completed. ${results.successCount} students created, ${results.errorCount} errors.`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to bulk import students'
        }
      });
    }
  }

  // Statistics and Analytics
  static async getStudentStatistics(req, res) {
    try {
      const statistics = await StudentService.getStudentStatistics(req.user.school_id);
      
      res.json({
        success: true,
        data: statistics,
        message: 'Student statistics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve student statistics'
        }
      });
    }
  }

  static async getClassStatistics(req, res) {
    try {
      const { classId } = req.params;
      const statistics = await StudentService.getClassStatistics(classId);
      
      res.json({
        success: true,
        data: statistics,
        message: 'Class statistics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve class statistics'
        }
      });
    }
  }

  static async getEnrollmentStatistics(req, res) {
    try {
      const { academicYearId } = req.query;
      const statistics = await StudentService.getEnrollmentStatistics(req.user.school_id, academicYearId);
      
      res.json({
        success: true,
        data: statistics,
        message: 'Enrollment statistics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve enrollment statistics'
        }
      });
    }
  }

  // Dashboard
  static async getStudentDashboard(req, res) {
    try {
      const dashboard = await StudentService.getStudentDashboard(req.user.school_id);
      
      res.json({
        success: true,
        data: dashboard,
        message: 'Student dashboard data retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve student dashboard'
        }
      });
    }
  }

  // Reporting
  static async generateStudentReport(req, res) {
    try {
      const { filters } = req.body;
      const report = await StudentService.generateStudentReport(req.user.school_id, filters);
      
      res.json({
        success: true,
        data: report,
        message: 'Student report generated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate student report'
        }
      });
    }
  }

  static async generateClassReport(req, res) {
    try {
      const { academicYearId } = req.query;
      const report = await StudentService.generateClassReport(req.user.school_id, academicYearId);
      
      res.json({
        success: true,
        data: report,
        message: 'Class report generated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate class report'
        }
      });
    }
  }

  // Export
  static async exportStudentData(req, res) {
    try {
      const { format = 'json' } = req.query;
      const exportData = await StudentService.exportStudentData(req.user.school_id, format);
      
      res.json({
        success: true,
        data: exportData,
        message: 'Student data exported successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to export student data'
        }
      });
    }
  }

  // Utility Controllers
  static async getStudentsByClass(req, res) {
    try {
      const { classId } = req.params;
      const { enrollmentStatus } = req.query;
      
      const filters = { enrollmentStatus };
      const students = await StudentService.getStudentsByClass(classId, filters);
      
      res.json({
        success: true,
        data: students,
        message: 'Students by class retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve students by class'
        }
      });
    }
  }

  static async getStudentsByParent(req, res) {
    try {
      const { parentId } = req.params;
      const { enrollmentStatus } = req.query;
      
      const filters = { enrollmentStatus };
      const students = await StudentService.getStudentsByParent(parentId, filters);
      
      res.json({
        success: true,
        data: students,
        message: 'Students by parent retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve students by parent'
        }
      });
    }
  }

  // =============================================================================
  // MISSING STUDENT MANAGEMENT METHODS
  // =============================================================================

  static async getStudentAcademicHistory(req, res) {
    res.status(200).json({ success: true, message: 'Get student academic history - implementation pending', data: [] });
  }

  static async getStudentDisciplinaryRecords(req, res) {
    res.status(200).json({ success: true, message: 'Get student disciplinary records - implementation pending', data: [] });
  }

  static async addDisciplinaryRecord(req, res) {
    res.status(201).json({ success: true, message: 'Add disciplinary record - implementation pending', data: {} });
  }

  static async getStudentHealthRecords(req, res) {
    res.status(200).json({ success: true, message: 'Get student health records - implementation pending', data: [] });
  }

  static async addHealthRecord(req, res) {
    res.status(201).json({ success: true, message: 'Add health record - implementation pending', data: {} });
  }

  static async generateStudentIdCard(req, res) {
    res.status(201).json({ success: true, message: 'Generate student ID card - implementation pending', data: {} });
  }

  static async downloadStudentIdCard(req, res) {
    res.status(200).json({ success: true, message: 'Download student ID card - implementation pending', data: {} });
  }

  static async bulkGenerateIdCards(req, res) {
    res.status(201).json({ success: true, message: 'Bulk generate ID cards - implementation pending', data: {} });
  }

  static async initiateStudentTransfer(req, res) {
    res.status(201).json({ success: true, message: 'Initiate student transfer - implementation pending', data: {} });
  }

  static async getPendingTransfers(req, res) {
    res.status(200).json({ success: true, message: 'Get pending transfers - implementation pending', data: [] });
  }

  static async approveTransfer(req, res) {
    res.status(200).json({ success: true, message: 'Approve transfer - implementation pending', data: {} });
  }

  static async rejectTransfer(req, res) {
    res.status(200).json({ success: true, message: 'Reject transfer - implementation pending', data: {} });
  }
}

module.exports = StudentController; 