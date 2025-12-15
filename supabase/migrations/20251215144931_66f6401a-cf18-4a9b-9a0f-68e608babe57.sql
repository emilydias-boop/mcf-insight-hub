-- Add new fields to activity_templates for script and SLA
ALTER TABLE activity_templates 
ADD COLUMN IF NOT EXISTS script_title TEXT,
ADD COLUMN IF NOT EXISTS script_body TEXT,
ADD COLUMN IF NOT EXISTS sla_offset_minutes INTEGER DEFAULT 60;

-- Add comment for clarity
COMMENT ON COLUMN activity_templates.script_title IS 'Title of the script/playbook for this activity';
COMMENT ON COLUMN activity_templates.script_body IS 'Markdown content with the activity script/playbook';
COMMENT ON COLUMN activity_templates.sla_offset_minutes IS 'Minutes after stage entry when this task is due';