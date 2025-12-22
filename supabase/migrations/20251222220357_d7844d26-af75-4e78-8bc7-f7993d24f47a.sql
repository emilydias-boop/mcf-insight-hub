-- Tabela de closers (vendedores que fazem reuniões)
CREATE TABLE public.closers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de disponibilidade recorrente dos closers
CREATE TABLE public.closer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid REFERENCES public.closers(id) ON DELETE CASCADE NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=domingo, 6=sábado
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_minutes integer DEFAULT 60 CHECK (slot_duration_minutes > 0),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Tabela de agendamentos de reuniões
CREATE TABLE public.meeting_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid REFERENCES public.closers(id) ON DELETE CASCADE NOT NULL,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60 CHECK (duration_minutes > 0),
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled', 'rescheduled')),
  booked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- SDR que agendou
  notes text,
  meeting_link text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_closer_availability_closer ON public.closer_availability(closer_id);
CREATE INDEX idx_closer_availability_day ON public.closer_availability(day_of_week);
CREATE INDEX idx_meeting_slots_closer ON public.meeting_slots(closer_id);
CREATE INDEX idx_meeting_slots_scheduled ON public.meeting_slots(scheduled_at);
CREATE INDEX idx_meeting_slots_deal ON public.meeting_slots(deal_id);
CREATE INDEX idx_meeting_slots_status ON public.meeting_slots(status);

-- Triggers para updated_at
CREATE TRIGGER update_closers_updated_at
  BEFORE UPDATE ON public.closers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_closer_availability_updated_at
  BEFORE UPDATE ON public.closer_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_slots_updated_at
  BEFORE UPDATE ON public.meeting_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.closers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies para closers
CREATE POLICY "Authenticated users can view active closers"
  ON public.closers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordenadores can manage closers"
  ON public.closers FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

-- RLS Policies para closer_availability
CREATE POLICY "Authenticated users can view availability"
  ON public.closer_availability FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordenadores can manage availability"
  ON public.closer_availability FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador'));

-- RLS Policies para meeting_slots
CREATE POLICY "Authenticated users can view meeting slots"
  ON public.meeting_slots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create meeting slots"
  ON public.meeting_slots FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their booked slots or admins/coordenadores can update any"
  ON public.meeting_slots FOR UPDATE
  USING (
    booked_by = auth.uid() 
    OR has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Admins can delete meeting slots"
  ON public.meeting_slots FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Inserir os closers iniciais baseado no CLOSER_LIST
INSERT INTO public.closers (name, email) VALUES
  ('Thayna', 'thayna@minhacasafinanciada.com'),
  ('Deisi', 'deisi@minhacasafinanciada.com'),
  ('Leticia', 'leticia@minhacasafinanciada.com'),
  ('Julio', 'julio@minhacasafinanciada.com'),
  ('Jessica Bellini', 'jessica.bellini@minhacasafinanciada.com');

-- Inserir disponibilidade padrão (Segunda a Sexta, 9h-12h e 14h-18h, slots de 1h)
INSERT INTO public.closer_availability (closer_id, day_of_week, start_time, end_time, slot_duration_minutes)
SELECT 
  c.id,
  d.day,
  t.start_time::time,
  t.end_time::time,
  60
FROM public.closers c
CROSS JOIN (SELECT generate_series(1, 5) as day) d -- Segunda(1) a Sexta(5)
CROSS JOIN (
  VALUES ('09:00', '12:00'), ('14:00', '18:00')
) AS t(start_time, end_time);