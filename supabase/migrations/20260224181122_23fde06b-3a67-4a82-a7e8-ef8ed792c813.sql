-- Preencher dados do cliente nos cadastros pendentes existentes
UPDATE consorcio_pending_registrations SET
  nome_completo = 'Kleber Donizetti Teixeira',
  telefone = '12982341050',
  email = 'kleber.teixeira@icloud.com',
  vendedor_name = 'Joao Pedro Martins Vieira',
  aceite_date = '2026-02-23'
WHERE id = '7f89af55-401d-4544-a2da-82de61149360';

UPDATE consorcio_pending_registrations SET
  nome_completo = 'João Ferreira dos Santos',
  telefone = '85 98894-6554',
  email = 'ferreiramsf@gmail.com',
  vendedor_name = 'Joao Pedro Martins Vieira',
  aceite_date = '2026-02-23'
WHERE id = '8da65cd8-3097-439b-aea9-840789db64f0';