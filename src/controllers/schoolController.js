const SchoolService = require('../services/schoolService');
const { ValidationError, NotFoundError, ConflictError, DatabaseError } = require('../middleware/errorHandler');

class SchoolController {
  // School Management Controllers

  // Create new school
  static async createSchool(req, res) {
    try {
      const schoolData = req.body;
      const createdBy = req.user.id;

      const result = await SchoolService.createSchool(schoolData, createdBy);

      res.status(201).json({
        success: true,
        message: 'School created successfully',
        data: result
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.message.split(', ')
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Create school error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create school'
      });
    }
  }

  // Get school by ID
  static async getSchool(req, res) {
    try {
      const { schoolId } = req.params;
      const schoolDetails = await SchoolService.getSchoolDetails(schoolId);

      res.json({
        success: true,
        data: schoolDetails
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Get school error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get school details'
      });
    }
  }

  // Get all schools
  static async getAllSchools(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        subscriptionStatus, 
        subscriptionType,
        isActive 
      } = req.query;

      const filters = {
        search,
        subscriptionStatus,
        subscriptionType,
        isActive: isActive === 'true'
      };

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await SchoolService.getAllSchools(filters, pagination);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get all schools error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get schools'
      });
    }
  }

  // Update school
  static async updateSchool(req, res) {
    try {
      const { schoolId } = req.params;
      const updateData = req.body;
      const updatedBy = req.user.id;

      const updatedSchool = await SchoolService.updateSchool(schoolId, updateData, updatedBy);

      res.json({
        success: true,
        message: 'School updated successfully',
        data: updatedSchool
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.message.split(', ')
        });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Update school error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update school'
      });
    }
  }

  // Deactivate school
  static async deactivateSchool(req, res) {
    try {
      const { schoolId } = req.params;
      const deactivatedBy = req.user.id;

      const deactivatedSchool = await SchoolService.deactivateSchool(schoolId, deactivatedBy);

      res.json({
        success: true,
        message: 'School deactivated successfully',
        data: deactivatedSchool
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Deactivate school error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate school'
      });
    }
  }

  // Reactivate school
  static async reactivateSchool(req, res) {
    try {
      const { schoolId } = req.params;
      const reactivatedBy = req.user.id;

      const reactivatedSchool = await SchoolService.reactivateSchool(schoolId, reactivatedBy);

      res.json({
        success: true,
        message: 'School reactivated successfully',
        data: reactivatedSchool
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Reactivate school error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reactivate school'
      });
    }
  }

  // Academic Year Controllers

  // Create academic year
  static async createAcademicYear(req, res) {
    try {
      const academicYearData = req.body;
      const createdBy = req.user.id;

      const academicYear = await SchoolService.createAcademicYear(academicYearData, createdBy);

      res.status(201).json({
        success: true,
        message: 'Academic year created successfully',
        data: academicYear
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.message.split(', ')
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Create academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create academic year'
      });
    }
  }

  // Get academic year with terms
  static async getAcademicYear(req, res) {
    try {
      const { academicYearId } = req.params;
      const academicYearDetails = await SchoolService.getAcademicYearWithTerms(academicYearId);

      res.json({
        success: true,
        data: academicYearDetails
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Get academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic year details'
      });
    }
  }

  // Get academic years for school
  static async getAcademicYears(req, res) {
    try {
      const { schoolId } = req.params;
      const { isActive, current } = req.query;

      const filters = {
        isActive: isActive === 'true',
        current: current === 'true'
      };

      const academicYears = await SchoolService.getAcademicYearsBySchool(schoolId, filters);

      res.json({
        success: true,
        data: academicYears
      });
    } catch (error) {
      console.error('Get academic years error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic years'
      });
    }
  }

  // Update academic year
  static async updateAcademicYear(req, res) {
    try {
      const { academicYearId } = req.params;
      const updateData = req.body;
      const updatedBy = req.user.id;

      const updatedYear = await SchoolService.updateAcademicYear(academicYearId, updateData, updatedBy);

      res.json({
        success: true,
        message: 'Academic year updated successfully',
        data: updatedYear
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.message.split(', ')
        });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Update academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update academic year'
      });
    }
  }

  // Set academic year as active
  static async setActiveAcademicYear(req, res) {
    try {
      const { academicYearId } = req.params;
      const updatedBy = req.user.id;

      const activeYear = await SchoolService.setActiveAcademicYear(academicYearId, updatedBy);

      res.json({
        success: true,
        message: 'Academic year set as active successfully',
        data: activeYear
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Set active academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set academic year as active'
      });
    }
  }

  // Academic Term Controllers

  // Create academic term
  static async createAcademicTerm(req, res) {
    try {
      const termData = req.body;
      const createdBy = req.user.id;

      const academicTerm = await SchoolService.createAcademicTerm(termData, createdBy);

      res.status(201).json({
        success: true,
        message: 'Academic term created successfully',
        data: academicTerm
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.message.split(', ')
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Create academic term error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create academic term'
      });
    }
  }

  // Get academic term details
  static async getAcademicTerm(req, res) {
    try {
      const { termId } = req.params;
      const termDetails = await SchoolService.getAcademicTermDetails(termId);

      res.json({
        success: true,
        data: termDetails
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Get academic term error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic term details'
      });
    }
  }

  // Get terms for academic year
  static async getAcademicTerms(req, res) {
    try {
      const { academicYearId } = req.params;
      const { isActive, curriculumType, current } = req.query;

      const filters = {
        isActive: isActive === 'true',
        curriculumType,
        current: current === 'true'
      };

      const terms = await SchoolService.getAcademicTermsByYear(academicYearId, filters);

      res.json({
        success: true,
        data: terms
      });
    } catch (error) {
      console.error('Get academic terms error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic terms'
      });
    }
  }

  // Update academic term
  static async updateAcademicTerm(req, res) {
    try {
      const { termId } = req.params;
      const updateData = req.body;
      const updatedBy = req.user.id;

      const updatedTerm = await SchoolService.updateAcademicTerm(termId, updateData, updatedBy);

      res.json({
        success: true,
        message: 'Academic term updated successfully',
        data: updatedTerm
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.message.split(', ')
        });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      if (error instanceof ConflictError) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Update academic term error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update academic term'
      });
    }
  }

  // Set academic term as active
  static async setActiveAcademicTerm(req, res) {
    try {
      const { termId } = req.params;
      const updatedBy = req.user.id;

      const activeTerm = await SchoolService.setActiveAcademicTerm(termId, updatedBy);

      res.json({
        success: true,
        message: 'Academic term set as active successfully',
        data: activeTerm
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Set active academic term error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set academic term as active'
      });
    }
  }

  // Bulk Operations Controllers

  // Create bulk terms
  static async createBulkTerms(req, res) {
    try {
      const { academicYearId } = req.params;
      const { terms } = req.body;
      const createdBy = req.user.id;

      if (!Array.isArray(terms) || terms.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Terms array is required and must not be empty'
        });
      }

      const result = await SchoolService.createBulkTerms(academicYearId, terms, createdBy);

      res.status(201).json({
        success: true,
        message: `Created ${result.successCount} terms successfully`,
        data: result
      });
    } catch (error) {
      console.error('Create bulk terms error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create bulk terms'
      });
    }
  }

  // Create default terms for curriculum
  static async createDefaultTerms(req, res) {
    try {
      const { academicYearId } = req.params;
      const { curriculumType } = req.body;
      const createdBy = req.user.id;

      if (!curriculumType) {
        return res.status(400).json({
          success: false,
          message: 'Curriculum type is required'
        });
      }

      const result = await SchoolService.createDefaultTermsForCurriculum(academicYearId, curriculumType, createdBy);

      res.status(201).json({
        success: true,
        message: `Created default terms for ${curriculumType} curriculum`,
        data: result
      });
    } catch (error) {
      console.error('Create default terms error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create default terms'
      });
    }
  }

  // School Configuration Controllers

  // Update school subscription
  static async updateSubscription(req, res) {
    try {
      const { schoolId } = req.params;
      const subscriptionData = req.body;
      const updatedBy = req.user.id;

      const updatedSchool = await SchoolService.updateSchoolSubscription(schoolId, subscriptionData, updatedBy);

      res.json({
        success: true,
        message: 'School subscription updated successfully',
        data: updatedSchool
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.message.split(', ')
        });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Update subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update school subscription'
      });
    }
  }

  // Get school configuration
  static async getSchoolConfiguration(req, res) {
    try {
      const { schoolId } = req.params;
      const configuration = await SchoolService.getSchoolConfiguration(schoolId);

      res.json({
        success: true,
        data: configuration
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Get school configuration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get school configuration'
      });
    }
  }

  // Dashboard and Reporting Controllers

  // Get school dashboard
  static async getSchoolDashboard(req, res) {
    try {
      const { schoolId } = req.params;
      const dashboard = await SchoolService.getSchoolDashboard(schoolId);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Get school dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get school dashboard'
      });
    }
  }

  // Generate school report
  static async generateReport(req, res) {
    try {
      const { schoolId } = req.params;
      const { reportType, dateRange } = req.body;

      const report = await SchoolService.generateSchoolReport(schoolId, reportType, dateRange);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Generate report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate school report'
      });
    }
  }

  // Export school data
  static async exportSchoolData(req, res) {
    try {
      const { schoolId } = req.params;
      const { exportType = 'all' } = req.query;

      const exportData = await SchoolService.exportSchoolData(schoolId, exportType);

      res.json({
        success: true,
        data: exportData
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Export school data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export school data'
      });
    }
  }

  // Search and Filter Controllers

  // Search schools
  static async searchSchools(req, res) {
    try {
      const { q: searchTerm, ...filters } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          message: 'Search term is required'
        });
      }

      const result = await SchoolService.searchSchools(searchTerm, filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Search schools error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search schools'
      });
    }
  }

  // Get schools by subscription type
  static async getSchoolsBySubscriptionType(req, res) {
    try {
      const { subscriptionType } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await SchoolService.getSchoolsBySubscriptionType(subscriptionType, pagination);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get schools by subscription type error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get schools by subscription type'
      });
    }
  }

  // Get schools by status
  static async getSchoolsByStatus(req, res) {
    try {
      const { status } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await SchoolService.getSchoolsByStatus(status, pagination);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get schools by status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get schools by status'
      });
    }
  }

  // Additional controller methods for routes

  // Get terms by curriculum
  static async getTermsByCurriculum(req, res) {
    try {
      const { schoolId, curriculumType } = req.params;
      const terms = await SchoolService.getTermsByCurriculum(schoolId, curriculumType);

      res.json({
        success: true,
        data: terms
      });
    } catch (error) {
      console.error('Get terms by curriculum error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get terms by curriculum'
      });
    }
  }

  // Get school statistics
  static async getSchoolStatistics(req, res) {
    try {
      const { schoolId } = req.params;
      const statistics = await SchoolService.getSchoolStatistics(schoolId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Get school statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get school statistics'
      });
    }
  }

  // Get academic year statistics
  static async getAcademicYearStatistics(req, res) {
    try {
      const { academicYearId } = req.params;
      const statistics = await SchoolService.getAcademicYearStatistics(academicYearId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Get academic year statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic year statistics'
      });
    }
  }

  // Get academic term statistics
  static async getAcademicTermStatistics(req, res) {
    try {
      const { termId } = req.params;
      const statistics = await SchoolService.getAcademicTermStatistics(termId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Get academic term statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic term statistics'
      });
    }
  }

  // Get current academic year
  static async getCurrentAcademicYear(req, res) {
    try {
      const { schoolId } = req.params;
      const currentYear = await SchoolService.getCurrentAcademicYear(schoolId);

      res.json({
        success: true,
        data: currentYear
      });
    } catch (error) {
      console.error('Get current academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get current academic year'
      });
    }
  }

  // Get current academic term
  static async getCurrentAcademicTerm(req, res) {
    try {
      const { schoolId } = req.params;
      const currentTerm = await SchoolService.getCurrentAcademicTerm(schoolId);

      res.json({
        success: true,
        data: currentTerm
      });
    } catch (error) {
      console.error('Get current academic term error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get current academic term'
      });
    }
  }

  // Validate school access
  static async validateSchoolAccess(req, res) {
    try {
      const { schoolId } = req.params;
      const userId = req.user.id;
      const userType = req.user.user_type;

      // For admin users, allow access to all schools
      if (userType === 'admin_user') {
        return res.json({
          success: true,
          message: 'Access granted',
          data: {
            hasAccess: true,
            accessLevel: 'admin'
          }
        });
      }

      // For school users, check if they belong to this school
      if (userType === 'school_user') {
        // Check if the user's school_id matches the requested schoolId
        const hasAccess = req.user.school_id && req.user.school_id.toString() === schoolId.toString();
        
        return res.json({
          success: true,
          message: hasAccess ? 'Access granted' : 'Access denied',
          data: {
            hasAccess,
            accessLevel: hasAccess ? 'school' : 'none'
          }
        });
      }

      // For other user types, deny access
      res.json({
        success: true,
        message: 'Access denied',
        data: {
          hasAccess: false,
          accessLevel: 'none'
        }
      });
    } catch (error) {
      console.error('Validate school access error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate school access'
      });
    }
  }

  // =============================================================================
  // MISSING SCHOOL MANAGEMENT METHODS (PLACEHOLDERS)
  // =============================================================================

  // Classes Management
  static async getClasses(req, res) {
    res.status(200).json({ success: true, message: 'Get classes endpoint - implementation pending', data: [] });
  }

  static async createClass(req, res) {
    res.status(201).json({ success: true, message: 'Create class endpoint - implementation pending', data: {} });
  }

  static async updateClass(req, res) {
    res.status(200).json({ success: true, message: 'Update class endpoint - implementation pending', data: {} });
  }

  static async deleteClass(req, res) {
    res.status(200).json({ success: true, message: 'Delete class endpoint - implementation pending' });
  }

  // Subjects Management
  static async getSubjects(req, res) {
    res.status(200).json({ success: true, message: 'Get subjects endpoint - implementation pending', data: [] });
  }

  static async createSubject(req, res) {
    res.status(201).json({ success: true, message: 'Create subject endpoint - implementation pending', data: {} });
  }

  static async getSubjectsByCurriculum(req, res) {
    res.status(200).json({ success: true, message: 'Get subjects by curriculum endpoint - implementation pending', data: [] });
  }

  // Teacher Assignments
  static async getTeacherAssignments(req, res) {
    res.status(200).json({ success: true, message: 'Get teacher assignments endpoint - implementation pending', data: [] });
  }

  static async createTeacherAssignment(req, res) {
    res.status(201).json({ success: true, message: 'Create teacher assignment endpoint - implementation pending', data: {} });
  }

  static async updateTeacherAssignment(req, res) {
    res.status(200).json({ success: true, message: 'Update teacher assignment endpoint - implementation pending', data: {} });
  }

  static async deleteTeacherAssignment(req, res) {
    res.status(200).json({ success: true, message: 'Delete teacher assignment endpoint - implementation pending' });
  }

  // Academic Years & Terms
  static async getAcademicYears(req, res) {
    res.status(200).json({ success: true, message: 'Get academic years endpoint - implementation pending', data: [] });
  }

  static async createAcademicYear(req, res) {
    res.status(201).json({ success: true, message: 'Create academic year endpoint - implementation pending', data: {} });
  }

  static async getAcademicTerms(req, res) {
    res.status(200).json({ success: true, message: 'Get academic terms endpoint - implementation pending', data: [] });
  }

  static async createAcademicTerm(req, res) {
    res.status(201).json({ success: true, message: 'Create academic term endpoint - implementation pending', data: {} });
  }

  static async updateAcademicYear(req, res) {
    res.status(200).json({ success: true, message: 'Update academic year endpoint - implementation pending', data: {} });
  }

  static async updateAcademicTerm(req, res) {
    res.status(200).json({ success: true, message: 'Update academic term endpoint - implementation pending', data: {} });
  }

  static async getSchoolSettings(req, res) {
    res.status(200).json({ success: true, message: 'Get school settings endpoint - implementation pending', data: {} });
  }

  static async updateSchoolSettings(req, res) {
    res.status(200).json({ success: true, message: 'Update school settings endpoint - implementation pending', data: {} });
  }

  static async getSchoolOverviewStatistics(req, res) {
    res.status(200).json({ success: true, message: 'Get school overview statistics endpoint - implementation pending', data: {} });
  }

  static async getAcademicPerformanceStatistics(req, res) {
    res.status(200).json({ success: true, message: 'Get academic performance statistics endpoint - implementation pending', data: {} });
  }

  static async getEnrollmentTrends(req, res) {
    res.status(200).json({ success: true, message: 'Get enrollment trends - implementation pending', data: {} });
  }

  // Get class analytics
  static async getClassAnalytics(req, res) {
    try {
      const filters = {
        academicYearId: req.query.academicYearId,
        curriculumType: req.query.curriculumType
      };

      const analytics = await SchoolService.getClassAnalytics(req.user.school_id, filters);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get class analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get class analytics'
      });
    }
  }
}

module.exports = SchoolController; 