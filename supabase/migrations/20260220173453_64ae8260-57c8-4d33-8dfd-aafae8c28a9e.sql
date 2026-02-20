
-- Fase 1: Novos campos + numero automatico + validacoes

-- 1. Adicionar novas colunas
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS garantia_inicio date;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS garantia_fim date;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS localizacao text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS centro_custo text;

-- 2. Sequence para numeracao automatica
CREATE SEQUENCE IF NOT EXISTS public.asset_patrimonio_seq START WITH 1 INCREMENT BY 1;

-- 3. Funcao para gerar numero de patrimonio
CREATE OR REPLACE FUNCTION public.generate_patrimonio_number(p_tipo public.asset_type)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sigla text;
  seq_val bigint;
BEGIN
  sigla := CASE p_tipo
    WHEN 'notebook' THEN 'NB'
    WHEN 'desktop' THEN 'DT'
    WHEN 'monitor' THEN 'MN'
    WHEN 'celular' THEN 'CL'
    WHEN 'tablet' THEN 'TB'
    WHEN 'impressora' THEN 'IM'
    WHEN 'outro' THEN 'OT'
    ELSE 'OT'
  END;
  
  seq_val := nextval('public.asset_patrimonio_seq');
  RETURN 'TI-' || sigla || '-' || LPAD(seq_val::text, 6, '0');
END;
$$;

-- 4. Trigger BEFORE INSERT para preencher numero_patrimonio automaticamente
CREATE OR REPLACE FUNCTION public.auto_generate_patrimonio_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Sempre gera automaticamente, ignorando valor manual
  NEW.numero_patrimonio := generate_patrimonio_number(NEW.tipo);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_patrimonio_number ON public.assets;
CREATE TRIGGER trg_auto_patrimonio_number
  BEFORE INSERT ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_patrimonio_number();

-- 5. Indice unico para numero_serie (quando nao nulo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_numero_serie_unique 
  ON public.assets(numero_serie) WHERE numero_serie IS NOT NULL AND numero_serie != '';

-- 6. Trigger para nao permitir baixa de equipamento em uso
CREATE OR REPLACE FUNCTION public.prevent_writeoff_in_use()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'em_uso' AND NEW.status = 'baixado' THEN
    RAISE EXCEPTION 'Não é possível dar baixa em equipamento em uso. Realize a devolução primeiro.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_writeoff_in_use ON public.assets;
CREATE TRIGGER trg_prevent_writeoff_in_use
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_writeoff_in_use();

-- Fase 2: Versao e user_agent no asset_terms
ALTER TABLE public.asset_terms ADD COLUMN IF NOT EXISTS versao integer DEFAULT 1;
ALTER TABLE public.asset_terms ADD COLUMN IF NOT EXISTS user_agent text;
