-- Permitir leitura pública para página TV dashboard
CREATE POLICY "Public read access for TV dashboard"
ON hubla_transactions
FOR SELECT
TO anon
USING (true);