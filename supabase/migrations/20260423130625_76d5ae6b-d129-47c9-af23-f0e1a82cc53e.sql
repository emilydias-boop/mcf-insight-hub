
-- Fix Leticia's squad history: she was in 'incorporador' until today, then moved to 'credito'
DO $$
DECLARE
  leticia_id UUID;
  transition_at TIMESTAMPTZ := now();
BEGIN
  SELECT id INTO leticia_id
  FROM public.sdr
  WHERE LOWER(email) = 'leticia.nunes@minhacasafinanciada.com'
  LIMIT 1;

  IF leticia_id IS NULL THEN
    RAISE NOTICE 'Leticia not found, skipping';
    RETURN;
  END IF;

  -- Remove any existing history rows for Leticia (clean slate)
  DELETE FROM public.sdr_squad_history WHERE sdr_id = leticia_id;

  -- Insert closed historical row: incorporador from her start until now
  INSERT INTO public.sdr_squad_history (sdr_id, squad, valid_from, valid_to)
  SELECT leticia_id, 'incorporador', s.created_at, transition_at
  FROM public.sdr s
  WHERE s.id = leticia_id;

  -- Insert open current row: credito from now onward
  INSERT INTO public.sdr_squad_history (sdr_id, squad, valid_from, valid_to)
  VALUES (leticia_id, 'credito', transition_at, NULL);
END $$;
