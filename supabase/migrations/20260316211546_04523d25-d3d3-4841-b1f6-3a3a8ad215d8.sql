
-- Trigger: auto-update stage_moved_at when stage_id changes
CREATE OR REPLACE FUNCTION public.update_stage_moved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_moved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_update_stage_moved_at
  BEFORE UPDATE ON crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stage_moved_at();
