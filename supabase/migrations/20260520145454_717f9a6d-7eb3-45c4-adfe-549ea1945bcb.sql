UPDATE public.automation_templates
SET content = replace(content,
  'Caso precise remarcar, responda esta mensagem.',
  'O especialista separou esse horário porque viu potencial no seu caso. Como a agenda é limitada, contamos com o seu comprometimento.'
),
updated_at = now()
WHERE id = '6ce02063-d194-4338-b48c-11cc331aafdb';