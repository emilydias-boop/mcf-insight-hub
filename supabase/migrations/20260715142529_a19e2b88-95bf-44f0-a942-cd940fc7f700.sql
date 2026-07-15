
CREATE TABLE public.consorcio_match_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_match_uploads TO authenticated;
GRANT ALL ON public.consorcio_match_uploads TO service_role;

ALTER TABLE public.consorcio_match_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read match uploads"
  ON public.consorcio_match_uploads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert match uploads"
  ON public.consorcio_match_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader or admin can delete"
  ON public.consorcio_match_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'));
