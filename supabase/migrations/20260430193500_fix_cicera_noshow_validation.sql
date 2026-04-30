-- Corrige o registro de no_show_validations 1458519e... que foi gravado com
-- attendee_id incorreto (5c3db0a4..., um attendee deletado/recriado da Cicera,
-- da Mayara) quando na verdade a Julia estava marcando no-show da Wilza
-- (attendee 747da24b...). Causa: bug de fallback silencioso participants[0]
-- no AgendaMeetingDrawer + falta de guard server-side. Ambos corrigidos nesta release.
UPDATE public.no_show_validations
SET
  attendee_id = '747da24b-1fbe-45e1-84b1-67163e0b6131',
  deal_id     = 'e61d54ca-55ec-4d5a-8fa7-a92351a5e9a1',
  lead_phone  = '+5511992450709'
WHERE id = '1458519e-7b05-4631-85d0-de28de9484f9';
