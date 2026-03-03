
-- Create limbo_uploads table
CREATE TABLE public.limbo_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  uploaded_by_name text,
  uploaded_at timestamptz DEFAULT now(),
  row_count integer DEFAULT 0,
  column_mapping jsonb,
  comparison_results jsonb,
  status text DEFAULT 'pending'
);

ALTER TABLE public.limbo_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read limbo_uploads"
  ON public.limbo_uploads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert limbo_uploads"
  ON public.limbo_uploads FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can update limbo_uploads"
  ON public.limbo_uploads FOR UPDATE TO authenticated USING (true);

-- Create storage bucket for limbo files
INSERT INTO storage.buckets (id, name, public) VALUES ('limbo-files', 'limbo-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload limbo files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'limbo-files');

CREATE POLICY "Authenticated users can read limbo files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'limbo-files');
