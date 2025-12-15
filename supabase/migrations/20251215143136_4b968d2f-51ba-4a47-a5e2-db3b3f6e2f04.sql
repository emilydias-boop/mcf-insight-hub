-- Create enums for activity types and status
CREATE TYPE activity_task_type AS ENUM ('call', 'whatsapp', 'email', 'meeting', 'other');
CREATE TYPE activity_task_status AS ENUM ('pending', 'done', 'canceled');

-- Create activity_templates table (global templates managed by admin/coordenador)
CREATE TABLE activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type activity_task_type NOT NULL DEFAULT 'other',
  origin_id UUID REFERENCES crm_origins(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES crm_stages(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  default_due_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Create deal_tasks table (per-deal instances)
CREATE TABLE deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  template_id UUID REFERENCES activity_templates(id) ON DELETE SET NULL,
  owner_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  type activity_task_type NOT NULL DEFAULT 'other',
  due_date TIMESTAMPTZ,
  status activity_task_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_templates
CREATE POLICY "Authenticated users can view active templates"
ON activity_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordenadores can manage templates"
ON activity_templates FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordenador'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordenador'::app_role)
);

-- RLS Policies for deal_tasks
CREATE POLICY "Authenticated users can view tasks"
ON deal_tasks FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordenadores can create tasks"
ON deal_tasks FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordenador'::app_role)
);

CREATE POLICY "Admins and coordenadores can update all tasks"
ON deal_tasks FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordenador'::app_role)
);

CREATE POLICY "SDR and closer can update task status"
ON deal_tasks FOR UPDATE
USING (
  has_role(auth.uid(), 'sdr'::app_role) OR 
  has_role(auth.uid(), 'closer'::app_role)
);

CREATE POLICY "Admins can delete tasks"
ON deal_tasks FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_activity_templates_origin_stage ON activity_templates(origin_id, stage_id) WHERE is_active = true;
CREATE INDEX idx_deal_tasks_deal_id ON deal_tasks(deal_id);
CREATE INDEX idx_deal_tasks_status ON deal_tasks(status);
CREATE INDEX idx_deal_tasks_completed_at ON deal_tasks(completed_at) WHERE completed_at IS NOT NULL;

-- Create view for monthly stats report
CREATE VIEW deal_task_stats_monthly AS
SELECT 
  completed_by,
  DATE_TRUNC('month', completed_at) AS month,
  template_id,
  type,
  COUNT(*) FILTER (WHERE status = 'pending') AS tasks_pending,
  COUNT(*) FILTER (WHERE status = 'done') AS tasks_completed,
  COUNT(*) FILTER (WHERE status = 'canceled') AS tasks_canceled,
  COUNT(*) AS tasks_total,
  COUNT(*) FILTER (WHERE status = 'done' AND completed_at > due_date) AS overdue_completed,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'done')::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) AS completion_rate
FROM deal_tasks
WHERE completed_at IS NOT NULL
GROUP BY completed_by, DATE_TRUNC('month', completed_at), template_id, type;