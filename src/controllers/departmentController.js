const departmentService = require('../services/departmentService');
const { logger } = require('../utils/debugger');

/**
 * Get all departments with pagination and filtering
 */
const getAllDepartments = async (req, res) => {
  try {
    const { page = 1, limit = 10, schoolId, status } = req.query;
    const filters = { schoolId, status };
    
    const result = await departmentService.getAllDepartments(parseInt(page), parseInt(limit), filters);
    
    res.json({
      success: true,
      message: 'Departments retrieved successfully',
      data: result.departments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting all departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve departments',
      error: error.message
    });
  }
};

/**
 * Get department by ID
 */
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const department = await departmentService.getDepartmentById(parseInt(id));
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department retrieved successfully',
      data: department
    });
  } catch (error) {
    logger.error('Error getting department by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department',
      error: error.message
    });
  }
};

/**
 * Create new department
 */
const createDepartment = async (req, res) => {
  try {
    const departmentData = req.body;
    const { user } = req;
    
    // Add created by information
    departmentData.createdBy = user.id;
    
    const newDepartment = await departmentService.createDepartment(departmentData);
    
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: newDepartment
    });
  } catch (error) {
    logger.error('Error creating department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create department',
      error: error.message
    });
  }
};

/**
 * Update department
 */
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { user } = req;
    
    updateData.updatedBy = user.id;
    
    const updatedDepartment = await departmentService.updateDepartment(parseInt(id), updateData);
    
    if (!updatedDepartment) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment
    });
  } catch (error) {
    logger.error('Error updating department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update department',
      error: error.message
    });
  }
};

/**
 * Delete department
 */
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const deletedDepartment = await departmentService.deleteDepartment(parseInt(id), user.id);
    
    if (!deletedDepartment) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department deleted successfully',
      data: deletedDepartment
    });
  } catch (error) {
    logger.error('Error deleting department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete department',
      error: error.message
    });
  }
};

/**
 * Get departments by school
 */
const getDepartmentsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const filters = { status };
    
    const result = await departmentService.getDepartmentsBySchool(
      parseInt(schoolId), 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'School departments retrieved successfully',
      data: result.departments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting departments by school:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve school departments',
      error: error.message
    });
  }
};

/**
 * Get department staff
 */
const getDepartmentStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, role, status } = req.query;
    const filters = { role, status };
    
    const result = await departmentService.getDepartmentStaff(
      parseInt(id), 
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    res.json({
      success: true,
      message: 'Department staff retrieved successfully',
      data: result.staff,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error getting department staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department staff',
      error: error.message
    });
  }
};

/**
 * Assign department head
 */
const assignDepartmentHead = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId } = req.body;
    const { user } = req;
    
    const result = await departmentService.assignDepartmentHead(parseInt(id), parseInt(staffId), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Department or staff member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department head assigned successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error assigning department head:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign department head',
      error: error.message
    });
  }
};

/**
 * Remove department head
 */
const removeDepartmentHead = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const result = await departmentService.removeDepartmentHead(parseInt(id), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department head removed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error removing department head:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove department head',
      error: error.message
    });
  }
};

/**
 * Activate department
 */
const activateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const result = await departmentService.activateDepartment(parseInt(id), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department activated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error activating department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate department',
      error: error.message
    });
  }
};

/**
 * Deactivate department
 */
const deactivateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const result = await departmentService.deactivateDepartment(parseInt(id), user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department deactivated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error deactivating department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate department',
      error: error.message
    });
  }
};

/**
 * Get department statistics
 */
const getDepartmentStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    
    const statistics = await departmentService.getDepartmentStatistics(parseInt(id));
    
    if (!statistics) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department statistics retrieved successfully',
      data: statistics
    });
  } catch (error) {
    logger.error('Error getting department statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department statistics',
      error: error.message
    });
  }
};

/**
 * Search departments
 */
const searchDepartments = async (req, res) => {
  try {
    const { q, page = 1, limit = 10, schoolId, status } = req.query;
    const filters = { schoolId, status };
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const result = await departmentService.searchDepartments(q, parseInt(page), parseInt(limit), filters);
    
    res.json({
      success: true,
      message: 'Department search completed successfully',
      data: result.departments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error searching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search departments',
      error: error.message
    });
  }
};

/**
 * Get departments overview statistics
 */
const getDepartmentsOverview = async (req, res) => {
  try {
    const { schoolId } = req.query;
    const filters = { schoolId };
    
    const overview = await departmentService.getDepartmentsOverview(filters);
    
    res.json({
      success: true,
      message: 'Departments overview retrieved successfully',
      data: overview
    });
  } catch (error) {
    logger.error('Error getting departments overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve departments overview',
      error: error.message
    });
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentsBySchool,
  getDepartmentStaff,
  assignDepartmentHead,
  removeDepartmentHead,
  activateDepartment,
  deactivateDepartment,
  getDepartmentStatistics,
  searchDepartments,
  getDepartmentsOverview
}; 