const express = require('express');
const router = express.Router();
const transportController = require('../controllers/transportController');
const { authenticate, requireRole } = require('../middleware/auth');
const { query } = require('../config/database');

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

// ==================== REAL-TIME TRACKING (to satisfy frontend TRANSPORT.TRACKING) ====================

router.get('/tracking/vehicles',
  authenticate,
  async (req, res, next) => {
    try {
      const schoolId = req.user.schoolId || req.user.school_id;
      const result = await query(`
        SELECT 
          tv.id as vehicle_id,
          tv.vehicle_number as registration_number,
          COALESCE(tvl.latitude, NULL) as latitude,
          COALESCE(tvl.longitude, NULL) as longitude,
          COALESCE(tvl.speed, 0) as speed,
          COALESCE(tvl.heading, 0) as heading,
          COALESCE(tvl.status, 'offline') as status,
          COALESCE(tvl.timestamp, NOW()) as last_update,
          tv.capacity
        FROM transport_vehicles tv
        LEFT JOIN LATERAL (
          SELECT * FROM transport_vehicle_locations l
          WHERE l.vehicle_id = tv.id
          ORDER BY l.timestamp DESC
          LIMIT 1
        ) tvl ON true
        WHERE tv.school_id = $1
        ORDER BY tv.vehicle_number
      `, [schoolId]);
      const data = result.rows.map(r => ({
        vehicleId: r.vehicle_id,
        registrationNumber: r.registration_number,
        currentLocation: r.latitude && r.longitude ? { lat: Number(r.latitude), lng: Number(r.longitude) } : null,
        speed: Number(r.speed || 0),
        heading: Number(r.heading || 0),
        status: r.status || 'offline',
        lastUpdate: r.last_update,
        capacity: r.capacity,
      }));
      res.json({ success: true, data });
    } catch (e) {
      // If transport tables aren't provisioned yet, return safe default
      if (e && (e.code === '42P01' || e.code === '42501')) {
        return res.json({ success: true, data: [] });
      }
      next(e);
    }
  }
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
 
// Mobile convenience: current user's transport status
router.get('/status/me', authenticate, async (req, res, next) => {
  try {
    // Attempt to find the student's current assignment and vehicle position
    const userId = req.user.userId;
    const result = await query(`
      SELECT r.name as route, v.registration_number as vehicle, 
             st.eta, st.state, st.latitude as lat, st.longitude as lng
      FROM transport_assignments ta
      JOIN students s ON ta.student_id = s.id
      JOIN parent_students ps ON ps.student_id = s.id
      LEFT JOIN routes r ON ta.route_id = r.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN transport_status st ON v.id = st.vehicle_id
      WHERE ps.parent_id = $1
      ORDER BY ta.assigned_at DESC
      LIMIT 1
    `, [userId]);
    if (result.rows.length === 0) {
      return res.json({ success: true, data: { state: 'inactive' } });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    // If tables do not exist yet, return a safe default instead of 500
    if (e && (e.code === '42P01' || e.code === '42501')) {
      return res.json({ success: true, data: { state: 'inactive' } });
    }
    next(e);
  }
});

// Mobile convenience: current user's route polyline (parent view)
router.get('/route/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await query(`
      SELECT ts.latitude as lat, ts.longitude as lng, ts.recorded_at
      FROM transport_assignments ta
      JOIN students s ON ta.student_id = s.id
      JOIN parent_students ps ON ps.student_id = s.id
      JOIN routes r ON ta.route_id = r.id
      JOIN vehicles v ON r.vehicle_id = v.id
      JOIN transport_status ts ON ts.vehicle_id = v.id
      WHERE ps.parent_id = $1
      ORDER BY ts.recorded_at DESC
      LIMIT 50
    `, [userId]);
    res.json({ success: true, data: result.rows });
  } catch (e) {
    if (e && (e.code === '42P01' || e.code === '42501')) {
      return res.json({ success: true, data: [] });
    }
    next(e);
  }
});