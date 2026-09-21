
CREATE OR REPLACE FUNCTION public.is_my_closer(_closer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.closers c
    LEFT JOIN public.employees e ON e.id = c.employee_id
    WHERE c.id = _closer_id
      AND (
        e.user_id = auth.uid()
        OR lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_self_manage_agenda()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.can_manage_agenda FROM public.profiles p WHERE p.id = auth.uid()), false)
$$;

-- closer_availability: dono com can_manage_agenda escreve na própria agenda
CREATE POLICY "Closer dono pode inserir sua disponibilidade"
ON public.closer_availability FOR INSERT TO authenticated
WITH CHECK (public.can_self_manage_agenda() AND public.is_my_closer(closer_id));

CREATE POLICY "Closer dono pode atualizar sua disponibilidade"
ON public.closer_availability FOR UPDATE TO authenticated
USING (public.can_self_manage_agenda() AND public.is_my_closer(closer_id))
WITH CHECK (public.can_self_manage_agenda() AND public.is_my_closer(closer_id));

CREATE POLICY "Closer dono pode remover sua disponibilidade"
ON public.closer_availability FOR DELETE TO authenticated
USING (public.can_self_manage_agenda() AND public.is_my_closer(closer_id));

-- closer_blocked_dates
CREATE POLICY "Closer dono pode inserir suas datas bloqueadas"
ON public.closer_blocked_dates FOR INSERT TO authenticated
WITH CHECK (public.can_self_manage_agenda() AND public.is_my_closer(closer_id));

CREATE POLICY "Closer dono pode atualizar suas datas bloqueadas"
ON public.closer_blocked_dates FOR UPDATE TO authenticated
USING (public.can_self_manage_agenda() AND public.is_my_closer(closer_id))
WITH CHECK (public.can_self_manage_agenda() AND public.is_my_closer(closer_id));

CREATE POLICY "Closer dono pode remover suas datas bloqueadas"
ON public.closer_blocked_dates FOR DELETE TO authenticated
USING (public.can_self_manage_agenda() AND public.is_my_closer(closer_id));

-- closers: dono atualiza apenas a própria linha (colunas sensíveis travadas por trigger)
CREATE POLICY "Closer dono pode atualizar seu proprio cadastro"
ON public.closers FOR UPDATE TO authenticated
USING (public.can_self_manage_agenda() AND public.is_my_closer(id))
WITH CHECK (public.can_self_manage_agenda() AND public.is_my_closer(id));

CREATE OR REPLACE FUNCTION public.guard_closer_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Liderança pode tudo; demais só ajustam cor/duração/leads do próprio cadastro.
  IF has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'manager'::app_role)
     OR has_role(auth.uid(), 'coordenador'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.bu IS DISTINCT FROM OLD.bu
     OR NEW.meeting_type IS DISTINCT FROM OLD.meeting_type
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.priority IS DISTINCT FROM OLD.priority THEN
    RAISE EXCEPTION 'Sem permissao para alterar area, tipo de reuniao, status, e-mail, vinculo ou prioridade do closer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_closer_self_update ON public.closers;
CREATE TRIGGER trg_guard_closer_self_update
BEFORE UPDATE ON public.closers
FOR EACH ROW EXECUTE FUNCTION public.guard_closer_self_update();
