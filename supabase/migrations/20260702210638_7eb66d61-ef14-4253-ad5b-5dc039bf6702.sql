
DROP POLICY IF EXISTS "public read campaign-photos" ON storage.objects;
CREATE POLICY "public read campaign-photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'campaign-photos');
