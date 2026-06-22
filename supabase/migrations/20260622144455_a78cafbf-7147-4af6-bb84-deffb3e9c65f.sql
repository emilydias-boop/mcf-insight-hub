
CREATE POLICY "Authenticated upload qualification attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'qualification-attachments');

CREATE POLICY "Authenticated read qualification attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'qualification-attachments');

CREATE POLICY "Authenticated delete own qualification attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'qualification-attachments' AND owner = auth.uid());
