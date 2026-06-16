
CREATE TABLE public.call_classification_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad text NOT NULL UNIQUE,
  ring_drop_max integer NOT NULL DEFAULT 10 CHECK (ring_drop_max > 0),
  voicemail_max integer NOT NULL DEFAULT 30 CHECK (voicemail_max > 0),
  effective_max integer NOT NULL DEFAULT 60 CHECK (effective_max > 0),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thresholds_ordered CHECK (ring_drop_max < voicemail_max AND voicemail_max < effective_max)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_classification_thresholds TO authenticated;
GRANT ALL ON public.call_classification_thresholds TO service_role;

ALTER TABLE public.call_classification_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read thresholds"
  ON public.call_classification_thresholds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers can insert thresholds"
  ON public.call_classification_thresholds FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update thresholds"
  ON public.call_classification_thresholds FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete thresholds"
  ON public.call_classification_thresholds FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_call_classification_thresholds_updated_at
  BEFORE UPDATE ON public.call_classification_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.call_classification_thresholds (squad, ring_drop_max, voicemail_max, effective_max)
VALUES
  ('default', 10, 30, 60),
  ('incorporador', 10, 30, 60),
  ('consorcio', 10, 30, 60)
ON CONFLICT (squad) DO NOTHING;
