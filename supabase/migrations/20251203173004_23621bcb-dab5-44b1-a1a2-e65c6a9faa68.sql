-- Create working days calendar table
CREATE TABLE public.working_days_calendar (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ano_mes text NOT NULL UNIQUE,
  dias_uteis_base integer NOT NULL DEFAULT 22,
  dias_uteis_final integer NOT NULL DEFAULT 22,
  feriados_nacionais jsonb DEFAULT '[]'::jsonb,
  paradas_empresa jsonb DEFAULT '[]'::jsonb,
  ifood_valor_dia numeric NOT NULL DEFAULT 30,
  ifood_mensal_calculado numeric GENERATED ALWAYS AS (dias_uteis_final * ifood_valor_dia) STORED,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.working_days_calendar ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view calendar"
ON public.working_days_calendar
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can manage calendar"
ON public.working_days_calendar
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));

-- Insert initial data for 2025
INSERT INTO public.working_days_calendar (ano_mes, dias_uteis_base, dias_uteis_final, ifood_valor_dia, observacoes) VALUES
('2025-01', 22, 22, 30, 'Janeiro 2025'),
('2025-02', 20, 20, 30, 'Fevereiro 2025 - Carnaval'),
('2025-03', 21, 21, 30, 'Março 2025'),
('2025-04', 21, 21, 30, 'Abril 2025 - Páscoa'),
('2025-05', 21, 21, 30, 'Maio 2025'),
('2025-06', 21, 21, 30, 'Junho 2025'),
('2025-07', 23, 23, 30, 'Julho 2025'),
('2025-08', 21, 21, 30, 'Agosto 2025'),
('2025-09', 22, 22, 30, 'Setembro 2025'),
('2025-10', 22, 22, 30, 'Outubro 2025'),
('2025-11', 20, 20, 30, 'Novembro 2025'),
('2025-12', 15, 15, 30, 'Dezembro 2025 - Recesso até dia 19');

-- Create trigger for updated_at
CREATE TRIGGER update_working_days_calendar_updated_at
BEFORE UPDATE ON public.working_days_calendar
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();