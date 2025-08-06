const express = require('express');
const router = express.Router();
const transportController = require('../controllers/transportController');
const { authenticate, requireRole } = require('../middleware/auth');

// ==================== VEHICLE MANAGEMENT ====================

// Add vehicle
router.post('/vehicles', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.addVehicle
);

// List vehicles
router.get('/vehicles', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher']), 
  transportController.listVehicles
);

// Update vehicle
router.put('/vehicles/:id', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.updateVehicle
);

// Log vehicle maintenance
router.post('/vehicles/:id/maintenance', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.logMaintenance
);

// ==================== ROUTE MANAGEMENT ====================

// Create route
router.post('/routes', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.createRoute
);

// List routes
router.get('/routes', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher']), 
  transportController.listRoutes
);

// Update route
router.put('/routes/:id', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.updateRoute
);

// Add route stops
router.post('/routes/:id/stops', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.addRouteStops
);

// ==================== STUDENT TRANSPORT ASSIGNMENTS ====================

// Assign student to route
router.post('/transport/assign', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.assignStudentToRoute
);

// Get students for a route
router.get('/transport/students/:routeId', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher']), 
  transportController.getRouteStudents
);

// Remove student assignment
router.delete('/transport/:studentId/:routeId', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.removeStudentAssignment
);

// ==================== TRANSPORT ATTENDANCE ====================

// Mark transport attendance
router.post('/transport/attendance', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher']), 
  transportController.markTransportAttendance
);

// Get transport attendance for a date
router.get('/transport/attendance/:date', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher']), 
  transportController.getTransportAttendance
);

// ==================== TRANSPORT INCIDENTS ====================

// Report transport incident
router.post('/transport/incidents', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'teacher']), 
  transportController.reportIncident
);

// ==================== TRANSPORT FEES ====================

// Calculate transport fees
router.get('/transport/fees/:studentId', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr', 'finance']), 
  transportController.calculateTransportFees
);

// ==================== UTILITY ENDPOINTS ====================

// Get transport statistics
router.get('/transport/statistics', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.getTransportStatistics
);

// Get vehicles needing maintenance
router.get('/transport/maintenance-needed', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.getVehiclesNeedingMaintenance
);

// Get expiring licenses
router.get('/transport/expiring-licenses', 
  authenticate, 
  requireRole(['school_director', 'principal', 'hr']), 
  transportController.getExpiringLicenses
);

module.exports = router; 