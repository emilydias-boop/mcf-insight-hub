ALTER TABLE public.closers DROP CONSTRAINT IF EXISTS closers_email_bu_unique;
ALTER TABLE public.closers ADD CONSTRAINT closers_email_bu_meeting_type_unique UNIQUE (email, bu, meeting_type);

INSERT INTO public.closers (employee_id, name, email, meeting_type, bu, is_active, priority, color)
SELECT '658d8372-a2dd-4acc-82e3-89a221bc3e94'::uuid,
       'Nicola Ricci',
       'nicola.ricci@minhacasafinanciada.com',
       t.mt,
       'incorporador',
       true,
       99,
       '#0EA5E9'
FROM (VALUES ('r1'),('r2')) AS t(mt)
WHERE NOT EXISTS (
  SELECT 1 FROM public.closers c
  WHERE lower(c.email) = 'nicola.ricci@minhacasafinanciada.com'
    AND c.bu = 'incorporador'
    AND c.meeting_type = t.mt
);