-- Criar bucket para documentos de consórcio
INSERT INTO storage.buckets (id, name, public)
VALUES ('consorcio-documents', 'consorcio-documents', false);

-- Políticas de acesso para upload
CREATE POLICY "Authenticated users can upload consorcio documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'consorcio-documents');

-- Políticas de acesso para visualização
CREATE POLICY "Authenticated users can view consorcio documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'consorcio-documents');

-- Políticas de acesso para deleção
CREATE POLICY "Authenticated users can delete consorcio documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'consorcio-documents');

-- Políticas de acesso para atualização
CREATE POLICY "Authenticated users can update consorcio documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'consorcio-documents');