ALTER TABLE public.consortium_cards
ADD COLUMN IF NOT EXISTS objetivo text;

COMMENT ON COLUMN public.consortium_cards.objetivo IS 'Objetivo da carta: auto | imovel';