-- Agenda própria da BU Pós Venda. Isolada: não usa closers nem meeting_slots.
CREATE TABLE public.pos_venda_reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  gerente_id uuid NOT NULL REFERENCES public.profiles(id),
  tipo text NOT NULL CHECK (tipo IN ('viabilidade_1','viabilidade_2')),
  inicio timestamptz NOT NULL,
  duracao_min integer NOT NULL DEFAULT 60 CHECK (duracao_min BETWEEN 10 AND 480),
  link_reuniao text,
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','no_show','cancelada')),
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pos_venda_reunioes_inicio_idx ON public.pos_venda_reunioes(inicio);
CREATE INDEX pos_venda_reunioes_deal_idx ON public.pos_venda_reunioes(deal_id);

GRANT SELECT, INSERT, UPDATE ON public.pos_venda_reunioes TO authenticated;
GRANT ALL ON public.pos_venda_reunioes TO service_role;
ALTER TABLE public.pos_venda_reunioes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pos_venda_tem_acesso()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente_relacionamento')
$$;

CREATE POLICY "pos venda le reunioes" ON public.pos_venda_reunioes FOR SELECT TO authenticated USING (public.pos_venda_tem_acesso());
CREATE POLICY "pos venda cria reunioes" ON public.pos_venda_reunioes FOR INSERT TO authenticated WITH CHECK (
  public.pos_venda_tem_acesso()
  AND EXISTS (SELECT 1 FROM crm_deals d WHERE d.id = deal_id AND d.origin_id = 'b05a0000-0000-4000-8000-000000000002'));
CREATE POLICY "pos venda edita reunioes" ON public.pos_venda_reunioes FOR UPDATE TO authenticated USING (public.pos_venda_tem_acesso()) WITH CHECK (public.pos_venda_tem_acesso());

CREATE TRIGGER pos_venda_reunioes_updated_at BEFORE UPDATE ON public.pos_venda_reunioes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Gravações MeetGeek ligadas pelo e-mail do gerente + horário. Só leitura; não altera meeting_recordings.
CREATE OR REPLACE FUNCTION public.pos_venda_gravacoes_da_reuniao(p_reuniao_id uuid)
RETURNS TABLE(id uuid, title text, started_at timestamptz, duration_minutes integer, summary jsonb, highlights jsonb, transcript jsonb, ingest_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mr.id, mr.title, mr.started_at, mr.duration_minutes, mr.summary, mr.highlights, mr.transcript, mr.ingest_status
  FROM pos_venda_reunioes r
  JOIN profiles p ON p.id = r.gerente_id
  JOIN meeting_recordings mr
    ON mr.started_at BETWEEN r.inicio - interval '60 minutes' AND r.inicio + make_interval(mins => r.duracao_min + 120)
   AND (lower(mr.host_email) = lower(p.email) OR lower(p.email) = ANY (SELECT lower(x) FROM unnest(coalesce(mr.participant_emails, '{}')) x))
  WHERE r.id = p_reuniao_id AND public.pos_venda_tem_acesso() AND p.email IS NOT NULL
  ORDER BY mr.started_at DESC
$$;
REVOKE ALL ON FUNCTION public.pos_venda_gravacoes_da_reuniao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_gravacoes_da_reuniao(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pos_venda_tem_acesso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_venda_tem_acesso() TO authenticated, service_role;