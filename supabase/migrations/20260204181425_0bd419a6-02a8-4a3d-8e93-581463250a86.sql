-- Permitir colaboradores fazerem upload de suas próprias NFSe
-- A política valida que o primeiro segmento do path é o employee_id do usuário

CREATE POLICY "Colaboradores podem fazer upload de suas NFSe"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public.employees 
    WHERE user_id = auth.uid()
  )
);

-- Permitir colaboradores atualizarem seus próprios arquivos (necessário para upsert funcionar)
CREATE POLICY "Colaboradores podem atualizar suas NFSe"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public.employees 
    WHERE user_id = auth.uid()
  )
);