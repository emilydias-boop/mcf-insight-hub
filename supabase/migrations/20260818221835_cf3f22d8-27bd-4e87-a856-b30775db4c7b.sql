UPDATE consortium_cards c SET origem = o.name
  FROM consorcio_origem_options o WHERE c.origem = o.id::text;

UPDATE consorcio_pending_registrations p SET origem = o.name
  FROM consorcio_origem_options o WHERE p.origem = o.id::text;