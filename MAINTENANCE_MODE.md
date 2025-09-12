# Maintenance Mode Documentation

## Overview

The Edufam Backend includes a robust maintenance mode system that allows for scheduled maintenance windows and emergency maintenance activation. The system is designed to be fail-safe and never crash health checks or API endpoints.

## Features

- **Environment Override**: Quick global enable/disable via `MAINTENANCE_MODE=true`
- **Database-Driven**: Scheduled maintenance windows via `maintenance_mode` table
- **Fail-Safe**: Always falls back to inactive if database is unavailable
- **Comprehensive Logging**: Detailed logs for all maintenance operations
- **API Endpoints**: Dedicated endpoints for checking maintenance status

## Environment Variables

### MAINTENANCE_MODE

- **Type**: String
- **Values**: `'true'` | `'false'` | unset
- **Description**: Forces maintenance mode on/off globally
- **Priority**: Highest (overrides database settings)

```bash
# Enable maintenance mode
export MAINTENANCE_MODE=true

# Disable maintenance mode
export MAINTENANCE_MODE=false
# or
unset MAINTENANCE_MODE
```

## Database Schema

The `maintenance_mode` table stores scheduled maintenance windows:

```sql
CREATE TABLE maintenance_mode (
    id SERIAL PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT false,
    message TEXT,
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table Fields

- **id**: Unique identifier
- **is_active**: Whether this maintenance record is active
- **message**: User-friendly maintenance message
- **scheduled_start**: When maintenance should start (optional)
- **scheduled_end**: When maintenance should end (optional)
- **created_at**: Record creation timestamp
- **updated_at**: Record last update timestamp

## API Endpoints

### GET /health

Comprehensive health check including maintenance status.

**Response Format:**

```json
{
  "status": "OK" | "MAINTENANCE",
  "message": "Edufam Backend Server is running" | "Maintenance message",
  "database": "Connected" | "Disconnected",
  "maintenance": {
    "message": "System maintenance in progress",
    "scheduled_start": "2025-01-15T10:00:00Z",
    "scheduled_end": "2025-01-15T12:00:00Z",
    "source": "env" | "db" | "fallback"
  } | null,
  "timestamp": "2025-01-15T11:30:00Z",
  "environment": "production",
  "version": "1.0.0"
}
```

### GET /api/maintenance

Dedicated maintenance status endpoint for frontend applications.

**Response Format:**

```json
{
  "status": "OK" | "MAINTENANCE",
  "maintenance": {
    "message": "System maintenance in progress",
    "scheduled_start": "2025-01-15T10:00:00Z",
    "scheduled_end": "2025-01-15T12:00:00Z",
    "source": "env" | "db" | "fallback"
  } | null,
  "timestamp": "2025-01-15T11:30:00Z"
}
```

## Usage Examples

### 1. Emergency Maintenance (Environment Override)

```bash
# Enable emergency maintenance
export MAINTENANCE_MODE=true
npm run dev

# Check status
curl http://localhost:5000/api/maintenance
```

### 2. Scheduled Maintenance (Database)

```sql
-- Create a maintenance window
INSERT INTO maintenance_mode (is_active, message, scheduled_start, scheduled_end)
VALUES (true, 'Scheduled system maintenance', '2025-01-15 10:00:00', '2025-01-15 12:00:00');

-- End maintenance
UPDATE maintenance_mode SET is_active = false WHERE is_active = true;
```

### 3. Immediate Maintenance (Database)

```sql
-- Start immediate maintenance
INSERT INTO maintenance_mode (is_active, message)
VALUES (true, 'Emergency maintenance in progress');
```

## Testing Commands

### Test Health Endpoint

```bash
curl http://localhost:5000/health
```

### Test Maintenance Endpoint

```bash
curl http://localhost:5000/api/maintenance
```

### Test Environment Override

```bash
# Enable maintenance
MAINTENANCE_MODE=true curl http://localhost:5000/api/maintenance

# Disable maintenance
MAINTENANCE_MODE=false curl http://localhost:5000/api/maintenance
```

## Maintenance Mode Logic

The system checks maintenance status in the following order:

1. **Environment Variable**: If `MAINTENANCE_MODE=true`, maintenance is active
2. **Database Query**: Check `maintenance_mode` table for active records
3. **Time Validation**: Verify current time is within scheduled window
4. **Fallback**: If database is unavailable, maintenance is inactive

### Time Window Logic

- If `scheduled_start` is null: Maintenance starts immediately
- If `scheduled_end` is null: Maintenance continues indefinitely
- If current time < `scheduled_start`: Maintenance not yet active
- If current time > `scheduled_end`: Maintenance has expired

## Logging

The system provides comprehensive logging:

```
🔧 Maintenance mode: ENABLED via MAINTENANCE_MODE environment variable
🔧 Maintenance mode: ENABLED via database record
   Message: System maintenance in progress
   Period: 2025-01-15T10:00:00Z - 2025-01-15T12:00:00Z
🔧 Maintenance mode: DISABLED (no active records)
⚠️  Error checking maintenance mode in database: connection failed
🔧 Maintenance mode: DISABLED (database query failed - using fallback)
```

## Frontend Integration

### School App & Admin App

```javascript
// Check maintenance status
const response = await fetch('/api/maintenance');
const data = await response.json();

if (data.status === 'MAINTENANCE') {
  // Show maintenance page
  showMaintenancePage(data.maintenance.message);
}
```

### Mobile App

```dart
// Check maintenance status
final response = await http.get(Uri.parse('$baseUrl/api/maintenance'));
final data = jsonDecode(response.body);

if (data['status'] == 'MAINTENANCE') {
  // Show maintenance screen
  showMaintenanceScreen(data['maintenance']['message']);
}
```

## Error Handling

The maintenance system is designed to be fail-safe:

- **Database Unavailable**: Falls back to inactive maintenance
- **Invalid Time Data**: Logs error and treats as inactive
- **Missing Table**: Logs error and falls back to inactive
- **Network Issues**: Logs error and falls back to inactive

## Security Considerations

- Maintenance mode only affects API responses, not authentication
- Database queries are protected against SQL injection
- All maintenance operations are logged for audit purposes
- Environment variables are validated before use

## Monitoring

Monitor maintenance mode through:

1. **Health Endpoint**: `/health` includes maintenance status
2. **Dedicated Endpoint**: `/api/maintenance` for quick checks
3. **Server Logs**: Comprehensive logging of all operations
4. **Database Queries**: Monitor `maintenance_mode` table

## Troubleshooting

### Maintenance Mode Not Working

1. Check environment variable: `echo $MAINTENANCE_MODE`
2. Check database connection: `curl http://localhost:5000/health`
3. Check server logs for error messages
4. Verify `maintenance_mode` table exists

### Database Connection Issues

1. Check SSL configuration
2. Verify connection strings
3. Check network connectivity
4. Review database logs

### Time Zone Issues

- All timestamps are stored in UTC
- Server time should be synchronized
- Frontend should handle time zone conversion
