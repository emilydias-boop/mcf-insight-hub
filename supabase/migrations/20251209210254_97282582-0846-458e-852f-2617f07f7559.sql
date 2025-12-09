-- Add notion_page_id column to playbook_reads for Notion integration
ALTER TABLE public.playbook_reads 
ADD COLUMN IF NOT EXISTS notion_page_id TEXT;

-- Create index for faster lookups by notion_page_id
CREATE INDEX IF NOT EXISTS idx_playbook_reads_notion_page_id 
ON public.playbook_reads (notion_page_id);