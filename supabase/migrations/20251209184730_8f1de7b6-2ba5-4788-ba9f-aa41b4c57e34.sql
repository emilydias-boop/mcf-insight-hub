-- ===== SISTEMA DE ARQUIVOS PESSOAIS DE COLABORADOR =====

-- 1. Criar Enum para tipos de arquivo
CREATE TYPE public.user_file_type AS ENUM (
  'contrato_trabalho',
  'politica_comissao', 
  'metas',
  'outro'
);

-- 2. Criar tabela user_files
CREATE TABLE public.user_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo user_file_type NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  storage_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  data_upload TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL,
  visivel_para_usuario BOOLEAN NOT NULL DEFAULT true,
  categoria_cargo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- 4. Criar trigger para atualizar updated_at
CREATE TRIGGER update_user_files_updated_at
BEFORE UPDATE ON public.user_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. RLS Policies para user_files

-- Usuário comum: ver apenas seus arquivos visíveis
-- MASTER/GESTOR: ver todos os arquivos
CREATE POLICY "Usuários podem ver seus próprios arquivos visíveis ou gestores veem todos"
ON public.user_files FOR SELECT
USING (
  (user_id = auth.uid() AND visivel_para_usuario = true)
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'coordenador')
);

-- MASTER e GESTOR podem inserir
CREATE POLICY "Admin/Manager/Coordenador podem inserir arquivos"
ON public.user_files FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'coordenador')
);

-- MASTER e GESTOR podem atualizar
CREATE POLICY "Admin/Manager/Coordenador podem atualizar arquivos"
ON public.user_files FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'coordenador')
);

-- MASTER e GESTOR podem deletar
CREATE POLICY "Admin/Manager/Coordenador podem deletar arquivos"
ON public.user_files FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'coordenador')
);

-- 6. Criar Storage Bucket para arquivos de usuário
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files', 'user-files', false);

-- 7. Storage RLS Policies

-- Admin/Manager/Coordenador podem fazer upload
CREATE POLICY "Admin/Manager/Coordenador podem fazer upload de arquivos de usuário"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-files' 
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'coordenador')
  )
);

-- Usuários autenticados podem baixar arquivos (controle feito via signed URL)
CREATE POLICY "Usuários autenticados podem visualizar arquivos do bucket user-files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-files'
  AND auth.uid() IS NOT NULL
);

-- Admin/Manager/Coordenador podem deletar arquivos do storage
CREATE POLICY "Admin/Manager/Coordenador podem deletar arquivos do storage user-files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-files'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'coordenador')
  )
);