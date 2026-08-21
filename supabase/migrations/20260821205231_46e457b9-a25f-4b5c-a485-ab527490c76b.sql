-- 1) employees: bloquear auto-edição de campos sensíveis via trigger (RLS não faz coluna)
CREATE OR REPLACE FUNCTION public.employees_block_self_sensitive_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_hr boolean;
  is_lead boolean;
BEGIN
  -- service_role / jobs internos (sem auth.uid()) passam livremente
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  is_hr := public.has_role(uid, 'admin'::app_role) OR public.has_role(uid, 'rh'::app_role);
  is_lead := is_hr
    OR public.has_role(uid, 'manager'::app_role)
    OR public.has_role(uid, 'coordenador'::app_role);

  IF NOT is_hr THEN
    IF NEW.salario_base IS DISTINCT FROM OLD.salario_base
       OR NEW.ote_mensal IS DISTINCT FROM OLD.ote_mensal
       OR NEW.tipo_variavel IS DISTINCT FROM OLD.tipo_variavel
       OR NEW.descricao_comissao IS DISTINCT FROM OLD.descricao_comissao
       OR NEW.modelo_fechamento IS DISTINCT FROM OLD.modelo_fechamento
       OR NEW.fechamento_manual IS DISTINCT FROM OLD.fechamento_manual
       OR NEW.banco IS DISTINCT FROM OLD.banco
       OR NEW.agencia IS DISTINCT FROM OLD.agencia
       OR NEW.conta IS DISTINCT FROM OLD.conta
       OR NEW.tipo_conta IS DISTINCT FROM OLD.tipo_conta
       OR NEW.pix IS DISTINCT FROM OLD.pix
       OR NEW.cargo IS DISTINCT FROM OLD.cargo
       OR NEW.cargo_catalogo_id IS DISTINCT FROM OLD.cargo_catalogo_id
       OR NEW.nivel IS DISTINCT FROM OLD.nivel
       OR NEW.departamento IS DISTINCT FROM OLD.departamento
       OR NEW.data_admissao IS DISTINCT FROM OLD.data_admissao
       OR NEW.data_demissao IS DISTINCT FROM OLD.data_demissao
       OR NEW.tipo_contrato IS DISTINCT FROM OLD.tipo_contrato
       OR NEW.jornada_trabalho IS DISTINCT FROM OLD.jornada_trabalho
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
    THEN
      RAISE EXCEPTION 'Apenas Admin ou RH podem alterar remuneração, dados bancários, cargo, contrato ou vínculos deste colaborador';
    END IF;
  END IF;

  IF NOT is_lead THEN
    IF NEW.squad IS DISTINCT FROM OLD.squad
       OR NEW.gestor_id IS DISTINCT FROM OLD.gestor_id
       OR NEW.sdr_id IS DISTINCT FROM OLD.sdr_id
    THEN
      RAISE EXCEPTION 'Apenas liderança (Admin, RH, Gestor ou Coordenador) pode alterar squad, gestor ou vínculo de SDR';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_block_self_sensitive_update ON public.employees;
CREATE TRIGGER trg_employees_block_self_sensitive_update
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.employees_block_self_sensitive_update();

-- 2) profiles: bloquear auto-concessão de capacidades
CREATE OR REPLACE FUNCTION public.profiles_block_self_capability_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(uid, 'admin'::app_role) OR public.has_role(uid, 'manager'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.can_book_r2 IS DISTINCT FROM OLD.can_book_r2
     OR NEW.can_manage_agenda IS DISTINCT FROM OLD.can_manage_agenda
     OR NEW.can_handle_no_show IS DISTINCT FROM OLD.can_handle_no_show
     OR NEW.can_link_contract IS DISTINCT FROM OLD.can_link_contract
     OR NEW.can_cancel_meeting IS DISTINCT FROM OLD.can_cancel_meeting
     OR NEW.can_transfer_leads IS DISTINCT FROM OLD.can_transfer_leads
     OR NEW.access_status IS DISTINCT FROM OLD.access_status
     OR NEW.blocked_until IS DISTINCT FROM OLD.blocked_until
     OR NEW.squad IS DISTINCT FROM OLD.squad
     OR NEW.show_on_tv IS DISTINCT FROM OLD.show_on_tv
     OR NEW.mcf_pay_closer_code IS DISTINCT FROM OLD.mcf_pay_closer_code
     OR NEW.mcf_pay_sdr_code IS DISTINCT FROM OLD.mcf_pay_sdr_code
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Apenas Admin ou Gestor podem alterar permissões, status de acesso, squad ou códigos de pagamento do perfil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_self_capability_update ON public.profiles;
CREATE TRIGGER trg_profiles_block_self_capability_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_block_self_capability_update();

-- 3) rule_approval_requests: solicitante só pode cancelar
DROP POLICY IF EXISTS "Requester cancels own pending" ON public.rule_approval_requests;
CREATE POLICY "Requester cancels own pending"
ON public.rule_approval_requests
FOR UPDATE
USING (auth.uid() = requested_by AND status = 'pending')
WITH CHECK (auth.uid() = requested_by AND status IN ('pending','cancelled'));