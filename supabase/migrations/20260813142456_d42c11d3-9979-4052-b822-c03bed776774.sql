CREATE TABLE public.page_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.page_access_log TO authenticated;
GRANT ALL ON public.page_access_log TO service_role;

ALTER TABLE public.page_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own page access"
ON public.page_access_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read page access log"
ON public.page_access_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_page_access_log_created_at ON public.page_access_log (created_at);
CREATE INDEX idx_page_access_log_path_created_at ON public.page_access_log (path, created_at);