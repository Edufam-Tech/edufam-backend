-- Monitoring & Incidents supplemental schema (alerts, rules, logs, incidents)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- System logs used by monitoring controller
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs'
  ) THEN
    CREATE TABLE system_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('debug','info','warning','error','critical')),
      component VARCHAR(100),
      message TEXT NOT NULL,
      metadata JSONB,
      user_id UUID,
      school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
      ip_address INET,
      user_agent TEXT,
      logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_system_logs_level ON system_logs(log_level);
    CREATE INDEX idx_system_logs_component ON system_logs(component);
    CREATE INDEX idx_system_logs_logged_at ON system_logs(logged_at);
  END IF;
END $$;

-- Alert rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'alert_rules'
  ) THEN
    CREATE TABLE alert_rules (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      rule_name VARCHAR(150) NOT NULL UNIQUE,
      description TEXT,
      category VARCHAR(50) DEFAULT 'performance',
      conditions JSONB NOT NULL,
      actions JSONB NOT NULL,
      severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
      cooldown_minutes INTEGER DEFAULT 15,
      metadata JSONB,
      is_active BOOLEAN DEFAULT true,
      created_by UUID,
      created_by_name VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_alert_rules_active ON alert_rules(is_active);
    CREATE INDEX idx_alert_rules_category ON alert_rules(category);
  END IF;
END $$;

-- System alerts (active/resolved)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'system_alerts'
  ) THEN
    CREATE TABLE system_alerts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      alert_type VARCHAR(100) NOT NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('info','warning','high','critical')),
      category VARCHAR(50) DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      description TEXT,
      metadata JSONB,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
      auto_resolve BOOLEAN DEFAULT false,
      escalation_minutes INTEGER DEFAULT 30,
      created_by UUID,
      created_by_name VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP,
      resolved_by UUID,
      resolved_by_name VARCHAR(150),
      resolution TEXT
    );
    CREATE INDEX idx_system_alerts_status ON system_alerts(status);
    CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
    CREATE INDEX idx_system_alerts_created ON system_alerts(created_at);
  END IF;
END $$;

-- Incidents core tables
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'system_incidents'
  ) THEN
    CREATE TABLE system_incidents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      incident_number VARCHAR(40) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','monitoring','resolved','closed')),
      root_cause TEXT,
      detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP,
      created_by UUID,
      created_by_name VARCHAR(150)
    );
    CREATE INDEX idx_system_incidents_status ON system_incidents(status);
    CREATE INDEX idx_system_incidents_severity ON system_incidents(severity);
    CREATE INDEX idx_system_incidents_detected ON system_incidents(detected_at DESC);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'incident_events'
  ) THEN
    CREATE TABLE incident_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      incident_id UUID REFERENCES system_incidents(id) ON DELETE CASCADE,
      event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      event_type VARCHAR(50) NOT NULL,
      details JSONB,
      created_by UUID,
      created_by_name VARCHAR(150)
    );
    CREATE INDEX idx_incident_events_incident ON incident_events(incident_id);
    CREATE INDEX idx_incident_events_time ON incident_events(event_time DESC);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'incident_school_impacts'
  ) THEN
    CREATE TABLE incident_school_impacts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      incident_id UUID REFERENCES system_incidents(id) ON DELETE CASCADE,
      school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
      impact_level VARCHAR(20) NOT NULL CHECK (impact_level IN ('none','minor','moderate','major')),
      downtime_minutes INTEGER DEFAULT 0,
      estimated_financial_impact DECIMAL(14,2) DEFAULT 0,
      notes TEXT
    );
    CREATE INDEX idx_incident_impacts_incident ON incident_school_impacts(incident_id);
    CREATE INDEX idx_incident_impacts_school ON incident_school_impacts(school_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'incident_post_mortems'
  ) THEN
    CREATE TABLE incident_post_mortems (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      incident_id UUID REFERENCES system_incidents(id) ON DELETE CASCADE,
      summary TEXT,
      timeline JSONB,
      contributing_factors JSONB,
      corrective_actions JSONB,
      lessons_learned JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by UUID,
      created_by_name VARCHAR(150)
    );
    CREATE INDEX idx_post_mortems_incident ON incident_post_mortems(incident_id);
  END IF;
END $$;


