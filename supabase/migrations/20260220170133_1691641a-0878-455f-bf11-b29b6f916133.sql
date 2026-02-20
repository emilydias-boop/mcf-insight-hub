-- Create storage bucket for asset invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-invoices', 'asset-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for asset-invoices bucket
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'asset-invoices');

CREATE POLICY "Authenticated users can view invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'asset-invoices');

CREATE POLICY "Authenticated users can delete their invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'asset-invoices');