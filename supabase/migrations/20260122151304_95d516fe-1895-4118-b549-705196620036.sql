-- Add is_archived column to crm_origins and crm_groups for soft delete functionality
ALTER TABLE public.crm_origins ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.crm_groups ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add indexes for better query performance when filtering archived items
CREATE INDEX IF NOT EXISTS idx_crm_origins_is_archived ON public.crm_origins(is_archived);
CREATE INDEX IF NOT EXISTS idx_crm_groups_is_archived ON public.crm_groups(is_archived);