const Student = require('../models/student');
const Class = require('../models/class');
const Enrollment = require('../models/enrollment');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class StudentService {
  // Student Management Methods
  static async createStudent(studentData, createdBy) {
    try {
      // Validate student data
      const validationErrors = Student.validateStudentData(studentData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      // Generate admission number if not provided
      if (!studentData.admissionNumber) {
        studentData.admissionNumber = await Student.generateAdmissionNumber(studentData.schoolId);
      }

      const student = await Student.create(studentData, createdBy);
      return student;
    } catch (error) {
      throw error;
    }
  }

  static async getStudentDetails(studentId, userId) {
    try {
      const student = await Student.findById(studentId);
      
      // Get student's enrollment history
      const enrollments = await Enrollment.findAll({ studentId: studentId });
      
      // Get class details if assigned
      let classDetails = null;
      if (student.class_id) {
        classDetails = await Class.findById(student.class_id);
      }

      return {
        student,
        enrollments: enrollments.enrollments,
        classDetails
      };
    } catch (error) {
      throw error;
    }
  }

  static async getAllStudents(filters = {}, pagination = {}) {
    try {
      const result = await Student.findAll(filters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async updateStudent(studentId, updateData, updatedBy) {
    try {
      // Validate update data
      if (updateData.firstName || updateData.lastName || updateData.dateOfBirth || updateData.gender) {
        const validationData = {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          dateOfBirth: updateData.dateOfBirth,
          gender: updateData.gender
        };
        const validationErrors = Student.validateStudentData(validationData);
        if (validationErrors.length > 0) {
          throw new ValidationError(validationErrors.join(', '));
        }
      }

      const student = await Student.update(studentId, updateData, updatedBy);
      return student;
    } catch (error) {
      throw error;
    }
  }

  static async deactivateStudent(studentId, deactivatedBy) {
    try {
      const student = await Student.deactivate(studentId, deactivatedBy);
      return student;
    } catch (error) {
      throw error;
    }
  }

  static async reactivateStudent(studentId, reactivatedBy) {
    try {
      const student = await Student.reactivate(studentId, reactivatedBy);
      return student;
    } catch (error) {
      throw error;
    }
  }

  // Class Management Methods
  static async createClass(classData, createdBy) {
    try {
      // Validate class data
      const validationErrors = Class.validateClassData(classData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const classRecord = await Class.create(classData, createdBy);
      return classRecord;
    } catch (error) {
      throw error;
    }
  }

  static async getClassDetails(classId) {
    try {
      const classRecord = await Class.findById(classId);
      
      // Get students in this class
      const students = await Student.findByClass(classId);
      
      // Get class statistics
      const statistics = await Class.getStatistics(classId);

      return {
        class: classRecord,
        students,
        statistics
      };
    } catch (error) {
      throw error;
    }
  }

  static async getAllClasses(filters = {}, pagination = {}) {
    try {
      const result = await Class.findAll(filters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async updateClass(classId, updateData, updatedBy) {
    try {
      // Validate update data
      if (updateData.name || updateData.gradeLevel || updateData.capacity) {
        const validationData = {
          name: updateData.name,
          gradeLevel: updateData.gradeLevel,
          capacity: updateData.capacity,
          curriculumType: updateData.curriculumType
        };
        const validationErrors = Class.validateClassData(validationData);
        if (validationErrors.length > 0) {
          throw new ValidationError(validationErrors.join(', '));
        }
      }

      const classRecord = await Class.update(classId, updateData, updatedBy);
      return classRecord;
    } catch (error) {
      throw error;
    }
  }

  // Enrollment Management Methods
  static async enrollStudent(enrollmentData, createdBy) {
    try {
      // Validate enrollment data
      const validationErrors = Enrollment.validateEnrollmentData(enrollmentData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const enrollment = await Enrollment.create(enrollmentData, createdBy);
      return enrollment;
    } catch (error) {
      throw error;
    }
  }

  static async getEnrollmentDetails(enrollmentId) {
    try {
      const enrollment = await Enrollment.findById(enrollmentId);
      return enrollment;
    } catch (error) {
      throw error;
    }
  }

  static async getAllEnrollments(filters = {}, pagination = {}) {
    try {
      const result = await Enrollment.findAll(filters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async updateEnrollment(enrollmentId, updateData, updatedBy) {
    try {
      const enrollment = await Enrollment.update(enrollmentId, updateData, updatedBy);
      return enrollment;
    } catch (error) {
      throw error;
    }
  }

  static async transferStudentClass(enrollmentId, newClassId, updatedBy, notes = '') {
    try {
      const enrollment = await Enrollment.transferClass(enrollmentId, newClassId, updatedBy, notes);
      return enrollment;
    } catch (error) {
      throw error;
    }
  }

  // ID Card Generation
  static async generateStudentIdCard(studentId) {
    try {
      const idCardData = await Student.generateIdCard(studentId);
      return idCardData;
    } catch (error) {
      throw error;
    }
  }

  // Bulk Operations
  static async bulkImportStudents(schoolId, studentsData, createdBy) {
    try {
      const results = await Student.bulkImport(schoolId, studentsData, createdBy);
      return results;
    } catch (error) {
      throw error;
    }
  }

  // Search and Filter Methods
  static async searchStudents(schoolId, searchTerm, filters = {}, pagination = {}) {
    try {
      const searchFilters = {
        ...filters,
        schoolId,
        search: searchTerm
      };
      
      const result = await Student.findAll(searchFilters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getStudentsByClass(classId, filters = {}) {
    try {
      const students = await Student.findByClass(classId, filters);
      return students;
    } catch (error) {
      throw error;
    }
  }

  static async getStudentsByParent(parentId, filters = {}) {
    try {
      const students = await Student.findByParent(parentId, filters);
      return students;
    } catch (error) {
      throw error;
    }
  }

  // Statistics and Analytics
  static async getStudentStatistics(schoolId) {
    try {
      const statistics = await Student.getStatistics(schoolId);
      return statistics;
    } catch (error) {
      throw error;
    }
  }

  static async getClassStatistics(classId) {
    try {
      const statistics = await Class.getStatistics(classId);
      return statistics;
    } catch (error) {
      throw error;
    }
  }

  static async getEnrollmentStatistics(schoolId, academicYearId = null) {
    try {
      const statistics = await Enrollment.getStatistics(schoolId, academicYearId);
      return statistics;
    } catch (error) {
      throw error;
    }
  }

  // Dashboard Data
  static async getStudentDashboard(schoolId) {
    try {
      const [
        studentStats,
        classStats,
        enrollmentStats,
        recentStudents,
        recentEnrollments
      ] = await Promise.all([
        Student.getStatistics(schoolId),
        Class.findAll({ schoolId, isActive: true }, { page: 1, limit: 5 }),
        Enrollment.getStatistics(schoolId),
        Student.findAll({ schoolId, isActive: true }, { page: 1, limit: 10 }),
        Enrollment.findAll({ schoolId, isActive: true }, { page: 1, limit: 10 })
      ]);

      return {
        studentStatistics: studentStats,
        classOverview: classStats,
        enrollmentStatistics: enrollmentStats,
        recentStudents: recentStudents.students,
        recentEnrollments: recentEnrollments.enrollments
      };
    } catch (error) {
      throw error;
    }
  }

  // Validation and Utility Methods
  static async validateStudentAccess(studentId, userId, userType, schoolId) {
    try {
      const student = await Student.findById(studentId);
      
      // Check if user has access to this student
      if (userType === 'school_user' && student.school_id !== schoolId) {
        throw new ValidationError('Access denied to this student');
      }
      
      return student;
    } catch (error) {
      throw error;
    }
  }

  static async validateClassAccess(classId, userId, userType, schoolId) {
    try {
      const classRecord = await Class.findById(classId);
      
      // Check if user has access to this class
      if (userType === 'school_user' && classRecord.school_id !== schoolId) {
        throw new ValidationError('Access denied to this class');
      }
      
      return classRecord;
    } catch (error) {
      throw error;
    }
  }

  // Reporting Methods
  static async generateStudentReport(schoolId, filters = {}) {
    try {
      const students = await Student.findAll({ schoolId, ...filters }, { page: 1, limit: 1000 });
      const statistics = await Student.getStatistics(schoolId);
      
      return {
        students: students.students,
        statistics,
        generatedAt: new Date().toISOString(),
        filters
      };
    } catch (error) {
      throw error;
    }
  }

  static async generateClassReport(schoolId, academicYearId = null) {
    try {
      const filters = { schoolId, isActive: true };
      if (academicYearId) {
        filters.academicYearId = academicYearId;
      }
      
      const classes = await Class.findAll(filters, { page: 1, limit: 1000 });
      
      // Get statistics for each class
      const classesWithStats = await Promise.all(
        classes.classes.map(async (classRecord) => {
          const stats = await Class.getStatistics(classRecord.id);
          return { ...classRecord, statistics: stats };
        })
      );
      
      return {
        classes: classesWithStats,
        totalClasses: classes.pagination.total,
        generatedAt: new Date().toISOString(),
        academicYearId
      };
    } catch (error) {
      throw error;
    }
  }

  // Export Methods
  static async exportStudentData(schoolId, format = 'json') {
    try {
      const students = await Student.findAll({ schoolId, isActive: true }, { page: 1, limit: 10000 });
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCSV(students.students);
        return {
          data: csvData,
          format: 'csv',
          filename: `students_${schoolId}_${new Date().toISOString().split('T')[0]}.csv`
        };
      }
      
      return {
        data: students.students,
        format: 'json',
        filename: `students_${schoolId}_${new Date().toISOString().split('T')[0]}.json`
      };
    } catch (error) {
      throw error;
    }
  }

  // Helper method to convert data to CSV
  static convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
}

module.exports = StudentService; 