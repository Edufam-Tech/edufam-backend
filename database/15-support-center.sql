-- Support Center core tables

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'support_tickets'
  ) THEN
    CREATE TABLE support_tickets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
      source VARCHAR(20) NOT NULL DEFAULT 'in_app' CHECK (source IN ('email','in_app','chat','phone')),
      classification VARCHAR(32) NOT NULL DEFAULT 'general' CHECK (
        classification IN ('technical','billing','academic','training','general','mpesa')
      ),
      priority VARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
      title TEXT NOT NULL,
      description TEXT,
      requester_email TEXT,
      requester_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      assigned_to_admin UUID REFERENCES users(id) ON DELETE SET NULL,
      sla_due_at TIMESTAMP,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_support_tickets_school ON support_tickets(school_id);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_classification ON support_tickets(classification);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'support_ticket_messages'
  ) THEN
    CREATE TABLE support_ticket_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
      sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('email','in_app','chat','phone')),
      direction VARCHAR(10) NOT NULL DEFAULT 'out' CHECK (direction IN ('in','out')),
      body TEXT NOT NULL,
      attachments JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'support_ticket_events'
  ) THEN
    CREATE TABLE support_ticket_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      actor_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket ON support_ticket_events(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_support_ticket_events_type ON support_ticket_events(event_type);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'knowledge_base_categories'
  ) THEN
    CREATE TABLE knowledge_base_categories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      school_type VARCHAR(20) CHECK (school_type IN ('day','boarding','primary','secondary')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'knowledge_base_articles'
  ) THEN
    CREATE TABLE knowledge_base_articles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      category_id UUID REFERENCES knowledge_base_categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      school_type VARCHAR(20) CHECK (school_type IN ('day','boarding','primary','secondary')),
      issue_tags TEXT[],
      mpesa_related BOOLEAN DEFAULT false,
      video_urls TEXT[],
      screenshots JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kb_articles_title ON knowledge_base_articles USING GIN (to_tsvector('english', title));
    CREATE INDEX IF NOT EXISTS idx_kb_articles_content ON knowledge_base_articles USING GIN (to_tsvector('english', content));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'support_sla_policies'
  ) THEN
    CREATE TABLE support_sla_policies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      plan_type VARCHAR(20) NOT NULL,
      priority VARCHAR(16) NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
      first_response_minutes INTEGER NOT NULL,
      resolution_minutes INTEGER NOT NULL,
      UNIQUE(plan_type, priority)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'support_satisfaction_feedback'
  ) THEN
    CREATE TABLE support_satisfaction_feedback (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END $$;

-- Seed default SLA policies for common plan types
INSERT INTO support_sla_policies (plan_type, priority, first_response_minutes, resolution_minutes)
SELECT * FROM (
  VALUES
    ('basic','low', 1440, 4320),
    ('basic','medium', 720, 2880),
    ('basic','high', 240, 1440),
    ('basic','urgent', 120, 720),
    ('standard','low', 720, 2880),
    ('standard','medium', 240, 1440),
    ('standard','high', 120, 720),
    ('standard','urgent', 60, 360),
    ('premium','low', 360, 1440),
    ('premium','medium', 120, 720),
    ('premium','high', 60, 360),
    ('premium','urgent', 30, 240)
) AS t(plan_type, priority, first_response_minutes, resolution_minutes)
WHERE NOT EXISTS (
  SELECT 1 FROM support_sla_policies p 
  WHERE p.plan_type = t.plan_type AND p.priority = t.priority
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'support_agent_skills'
  ) THEN
    CREATE TABLE support_agent_skills (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      issue_types TEXT[] DEFAULT '{}',
      skills TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_support_agent_skills_user ON support_agent_skills(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'support_canned_responses'
  ) THEN
    CREATE TABLE support_canned_responses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      classification VARCHAR(32) NOT NULL,
      body_template TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_support_canned_classification ON support_canned_responses(classification);
  END IF;
END $$;


