
-- Table for strategic documents per BU
CREATE TABLE public.bu_strategic_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bu TEXT NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  semana INTEGER NOT NULL CHECK (semana >= 1 AND semana <= 5),
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_by_name TEXT,
  uploaded_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bu_strategic_documents ENABLE ROW LEVEL SECURITY;

-- SELECT policy: coordenador+ can read
CREATE POLICY "coordenador_plus_select_strategic_docs"
ON public.bu_strategic_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid()
        AND au.raw_app_meta_data->'roles' ?| array['admin', 'manager']
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM auth.users au
          WHERE au.id = auth.uid()
          AND au.raw_app_meta_data->'roles' ?| array['coordenador']
        )
        AND bu_strategic_documents.bu = ANY(p.squad)
      )
    )
  )
);

-- INSERT policy
CREATE POLICY "coordenador_plus_insert_strategic_docs"
ON public.bu_strategic_documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND au.raw_app_meta_data->'roles' ?| array['admin', 'manager', 'coordenador']
  )
);

-- DELETE policy
CREATE POLICY "owner_or_admin_delete_strategic_docs"
ON public.bu_strategic_documents
FOR DELETE
USING (
  uploaded_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND au.raw_app_meta_data->'roles' ?| array['admin', 'manager']
  )
);

-- Private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bu-strategic-documents', 'bu-strategic-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "coordenador_plus_upload_strategic_docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bu-strategic-documents'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = auth.uid()
    AND au.raw_app_meta_data->'roles' ?| array['admin', 'manager', 'coordenador']
  )
);

CREATE POLICY "coordenador_plus_view_strategic_docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'bu-strategic-documents'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = auth.uid()
    AND au.raw_app_meta_data->'roles' ?| array['admin', 'manager', 'coordenador']
  )
);

CREATE POLICY "owner_or_admin_delete_strategic_docs_storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bu-strategic-documents'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = auth.uid()
    AND au.raw_app_meta_data->'roles' ?| array['admin', 'manager']
  )
);

-- Index
CREATE INDEX idx_bu_strategic_docs_bu_ano_mes ON public.bu_strategic_documents (bu, ano, mes);
