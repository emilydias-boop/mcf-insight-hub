-- Criar tabela de premiações
CREATE TABLE public.premiacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  premio_descricao TEXT NOT NULL,
  premio_valor NUMERIC,
  bu TEXT NOT NULL,
  cargos_elegiveis TEXT[] NOT NULL DEFAULT '{}',
  tipo_competicao TEXT NOT NULL DEFAULT 'individual' CHECK (tipo_competicao IN ('individual', 'equipe', 'ambos')),
  metrica_ranking TEXT NOT NULL,
  metrica_config JSONB DEFAULT '{}',
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  qtd_ganhadores INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'encerrada', 'cancelada')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de ganhadores
CREATE TABLE public.premiacao_ganhadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premiacao_id UUID NOT NULL REFERENCES public.premiacoes(id) ON DELETE CASCADE,
  posicao INTEGER NOT NULL,
  employee_id UUID REFERENCES public.employees(id),
  squad TEXT,
  valor_final NUMERIC,
  premio_recebido TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_premiacoes_bu ON public.premiacoes(bu);
CREATE INDEX idx_premiacoes_status ON public.premiacoes(status);
CREATE INDEX idx_premiacoes_data_fim ON public.premiacoes(data_fim);
CREATE INDEX idx_premiacao_ganhadores_premiacao ON public.premiacao_ganhadores(premiacao_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_premiacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_premiacoes_updated_at
  BEFORE UPDATE ON public.premiacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_premiacoes_updated_at();

-- Habilitar RLS
ALTER TABLE public.premiacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premiacao_ganhadores ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se usuário é gestor
CREATE OR REPLACE FUNCTION public.is_bu_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'coordenador')
  )
$$;

-- RLS Policies para premiacoes
-- SELECT: Usuários veem premiações da sua BU ou se forem gestores
CREATE POLICY "premiacoes_select_policy" ON public.premiacoes
FOR SELECT TO authenticated
USING (
  bu IN (SELECT squad FROM public.profiles WHERE id = auth.uid())
  OR public.is_bu_manager(auth.uid())
);

-- INSERT: Apenas gestores podem criar
CREATE POLICY "premiacoes_insert_policy" ON public.premiacoes
FOR INSERT TO authenticated
WITH CHECK (
  public.is_bu_manager(auth.uid())
);

-- UPDATE: Apenas gestores podem editar
CREATE POLICY "premiacoes_update_policy" ON public.premiacoes
FOR UPDATE TO authenticated
USING (
  public.is_bu_manager(auth.uid())
)
WITH CHECK (
  public.is_bu_manager(auth.uid())
);

-- DELETE: Apenas gestores podem deletar
CREATE POLICY "premiacoes_delete_policy" ON public.premiacoes
FOR DELETE TO authenticated
USING (
  public.is_bu_manager(auth.uid())
);

-- RLS Policies para premiacao_ganhadores
-- SELECT: Mesmo acesso que premiacoes
CREATE POLICY "premiacao_ganhadores_select_policy" ON public.premiacao_ganhadores
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.premiacoes p
    WHERE p.id = premiacao_id
    AND (
      p.bu IN (SELECT squad FROM public.profiles WHERE id = auth.uid())
      OR public.is_bu_manager(auth.uid())
    )
  )
);

-- INSERT/UPDATE/DELETE: Apenas gestores
CREATE POLICY "premiacao_ganhadores_insert_policy" ON public.premiacao_ganhadores
FOR INSERT TO authenticated
WITH CHECK (
  public.is_bu_manager(auth.uid())
);

CREATE POLICY "premiacao_ganhadores_update_policy" ON public.premiacao_ganhadores
FOR UPDATE TO authenticated
USING (public.is_bu_manager(auth.uid()))
WITH CHECK (public.is_bu_manager(auth.uid()));

CREATE POLICY "premiacao_ganhadores_delete_policy" ON public.premiacao_ganhadores
FOR DELETE TO authenticated
USING (public.is_bu_manager(auth.uid()));