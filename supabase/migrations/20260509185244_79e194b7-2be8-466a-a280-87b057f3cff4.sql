ALTER TABLE public.automation_templates
ADD COLUMN IF NOT EXISTS business_units text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_automation_templates_business_units
ON public.automation_templates USING GIN (business_units);