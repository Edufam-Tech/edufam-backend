const classService = require('../services/classService');
const { logger } = require('../utils/debugger');

/**
 * Get all classes with pagination and filtering
 */
const getAllClasses = async (req, res) => {
  try {
    const { page = 1, limit = 10, schoolId, academicYearId, gradeLevel, status } = req.query;
    const filters = { schoolId, academicYearId, gradeLevel, status };
    
    const result = await classService.getAllClasses(parseInt(page), parseInt(limit), filters);
    
    res.json({
      success: true,
      message: 'Classes retrieved successfully',
      data: result.classes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting all classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve classes',
      error: error.message
    });
  }
};

/**
 * Get class by ID
 */
const getClassById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const classData = await classService.getClassById(parseInt(id));
    
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Class retrieved successfully',
      data: classData
    });
  } catch (error) {
    logger.error('Error getting class by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class',
      error: error.message
    });
  }
};

/**
 * Create new class
 */
const createClass = async (req, res) => {
  try {
    const classData = req.body;
    const { user } = req;
    
    // Add created by information
    classData.createdBy = user.id;
    
    const newClass = await classService.createClass(classData);
    
    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: newClass
    });
  } catch (error) {
    logger.error('Error creating class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create class',
      error: error.message
    });
  }
};

/**
 * Update class
 */
const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { user } = req;
    
    updateData.updatedBy = user.id;
    
    const updatedClass = await classService.updateClass(parseInt(id), updateData);
    
    if (!updatedClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Class updated successfully',
      data: updatedClass
    });
  } catch (error) {
    logger.error('Error updating class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update class',
      error: error.message
    });
  }
};

/**
 * Delete class
 */
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const deletedClass = await classService.deleteClass(parseInt(id), user.id);
    
    if (!deletedClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Class deleted successfully',
      data: deletedClass
    });
  } catch (error) {
    logger.error('Error deleting class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete class',
      error: error.message
    });
  }
};

/**
 * Get classes by school
 */
const getClassesBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 10, academicYearId, gradeLevel, status } = req.query;
    const filters = { academicYearId, gradeLevel, status };
    
    const result = await classService.getClassesBySchool(
      parseInt(schoolId), 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'School classes retrieved successfully',
      data: result.classes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting classes by school:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve school classes',
      error: error.message
    });
  }
};

/**
 * Get classes by academic year
 */
const getClassesByAcademicYear = async (req, res) => {
  try {
    const { academicYearId } = req.params;
    const { page = 1, limit = 10, schoolId, gradeLevel, status } = req.query;
    const filters = { schoolId, gradeLevel, status };
    
    const result = await classService.getClassesByAcademicYear(
      parseInt(academicYearId), 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'Academic year classes retrieved successfully',
      data: result.classes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting classes by academic year:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve academic year classes',
      error: error.message
    });
  }
};

/**
 * Get class students
 */
const getClassStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const filters = { status };
    
    const result = await classService.getClassStudents(
      parseInt(id), 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'Class students retrieved successfully',
      data: result.students,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting class students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class students',
      error: error.message
    });
  }
};

/**
 * Assign teacher to class
 */
const assignTeacherToClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;
    const { user } = req;
    
    const result = await classService.assignTeacherToClass(parseInt(id), parseInt(teacherId), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Class or teacher not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Teacher assigned to class successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error assigning teacher to class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign teacher to class',
      error: error.message
    });
  }
};

/**
 * Remove teacher from class
 */
const removeTeacherFromClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const result = await classService.removeTeacherFromClass(parseInt(id), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Teacher removed from class successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error removing teacher from class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove teacher from class',
      error: error.message
    });
  }
};

/**
 * Add student to class
 */
const addStudentToClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;
    const { user } = req;
    
    const result = await classService.addStudentToClass(parseInt(id), parseInt(studentId), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Class or student not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Student added to class successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error adding student to class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add student to class',
      error: error.message
    });
  }
};

/**
 * Remove student from class
 */
const removeStudentFromClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;
    const { user } = req;
    
    const result = await classService.removeStudentFromClass(parseInt(id), parseInt(studentId), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Class or student not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Student removed from class successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error removing student from class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove student from class',
      error: error.message
    });
  }
};

/**
 * Activate class
 */
const activateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const result = await classService.activateClass(parseInt(id), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Class activated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error activating class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate class',
      error: error.message
    });
  }
};

/**
 * Deactivate class
 */
const deactivateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const result = await classService.deactivateClass(parseInt(id), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Class deactivated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error deactivating class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate class',
      error: error.message
    });
  }
};

/**
 * Get class statistics
 */
const getClassStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    
    const statistics = await classService.getClassStatistics(parseInt(id));
    
    if (!statistics) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Class statistics retrieved successfully',
      data: statistics
    });
  } catch (error) {
    logger.error('Error getting class statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class statistics',
      error: error.message
    });
  }
};

/**
 * Search classes
 */
const searchClasses = async (req, res) => {
  try {
    const { q, page = 1, limit = 10, schoolId, academicYearId, gradeLevel } = req.query;
    const filters = { schoolId, academicYearId, gradeLevel };
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const result = await classService.searchClasses(q, parseInt(page), parseInt(limit), filters);
    
    res.json({
      success: true,
      message: 'Class search completed successfully',
      data: result.classes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error searching classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search classes',
      error: error.message
    });
  }
};

/**
 * Get classes overview statistics
 */
const getClassesOverview = async (req, res) => {
  try {
    const { schoolId, academicYearId } = req.query;
    const filters = { schoolId, academicYearId };
    
    const overview = await classService.getClassesOverview(filters);
    
    res.json({
      success: true,
      message: 'Classes overview retrieved successfully',
      data: overview
    });
  } catch (error) {
    logger.error('Error getting classes overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve classes overview',
      error: error.message
    });
  }
};

/**
 * Get classes by teacher
 */
const getClassesByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { page = 1, limit = 10, academicYearId, status } = req.query;
    const filters = { academicYearId, status };
    
    const result = await classService.getClassesByTeacher(
      parseInt(teacherId), 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'Teacher classes retrieved successfully',
      data: result.classes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting classes by teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve teacher classes',
      error: error.message
    });
  }
};

module.exports = {
  getAllClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  getClassesBySchool,
  getClassesByAcademicYear,
  getClassStudents,
  assignTeacherToClass,
  removeTeacherFromClass,
  addStudentToClass,
  removeStudentFromClass,
  activateClass,
  deactivateClass,
  getClassStatistics,
  searchClasses,
  getClassesOverview,
  getClassesByTeacher
}; 