-- Enum para categorias de playbook
CREATE TYPE public.playbook_categoria AS ENUM (
  'onboarding', 'processo', 'politica', 'script', 'treinamento', 'outro'
);

-- Enum para tipos de conteúdo
CREATE TYPE public.playbook_tipo_conteudo AS ENUM ('arquivo', 'link', 'texto');

-- Enum para status de leitura
CREATE TYPE public.playbook_read_status AS ENUM ('nao_lido', 'lido', 'confirmado');

-- Enum para roles do playbook
CREATE TYPE public.playbook_role AS ENUM (
  'sdr', 'closer', 'coordenador', 'gestor_sdr', 'gestor_closer', 'master', 'admin', 'manager', 'viewer'
);

-- Tabela playbook_docs (catálogo de documentos por cargo)
CREATE TABLE public.playbook_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.playbook_role NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo_conteudo public.playbook_tipo_conteudo NOT NULL,
  storage_url TEXT,
  storage_path TEXT,
  link_url TEXT,
  conteudo_rico TEXT,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  categoria public.playbook_categoria NOT NULL DEFAULT 'outro',
  versao TEXT NOT NULL DEFAULT 'v1',
  data_publicacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela playbook_reads (controle de leitura por usuário)
CREATE TABLE public.playbook_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_doc_id UUID NOT NULL REFERENCES public.playbook_docs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.playbook_read_status NOT NULL DEFAULT 'nao_lido',
  lido_em TIMESTAMPTZ,
  confirmado_em TIMESTAMPTZ,
  ultima_acao_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playbook_doc_id, user_id)
);

-- Índices para performance
CREATE INDEX idx_playbook_docs_role ON public.playbook_docs(role);
CREATE INDEX idx_playbook_docs_ativo ON public.playbook_docs(ativo);
CREATE INDEX idx_playbook_reads_user ON public.playbook_reads(user_id);
CREATE INDEX idx_playbook_reads_doc ON public.playbook_reads(playbook_doc_id);

-- Trigger para updated_at
CREATE TRIGGER update_playbook_docs_updated_at
  BEFORE UPDATE ON public.playbook_docs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbook_reads_updated_at
  BEFORE UPDATE ON public.playbook_reads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.playbook_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_reads ENABLE ROW LEVEL SECURITY;

-- PLAYBOOK_DOCS: Admin, Manager e Coordenador podem gerenciar
CREATE POLICY "Admins e coordenadores podem gerenciar playbook_docs"
  ON public.playbook_docs FOR ALL
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'coordenador')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'coordenador')
  );

-- PLAYBOOK_DOCS: Usuários autenticados podem ver documentos ativos
CREATE POLICY "Usuarios autenticados podem ver playbook_docs ativos"
  ON public.playbook_docs FOR SELECT
  USING (auth.uid() IS NOT NULL AND ativo = true);

-- PLAYBOOK_READS: Usuários podem gerenciar próprias leituras
CREATE POLICY "Usuarios podem gerenciar proprias leituras"
  ON public.playbook_reads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- PLAYBOOK_READS: Admins e coordenadores podem ver todas as leituras
CREATE POLICY "Admins podem ver todas as leituras"
  ON public.playbook_reads FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'coordenador')
  );

-- Criar bucket para arquivos do playbook
INSERT INTO storage.buckets (id, name, public)
VALUES ('playbook-files', 'playbook-files', false);

-- RLS para storage - upload
CREATE POLICY "Admins e coordenadores podem fazer upload playbook"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'playbook-files' AND (
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'manager') OR 
      has_role(auth.uid(), 'coordenador')
    )
  );

-- RLS para storage - leitura
CREATE POLICY "Usuarios autenticados podem ler arquivos playbook"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'playbook-files' AND auth.uid() IS NOT NULL);

-- RLS para storage - delete
CREATE POLICY "Admins podem deletar arquivos do playbook"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'playbook-files' AND (
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'manager')
    )
  );

-- RLS para storage - update
CREATE POLICY "Admins podem atualizar arquivos do playbook"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'playbook-files' AND (
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'manager') OR 
      has_role(auth.uid(), 'coordenador')
    )
  );