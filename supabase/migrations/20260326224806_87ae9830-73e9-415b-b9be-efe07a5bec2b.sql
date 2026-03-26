-- Tabela de políticas internas
CREATE TABLE rh_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'politica'
    CHECK (categoria IN ('politica', 'codigo_conduta', 'manual', 'procedimento', 'outro')),
  arquivo_url TEXT,
  storage_path TEXT,
  versao TEXT DEFAULT '1.0',
  obrigatoria BOOLEAN NOT NULL DEFAULT false,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE rh_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active policies"
  ON rh_policies FOR SELECT TO authenticated
  USING (ativa = true);

-- Tabela de comunicados
CREATE TABLE rh_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'aviso'
    CHECK (tipo IN ('aviso', 'aniversariante', 'recado_gestao', 'evento')),
  destaque BOOLEAN NOT NULL DEFAULT false,
  data_publicacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_expiracao DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE rh_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active announcements"
  ON rh_announcements FOR SELECT TO authenticated
  USING (ativo = true AND (data_expiracao IS NULL OR data_expiracao >= CURRENT_DATE));