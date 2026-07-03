
-- Enums
CREATE TYPE public.checkin_room_status AS ENUM ('novo','em_atendimento','aguardando_cliente','concluido');
CREATE TYPE public.checkin_sender AS ENUM ('customer','staff','system');

-- Rooms
CREATE TABLE public.checkin_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  product_name TEXT,
  purchase_date TIMESTAMPTZ,
  hubla_transaction_id UUID REFERENCES public.hubla_transactions(id) ON DELETE SET NULL,
  attendee_id UUID REFERENCES public.meeting_slot_attendees(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.checkin_room_status NOT NULL DEFAULT 'novo',
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_for_team INTEGER NOT NULL DEFAULT 0,
  unread_for_customer INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkin_rooms_last_message ON public.checkin_rooms(last_message_at DESC NULLS LAST);
CREATE INDEX idx_checkin_rooms_assigned ON public.checkin_rooms(assigned_to);
CREATE INDEX idx_checkin_rooms_email ON public.checkin_rooms(lower(customer_email));
CREATE INDEX idx_checkin_rooms_status ON public.checkin_rooms(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_rooms TO authenticated;
GRANT ALL ON public.checkin_rooms TO service_role;
ALTER TABLE public.checkin_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/coord/manager veem tudo" ON public.checkin_rooms
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  );

CREATE POLICY "Equipe vê salas atribuídas ou fila geral" ON public.checkin_rooms
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR assigned_to IS NULL);

CREATE POLICY "Equipe pode atualizar salas atribuídas ou fila geral" ON public.checkin_rooms
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR assigned_to IS NULL);

-- Messages
CREATE TABLE public.checkin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.checkin_rooms(id) ON DELETE CASCADE,
  sender_type public.checkin_sender NOT NULL,
  sender_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name TEXT,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkin_messages_room ON public.checkin_messages(room_id, sent_at);

GRANT SELECT, INSERT, UPDATE ON public.checkin_messages TO authenticated;
GRANT ALL ON public.checkin_messages TO service_role;
ALTER TABLE public.checkin_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver mensagens de salas acessíveis" ON public.checkin_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.checkin_rooms r
      WHERE r.id = room_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)
          OR public.has_role(auth.uid(), 'coordenador'::app_role)
          OR r.assigned_to = auth.uid()
          OR r.assigned_to IS NULL
        )
    )
  );

CREATE POLICY "Equipe pode inserir mensagens" ON public.checkin_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'staff'
    AND EXISTS (
      SELECT 1 FROM public.checkin_rooms r
      WHERE r.id = room_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)
          OR public.has_role(auth.uid(), 'coordenador'::app_role)
          OR r.assigned_to = auth.uid()
          OR r.assigned_to IS NULL
        )
    )
  );

-- Events (auditoria)
CREATE TABLE public.checkin_room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.checkin_rooms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkin_room_events_room ON public.checkin_room_events(room_id, created_at);

GRANT SELECT, INSERT ON public.checkin_room_events TO authenticated;
GRANT ALL ON public.checkin_room_events TO service_role;
ALTER TABLE public.checkin_room_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver eventos de salas acessíveis" ON public.checkin_room_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.checkin_rooms r
      WHERE r.id = room_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)
          OR public.has_role(auth.uid(), 'coordenador'::app_role)
          OR r.assigned_to = auth.uid()
          OR r.assigned_to IS NULL
        )
    )
  );

CREATE POLICY "Inserir eventos" ON public.checkin_room_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.checkin_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checkin_rooms_updated_at
  BEFORE UPDATE ON public.checkin_rooms
  FOR EACH ROW EXECUTE FUNCTION public.checkin_touch_updated_at();

-- Trigger: nova mensagem atualiza contadores/preview da sala
CREATE OR REPLACE FUNCTION public.checkin_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_room public.checkin_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM public.checkin_rooms WHERE id = NEW.room_id FOR UPDATE;

  UPDATE public.checkin_rooms
     SET last_message_at = NEW.sent_at,
         last_message_preview = LEFT(NEW.body, 160),
         unread_for_team = CASE WHEN NEW.sender_type = 'customer' THEN unread_for_team + 1 ELSE unread_for_team END,
         unread_for_customer = CASE WHEN NEW.sender_type = 'staff' THEN unread_for_customer + 1 ELSE unread_for_customer END,
         status = CASE
           WHEN NEW.sender_type = 'staff' AND v_room.status IN ('novo','em_atendimento') THEN 'aguardando_cliente'::checkin_room_status
           WHEN NEW.sender_type = 'customer' AND v_room.status = 'aguardando_cliente' THEN 'em_atendimento'::checkin_room_status
           WHEN NEW.sender_type = 'customer' AND v_room.status = 'novo' THEN 'novo'::checkin_room_status
           ELSE v_room.status
         END,
         assigned_to = CASE
           WHEN NEW.sender_type = 'staff' AND v_room.assigned_to IS NULL AND NEW.sender_user_id IS NOT NULL THEN NEW.sender_user_id
           ELSE v_room.assigned_to
         END
   WHERE id = NEW.room_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checkin_on_new_message
  AFTER INSERT ON public.checkin_messages
  FOR EACH ROW EXECUTE FUNCTION public.checkin_on_new_message();

-- Trigger de criação automática a partir de hubla_transactions (A000)
CREATE OR REPLACE FUNCTION public.checkin_autocreate_from_hubla()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF NEW.product_name IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.sale_status NOT IN ('completed','paid') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.net_value, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.product_name NOT ILIKE '%A000%' AND NEW.product_name NOT ILIKE '%contrato%' THEN
    RETURN NEW;
  END IF;
  IF NEW.customer_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.checkin_rooms
    WHERE lower(customer_email) = lower(NEW.customer_email)
  ) INTO v_exists;

  IF v_exists THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.checkin_rooms (
    customer_name, customer_email, customer_phone,
    product_name, purchase_date, hubla_transaction_id
  ) VALUES (
    COALESCE(NEW.customer_name, NEW.customer_email),
    NEW.customer_email,
    NEW.customer_phone,
    NEW.product_name,
    NEW.sale_date,
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checkin_autocreate_hubla
  AFTER INSERT OR UPDATE OF sale_status ON public.hubla_transactions
  FOR EACH ROW EXECUTE FUNCTION public.checkin_autocreate_from_hubla();

-- Trigger a partir de meeting_slot_attendees quando marcado contrato pago
CREATE OR REPLACE FUNCTION public.checkin_autocreate_from_attendee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exists BOOLEAN;
  v_email TEXT;
BEGIN
  IF NEW.contract_paid_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.contract_paid_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_email := NEW.attendee_email;
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.checkin_rooms
    WHERE lower(customer_email) = lower(v_email)
       OR attendee_id = NEW.id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.checkin_rooms (
    customer_name, customer_email, customer_phone,
    product_name, purchase_date, attendee_id, deal_id
  ) VALUES (
    COALESCE(NEW.attendee_name, v_email),
    v_email,
    NEW.attendee_phone,
    'A000 - Contrato',
    NEW.contract_paid_at,
    NEW.id,
    NEW.deal_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checkin_autocreate_attendee
  AFTER INSERT OR UPDATE OF contract_paid_at ON public.meeting_slot_attendees
  FOR EACH ROW EXECUTE FUNCTION public.checkin_autocreate_from_attendee();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkin_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkin_messages;
ALTER TABLE public.checkin_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.checkin_messages REPLICA IDENTITY FULL;
