
-- Drop existing broken policies on bu_strategic_documents
DROP POLICY IF EXISTS "coordenador_plus_insert_strategic_docs" ON public.bu_strategic_documents;
DROP POLICY IF EXISTS "coordenador_plus_select_strategic_docs" ON public.bu_strategic_documents;
DROP POLICY IF EXISTS "owner_or_admin_delete_strategic_docs" ON public.bu_strategic_documents;

-- Recreate using has_role()
CREATE POLICY "insert_strategic_docs" ON public.bu_strategic_documents
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'coordenador')
);

CREATE POLICY "select_strategic_docs" ON public.bu_strategic_documents
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  (has_role(auth.uid(), 'coordenador') AND bu = ANY(
    SELECT unnest(squad) FROM profiles WHERE id = auth.uid()
  ))
);

CREATE POLICY "delete_strategic_docs" ON public.bu_strategic_documents
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid() OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager')
);

-- Drop existing broken storage policies
DROP POLICY IF EXISTS "coordenador_plus_upload_strategic_docs" ON storage.objects;
DROP POLICY IF EXISTS "coordenador_plus_view_strategic_docs" ON storage.objects;
DROP POLICY IF EXISTS "owner_or_admin_delete_strategic_docs_storage" ON storage.objects;

-- Recreate storage policies using has_role()
CREATE POLICY "upload_strategic_docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bu-strategic-documents' AND (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'coordenador')
  )
);

CREATE POLICY "view_strategic_docs" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'bu-strategic-documents' AND (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'coordenador')
  )
);

CREATE POLICY "delete_strategic_docs_storage" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'bu-strategic-documents' AND (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager')
  )
);
