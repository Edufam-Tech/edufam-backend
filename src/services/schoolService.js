const School = require('../models/school');
const AcademicYear = require('../models/academicYear');
const AcademicTerm = require('../models/academicTerm');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class SchoolService {
  // School Management Methods

  // Create new school
  static async createSchool(schoolData, createdBy) {
    try {
      // Validate school data
      const validationErrors = School.validateSchoolData(schoolData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      // Create school
      const school = await School.create(schoolData, createdBy);

      // Create default academic year for the school
      const currentYear = new Date().getFullYear();
      const academicYearData = {
        schoolId: school.id,
        name: `${currentYear}`,
        startDate: new Date(currentYear, 0, 1), // January 1st
        endDate: new Date(currentYear, 11, 31), // December 31st
        isActive: true,
        description: `Default academic year for ${school.name}`
      };

      const academicYear = await AcademicYear.create(academicYearData, createdBy);

      // Create default terms for the academic year
      const defaultTerms = [
        {
          name: 'Term 1',
          startDate: new Date(currentYear, 0, 1), // January
          endDate: new Date(currentYear, 3, 30), // April
          termNumber: 1,
          curriculumType: '8-4-4'
        },
        {
          name: 'Term 2',
          startDate: new Date(currentYear, 4, 1), // May
          endDate: new Date(currentYear, 7, 31), // August
          termNumber: 2,
          curriculumType: '8-4-4'
        },
        {
          name: 'Term 3',
          startDate: new Date(currentYear, 8, 1), // September
          endDate: new Date(currentYear, 11, 31), // December
          termNumber: 3,
          curriculumType: '8-4-4'
        }
      ];

      for (const termData of defaultTerms) {
        await AcademicTerm.create({
          ...termData,
          academicYearId: academicYear.id,
          isActive: termData.termNumber === 1 // Only first term is active by default
        }, createdBy);
      }

      return {
        school,
        academicYear,
        message: 'School created successfully with default academic year and terms'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get school with full details
  static async getSchoolDetails(schoolId) {
    try {
      const school = await School.findById(schoolId);
      const statistics = await School.getStatistics(schoolId);
      const currentAcademicYear = await AcademicYear.getCurrent(schoolId);
      const activeAcademicYear = await AcademicYear.getActive(schoolId);
      const currentTerm = await AcademicTerm.getCurrent(schoolId);

      return {
        school,
        statistics,
        currentAcademicYear,
        activeAcademicYear,
        currentTerm
      };
    } catch (error) {
      throw error;
    }
  }

  // Get all schools with advanced filtering
  static async getAllSchools(filters = {}, pagination = {}) {
    try {
      const result = await School.findAll(filters, pagination);
      
      // Add additional data for each school
      const schoolsWithDetails = await Promise.all(
        result.schools.map(async (school) => {
          const statistics = await School.getStatistics(school.id);
          const currentAcademicYear = await AcademicYear.getCurrent(school.id);
          
          return {
            ...school,
            statistics,
            currentAcademicYear
          };
        })
      );

      return {
        ...result,
        schools: schoolsWithDetails
      };
    } catch (error) {
      throw error;
    }
  }

  // Update school with validation
  static async updateSchool(schoolId, updateData, updatedBy) {
    try {
      // Validate update data
      const validationErrors = School.validateSchoolData(updateData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const updatedSchool = await School.update(schoolId, updateData, updatedBy);
      return updatedSchool;
    } catch (error) {
      throw error;
    }
  }

  // Academic Year Management Methods

  // Create academic year with validation
  static async createAcademicYear(academicYearData, createdBy) {
    try {
      // Validate academic year data
      const validationErrors = AcademicYear.validateAcademicYearData(academicYearData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      // Generate name if not provided
      if (!academicYearData.name && academicYearData.startDate && academicYearData.endDate) {
        academicYearData.name = AcademicYear.generateName(academicYearData.startDate, academicYearData.endDate);
      }

      const academicYear = await AcademicYear.create(academicYearData, createdBy);
      return academicYear;
    } catch (error) {
      throw error;
    }
  }

  // Get academic year with terms
  static async getAcademicYearWithTerms(academicYearId) {
    try {
      const academicYear = await AcademicYear.findById(academicYearId);
      const terms = await AcademicTerm.findByAcademicYear(academicYearId);
      const statistics = await AcademicYear.getStatistics(academicYearId);

      return {
        academicYear,
        terms,
        statistics
      };
    } catch (error) {
      throw error;
    }
  }

  // Academic Term Management Methods

  // Create academic term with validation
  static async createAcademicTerm(termData, createdBy) {
    try {
      // Validate academic term data
      const validationErrors = AcademicTerm.validateAcademicTermData(termData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const academicTerm = await AcademicTerm.create(termData, createdBy);
      return academicTerm;
    } catch (error) {
      throw error;
    }
  }

  // Get academic term with details
  static async getAcademicTermDetails(termId) {
    try {
      const academicTerm = await AcademicTerm.findById(termId);
      const statistics = await AcademicTerm.getStatistics(termId);
      const progress = AcademicTerm.getTermProgress(academicTerm);

      return {
        academicTerm,
        statistics,
        progress
      };
    } catch (error) {
      throw error;
    }
  }

  // Bulk Operations

  // Create multiple terms for an academic year
  static async createBulkTerms(academicYearId, termsData, createdBy) {
    try {
      const createdTerms = [];
      const errors = [];

      for (let i = 0; i < termsData.length; i++) {
        try {
          const termData = {
            ...termsData[i],
            academicYearId
          };

          const validationErrors = AcademicTerm.validateAcademicTermData(termData);
          if (validationErrors.length > 0) {
            errors.push(`Term ${i + 1}: ${validationErrors.join(', ')}`);
            continue;
          }

          const term = await AcademicTerm.create(termData, createdBy);
          createdTerms.push(term);
        } catch (error) {
          errors.push(`Term ${i + 1}: ${error.message}`);
        }
      }

      return {
        createdTerms,
        errors,
        successCount: createdTerms.length,
        errorCount: errors.length
      };
    } catch (error) {
      throw error;
    }
  }

  // Create default terms for curriculum type
  static async createDefaultTermsForCurriculum(academicYearId, curriculumType, createdBy) {
    try {
      const termNames = AcademicTerm.generateDefaultTermNames(curriculumType);
      const currentYear = new Date().getFullYear();
      
      const defaultTerms = termNames.map((name, index) => {
        const termNumber = index + 1;
        const startMonth = index * 4; // 4 months per term
        const endMonth = startMonth + 3;
        
        return {
          name,
          startDate: new Date(currentYear, startMonth, 1),
          endDate: new Date(currentYear, endMonth, 0), // Last day of the month
          termNumber,
          curriculumType,
          isActive: termNumber === 1 // Only first term is active
        };
      });

      return await this.createBulkTerms(academicYearId, defaultTerms, createdBy);
    } catch (error) {
      throw error;
    }
  }

  // School Configuration Methods

  // Update school subscription
  static async updateSchoolSubscription(schoolId, subscriptionData, updatedBy) {
    try {
      const updatedSchool = await School.updateSubscription(schoolId, subscriptionData, updatedBy);
      return updatedSchool;
    } catch (error) {
      throw error;
    }
  }

  // Get school configuration
  static async getSchoolConfiguration(schoolId) {
    try {
      const school = await School.findById(schoolId);
      const currentAcademicYear = await AcademicYear.getCurrent(schoolId);
      const activeAcademicYear = await AcademicYear.getActive(schoolId);
      const currentTerm = await AcademicTerm.getCurrent(schoolId);
      const allAcademicYears = await AcademicYear.findBySchool(schoolId);

      return {
        school,
        currentAcademicYear,
        activeAcademicYear,
        currentTerm,
        academicYears: allAcademicYears
      };
    } catch (error) {
      throw error;
    }
  }

  // Validation and Utility Methods

  // Validate school access
  static async validateSchoolAccess(schoolId, userId) {
    try {
      const school = await School.findById(schoolId);
      
      // Check if user has access to this school
      // This would typically check user roles and permissions
      // For now, we'll assume the user has access if the school exists
      
      return {
        hasAccess: true,
        school
      };
    } catch (error) {
      return {
        hasAccess: false,
        error: error.message
      };
    }
  }

  // Get school dashboard data
  static async getSchoolDashboard(schoolId) {
    try {
      const school = await School.findById(schoolId);
      const statistics = await School.getStatistics(schoolId);
      const currentAcademicYear = await AcademicYear.getCurrent(schoolId);
      const currentTerm = await AcademicTerm.getCurrent(schoolId);
      const activeAcademicYear = await AcademicYear.getActive(schoolId);
      const activeTerm = activeAcademicYear ? await AcademicTerm.getActive(activeAcademicYear.id) : null;

      // Get recent academic years
      const recentAcademicYears = await AcademicYear.findBySchool(schoolId, { current: false });
      const recentYears = recentAcademicYears.slice(0, 3); // Last 3 years

      return {
        school,
        statistics,
        currentAcademicYear,
        currentTerm,
        activeAcademicYear,
        activeTerm,
        recentAcademicYears: recentYears,
        dashboard: {
          totalStudents: statistics.total_students,
          totalStaff: statistics.total_staff,
          totalUsers: statistics.total_users,
          newStudentsThisMonth: statistics.new_students_month,
          newStaffThisMonth: statistics.new_staff_month,
          currentTermProgress: currentTerm ? AcademicTerm.getTermProgress(currentTerm) : 0
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Search and Filter Methods

  // Search schools
  static async searchSchools(searchTerm, filters = {}) {
    try {
      const searchFilters = {
        ...filters,
        search: searchTerm
      };

      const result = await School.findAll(searchFilters, { page: 1, limit: 20 });
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Get schools by subscription type
  static async getSchoolsBySubscriptionType(subscriptionType, pagination = {}) {
    try {
      const filters = { subscriptionType };
      const result = await School.findAll(filters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Get schools by status
  static async getSchoolsByStatus(status, pagination = {}) {
    try {
      const filters = { subscriptionStatus: status };
      const result = await School.findAll(filters, pagination);
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Reporting Methods

  // Generate school report
  static async generateSchoolReport(schoolId, reportType, dateRange = {}) {
    try {
      const school = await School.findById(schoolId);
      const statistics = await School.getStatistics(schoolId);
      const currentAcademicYear = await AcademicYear.getCurrent(schoolId);
      const currentTerm = await AcademicTerm.getCurrent(schoolId);

      const report = {
        school,
        statistics,
        currentAcademicYear,
        currentTerm,
        reportType,
        dateRange,
        generatedAt: new Date().toISOString()
      };

      // Add specific report data based on type
      switch (reportType) {
        case 'overview':
          report.data = {
            totalStudents: statistics.total_students,
            totalStaff: statistics.total_staff,
            totalUsers: statistics.total_users,
            newStudentsThisMonth: statistics.new_students_month,
            newStaffThisMonth: statistics.new_staff_month
          };
          break;
        case 'academic':
          if (currentAcademicYear) {
            const academicYearTerms = await AcademicTerm.findByAcademicYear(currentAcademicYear.id);
            report.data = {
              academicYear: currentAcademicYear,
              terms: academicYearTerms,
              currentTerm: currentTerm
            };
          }
          break;
        default:
          report.data = statistics;
      }

      return report;
    } catch (error) {
      throw error;
    }
  }

  // Export school data
  static async exportSchoolData(schoolId, exportType = 'all') {
    try {
      const school = await School.findById(schoolId);
      const academicYears = await AcademicYear.findBySchool(schoolId);
      
      let exportData = {
        school,
        academicYears: []
      };

      // Add academic years with terms
      for (const year of academicYears) {
        const terms = await AcademicTerm.findByAcademicYear(year.id);
        exportData.academicYears.push({
          ...year,
          terms
        });
      }

      // Add specific data based on export type
      if (exportType === 'academic' || exportType === 'all') {
        // Add academic data
      }

      if (exportType === 'financial' || exportType === 'all') {
        // Add financial data
      }

      return exportData;
    } catch (error) {
      throw error;
    }
  }

  // Additional methods for controller support

  // Get academic years for school
  static async getAcademicYearsBySchool(schoolId, filters = {}) {
    try {
      const academicYears = await AcademicYear.findBySchool(schoolId, filters);
      return academicYears;
    } catch (error) {
      throw error;
    }
  }

  // Update academic year with validation
  static async updateAcademicYear(academicYearId, updateData, updatedBy) {
    try {
      // Validate academic year data
      const validationErrors = AcademicYear.validateAcademicYearData(updateData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const academicYear = await AcademicYear.update(academicYearId, updateData, updatedBy);
      return academicYear;
    } catch (error) {
      throw error;
    }
  }

  // Set academic year as active
  static async setActiveAcademicYear(academicYearId, updatedBy) {
    try {
      const academicYear = await AcademicYear.setActive(academicYearId, updatedBy);
      return academicYear;
    } catch (error) {
      throw error;
    }
  }

  // Get academic terms by year
  static async getAcademicTermsByYear(academicYearId, filters = {}) {
    try {
      const terms = await AcademicTerm.findByAcademicYear(academicYearId, filters);
      return terms;
    } catch (error) {
      throw error;
    }
  }

  // Update academic term with validation
  static async updateAcademicTerm(termId, updateData, updatedBy) {
    try {
      // Validate academic term data
      const validationErrors = AcademicTerm.validateAcademicTermData(updateData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const academicTerm = await AcademicTerm.update(termId, updateData, updatedBy);
      return academicTerm;
    } catch (error) {
      throw error;
    }
  }

  // Set academic term as active
  static async setActiveAcademicTerm(termId, updatedBy) {
    try {
      const academicTerm = await AcademicTerm.setActive(termId, updatedBy);
      return academicTerm;
    } catch (error) {
      throw error;
    }
  }

  // Get terms by curriculum type
  static async getTermsByCurriculum(schoolId, curriculumType) {
    try {
      const terms = await AcademicTerm.findByCurriculumType(schoolId, curriculumType);
      return terms;
    } catch (error) {
      throw error;
    }
  }

  // Deactivate school
  static async deactivateSchool(schoolId, deactivatedBy) {
    try {
      const deactivatedSchool = await School.deactivate(schoolId, deactivatedBy);
      return deactivatedSchool;
    } catch (error) {
      throw error;
    }
  }

  // Reactivate school
  static async reactivateSchool(schoolId, reactivatedBy) {
    try {
      const reactivatedSchool = await School.reactivate(schoolId, reactivatedBy);
      return reactivatedSchool;
    } catch (error) {
      throw error;
    }
  }

  // Get school statistics
  static async getSchoolStatistics(schoolId) {
    try {
      const statistics = await School.getStatistics(schoolId);
      return statistics;
    } catch (error) {
      throw error;
    }
  }

  // Get academic year statistics
  static async getAcademicYearStatistics(academicYearId) {
    try {
      const statistics = await AcademicYear.getStatistics(academicYearId);
      return statistics;
    } catch (error) {
      throw error;
    }
  }

  // Get academic term statistics
  static async getAcademicTermStatistics(termId) {
    try {
      const statistics = await AcademicTerm.getStatistics(termId);
      return statistics;
    } catch (error) {
      throw error;
    }
  }

  // Get current academic year for a school
  static async getCurrentAcademicYear(schoolId) {
    try {
      const currentYear = await AcademicYear.getCurrent(schoolId);
      return currentYear;
    } catch (error) {
      throw error;
    }
  }

  // Get current academic term for a school
  static async getCurrentAcademicTerm(schoolId) {
    try {
      return await AcademicTerm.getCurrent(schoolId);
    } catch (error) {
      throw error;
    }
  }

  // Get class analytics
  static async getClassAnalytics(schoolId, filters = {}) {
    try {
      const { query } = require('../config/database');
      
      let sql = `
        WITH class_counts AS (
          SELECT 
            c.id,
            c.is_active,
            c.curriculum_type,
            c.capacity,
            -- derive enrollment from students table when current_enrollment column is absent
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.enrollment_status = 'active')::int AS derived_enrollment
          FROM classes c
          WHERE c.school_id = $1
        )
        SELECT 
          COUNT(id) as total_classes,
          COUNT(id) FILTER (WHERE is_active = true) as active_classes,
          COUNT(DISTINCT curriculum_type) as curriculum_types,
          AVG(derived_enrollment)::numeric(10,2) as average_enrollment,
          SUM(derived_enrollment) as total_students,
          COUNT(id) FILTER (WHERE derived_enrollment >= capacity * 0.9) as near_capacity_classes,
          COUNT(id) FILTER (WHERE derived_enrollment < capacity * 0.5) as under_enrolled_classes
        FROM class_counts
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      if (filters.academicYearId) {
        paramCount++;
        sql += ` AND c.academic_year_id = $${paramCount}`;
        params.push(filters.academicYearId);
      }

      if (filters.curriculumType) {
        paramCount++;
        sql += ` AND c.curriculum_type = $${paramCount}`;
        params.push(filters.curriculumType);
      }

      const result = await query(sql, params);
      const analytics = result.rows[0];

      // Calculate percentages
      analytics.enrollment_rate = analytics.total_classes > 0 
        ? Math.round((analytics.total_students / (analytics.total_classes * analytics.average_enrollment)) * 100) 
        : 0;
      
      analytics.capacity_utilization = analytics.total_classes > 0 
        ? Math.round((analytics.near_capacity_classes / analytics.total_classes) * 100) 
        : 0;

      return analytics;
    } catch (error) {
      throw new DatabaseError('Failed to get class analytics');
    }
  }
}

module.exports = SchoolService; 