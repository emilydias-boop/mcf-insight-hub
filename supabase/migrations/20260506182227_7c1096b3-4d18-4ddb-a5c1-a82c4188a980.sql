ALTER TABLE public.consorcio_produtos
  ADD COLUMN IF NOT EXISTS comissao_schedule JSONB,
  ADD COLUMN IF NOT EXISTS comissao_base TEXT NOT NULL DEFAULT 'valor_credito'
    CHECK (comissao_base IN ('valor_credito', 'valor_parcela', 'valor_venda'));

COMMENT ON COLUMN public.consorcio_produtos.comissao_schedule IS
  'Array JSON: [{"parcela": 1, "percentual": 1.20}, ...]. Se NULL, usa fallback hardcoded por tipo (select/parcelinha).';
COMMENT ON COLUMN public.consorcio_produtos.comissao_base IS
  'Base de cálculo da comissão: valor_credito | valor_parcela | valor_venda.';