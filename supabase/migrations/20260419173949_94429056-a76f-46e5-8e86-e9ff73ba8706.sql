CREATE OR REPLACE FUNCTION public.log_deal_tags_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  added_tags TEXT[];
  removed_tags TEXT[];
  old_tags TEXT[];
  new_tags TEXT[];
  source_label TEXT;
  desc_parts TEXT[] := ARRAY[]::TEXT[];
  final_desc TEXT;
BEGIN
  old_tags := COALESCE(OLD.tags, ARRAY[]::TEXT[]);
  new_tags := COALESCE(NEW.tags, ARRAY[]::TEXT[]);

  SELECT COALESCE(array_agg(t), ARRAY[]::TEXT[]) INTO added_tags
    FROM unnest(new_tags) t WHERE t <> ALL(old_tags);
  SELECT COALESCE(array_agg(t), ARRAY[]::TEXT[]) INTO removed_tags
    FROM unnest(old_tags) t WHERE t <> ALL(new_tags);

  IF array_length(added_tags, 1) IS NULL AND array_length(removed_tags, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    source_label := 'manual';
  ELSIF NEW.data_source IS NOT NULL THEN
    source_label := NEW.data_source;
  ELSE
    source_label := 'system';
  END IF;

  IF array_length(added_tags, 1) IS NOT NULL THEN
    desc_parts := array_append(desc_parts, 'Adicionadas: ' || array_to_string(added_tags, ', '));
  END IF;
  IF array_length(removed_tags, 1) IS NOT NULL THEN
    desc_parts := array_append(desc_parts, 'Removidas: ' || array_to_string(removed_tags, ', '));
  END IF;
  final_desc := array_to_string(desc_parts, ' | ');

  INSERT INTO public.deal_activities (
    deal_id, activity_type, description, user_id, metadata, created_at
  ) VALUES (
    NEW.id::text,
    'tags_changed',
    final_desc,
    auth.uid(),
    jsonb_build_object(
      'added', to_jsonb(added_tags),
      'removed', to_jsonb(removed_tags),
      'previous', to_jsonb(old_tags),
      'new', to_jsonb(new_tags),
      'source', source_label
    ),
    now()
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_deal_tags_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_label TEXT;
BEGIN
  IF NEW.tags IS NULL OR array_length(NEW.tags, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    source_label := 'manual';
  ELSIF NEW.data_source IS NOT NULL THEN
    source_label := NEW.data_source;
  ELSE
    source_label := 'system';
  END IF;

  INSERT INTO public.deal_activities (
    deal_id, activity_type, description, user_id, metadata, created_at
  ) VALUES (
    NEW.id::text,
    'tags_added',
    'Tags iniciais: ' || array_to_string(NEW.tags, ', '),
    auth.uid(),
    jsonb_build_object(
      'added', to_jsonb(NEW.tags),
      'removed', '[]'::jsonb,
      'previous', '[]'::jsonb,
      'new', to_jsonb(NEW.tags),
      'source', source_label,
      'initial', true
    ),
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_deal_tags_change ON public.crm_deals;
CREATE TRIGGER trg_log_deal_tags_change
AFTER UPDATE OF tags ON public.crm_deals
FOR EACH ROW
WHEN (OLD.tags IS DISTINCT FROM NEW.tags)
EXECUTE FUNCTION public.log_deal_tags_change();

DROP TRIGGER IF EXISTS trg_log_deal_tags_insert ON public.crm_deals;
CREATE TRIGGER trg_log_deal_tags_insert
AFTER INSERT ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.log_deal_tags_insert();