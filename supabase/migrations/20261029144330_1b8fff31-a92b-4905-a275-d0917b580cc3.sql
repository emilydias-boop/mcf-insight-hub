CREATE TABLE public.pos_venda_disponibilidade (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 gerente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 dia_semana integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
 horario time NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (gerente_id, dia_semana, horario)
);
GRANT SELECT ON public.pos_venda_disponibilidade TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pos_venda_disponibilidade TO authenticated;
GRANT ALL ON public.pos_venda_disponibilidade TO service_role;
ALTER TABLE public.pos_venda_disponibilidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos venda consulta disponibilidade" ON public.pos_venda_disponibilidade FOR SELECT TO authenticated USING (public.pos_venda_tem_acesso());
CREATE POLICY "admin configura disponibilidade" ON public.pos_venda_disponibilidade FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.pos_venda_disponibilidade (gerente_id, dia_semana, horario)
SELECT '4b3d5fb6-1e86-4b21-912d-8824dbd59033'::uuid, d, h::time
FROM generate_series(1,5) d CROSS JOIN unnest(ARRAY['14:30','15:00','15:30','16:00','16:30','17:00']) h;
CREATE OR REPLACE FUNCTION public.pos_venda_validar_disponibilidade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE local_inicio timestamp; BEGIN
 IF NEW.status = 'cancelada' THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF NEW.gerente_id IS NOT DISTINCT FROM OLD.gerente_id AND NEW.inicio IS NOT DISTINCT FROM OLD.inicio AND NEW.duracao_min IS NOT DISTINCT FROM OLD.duracao_min AND OLD.status <> 'cancelada' THEN RETURN NEW; END IF;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.pos_venda_disponibilidade WHERE gerente_id = NEW.gerente_id) THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.gerente_id::text, 0));
 local_inicio := NEW.inicio AT TIME ZONE 'America/Sao_Paulo';
 IF NEW.inicio <= now() OR NOT EXISTS (SELECT 1 FROM public.pos_venda_disponibilidade WHERE gerente_id = NEW.gerente_id AND dia_semana = extract(dow FROM local_inicio)::integer AND horario = local_inicio::time) THEN
   RAISE EXCEPTION 'Horário indisponível na agenda deste gerente.';
 END IF;
 IF NEW.duracao_min IS NULL OR NEW.duracao_min <= 0 THEN RAISE EXCEPTION 'Informe uma duração válida.'; END IF;
 IF EXISTS (SELECT 1 FROM public.pos_venda_reunioes r WHERE r.gerente_id = NEW.gerente_id AND r.id IS DISTINCT FROM NEW.id AND r.status <> 'cancelada' AND r.inicio < NEW.inicio + make_interval(mins => NEW.duracao_min) AND r.inicio + make_interval(mins => r.duracao_min) > NEW.inicio) THEN
   RAISE EXCEPTION 'Este horário já está ocupado. Escolha outro horário.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pos_venda_validar_disponibilidade() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER pos_venda_valida_horario BEFORE INSERT OR UPDATE OF gerente_id, inicio, duracao_min, status ON public.pos_venda_reunioes FOR EACH ROW EXECUTE FUNCTION public.pos_venda_validar_disponibilidade();