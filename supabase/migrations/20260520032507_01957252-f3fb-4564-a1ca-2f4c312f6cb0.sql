INSERT INTO public.automation_templates
  (name, channel, content, variables, variable_count, language, category, approval_status, business_units, is_active)
VALUES
  ('Confirmação R1 Agendada — Incorporador',
   'whatsapp',
   E'Olá {{nome}}! Aqui é da MCF Capital.\n\nSua reunião está confirmada para {{data_hora}} com {{closer}}.\n\nLink da chamada: {{link}}\n\nQualquer imprevisto, é só me responder por aqui.',
   ARRAY['nome','data_hora','closer','link'],
   4, 'pt_BR', 'utility', 'pending',
   ARRAY['incorporador'], false),
  ('Confirmação Reunião 01 — Incorporador (Anamnese/Indicação)',
   'whatsapp',
   E'Olá {{nome}}! Aqui é da MCF Capital.\n\nSua reunião de diagnóstico está confirmada para {{data_hora}} com {{closer}}.\n\nLink da chamada: {{link}}\n\nSe precisar reagendar, é só me avisar por aqui.',
   ARRAY['nome','data_hora','closer','link'],
   4, 'pt_BR', 'utility', 'pending',
   ARRAY['incorporador'], false);