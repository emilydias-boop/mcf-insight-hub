-- Adicionar colunas de aprovação na tabela sdr_comp_plan
ALTER TABLE public.sdr_comp_plan
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id);

-- Atualizar registros existentes
UPDATE public.sdr_comp_plan SET status = 'APPROVED' WHERE status IS NULL;

-- Remover policies existentes de sdr_comp_plan para recriar
DROP POLICY IF EXISTS "SDRs podem ver seus próprios planos" ON public.sdr_comp_plan;
DROP POLICY IF EXISTS "Admins podem criar planos aprovados" ON public.sdr_comp_plan;
DROP POLICY IF EXISTS "Coordenadores podem criar planos pendentes" ON public.sdr_comp_plan;
DROP POLICY IF EXISTS "Admins podem atualizar planos" ON public.sdr_comp_plan;
DROP POLICY IF EXISTS "Admins podem deletar planos" ON public.sdr_comp_plan;

-- Recriar policies
CREATE POLICY "SDRs podem ver seus próprios planos"
ON public.sdr_comp_plan FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.sdr WHERE sdr.id = sdr_comp_plan.sdr_id AND sdr.user_id = auth.uid())
);

CREATE POLICY "Admins podem criar planos"
ON public.sdr_comp_plan FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coordenadores podem criar planos pendentes"
ON public.sdr_comp_plan FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'coordenador'::app_role) AND status = 'PENDING'
);

CREATE POLICY "Admins podem atualizar planos"
ON public.sdr_comp_plan FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar planos"
ON public.sdr_comp_plan FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));