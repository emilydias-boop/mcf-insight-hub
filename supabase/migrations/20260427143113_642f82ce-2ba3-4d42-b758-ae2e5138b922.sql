CREATE OR REPLACE FUNCTION public.normalize_document(doc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(doc, ''), '[^0-9]', '', 'g'), '');
$$;