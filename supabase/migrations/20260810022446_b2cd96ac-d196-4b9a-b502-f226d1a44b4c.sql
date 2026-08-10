-- checkin_rooms
DROP POLICY IF EXISTS "Equipe vê salas atribuídas ou fila geral" ON public.checkin_rooms;
DROP POLICY IF EXISTS "Equipe pode atualizar salas atribuídas ou fila geral" ON public.checkin_rooms;
DROP POLICY IF EXISTS "Admin/coord/manager veem tudo" ON public.checkin_rooms;

CREATE POLICY "MCF atendimento pode gerenciar salas"
ON public.checkin_rooms FOR ALL TO authenticated
USING (public.has_mcf_atendimento_access(auth.uid()))
WITH CHECK (public.has_mcf_atendimento_access(auth.uid()));

-- checkin_messages
DROP POLICY IF EXISTS "Ver mensagens de salas acessíveis" ON public.checkin_messages;
DROP POLICY IF EXISTS "Equipe pode inserir mensagens" ON public.checkin_messages;

CREATE POLICY "MCF atendimento ve mensagens"
ON public.checkin_messages FOR SELECT TO authenticated
USING (public.has_mcf_atendimento_access(auth.uid()));

CREATE POLICY "MCF atendimento insere mensagens"
ON public.checkin_messages FOR INSERT TO authenticated
WITH CHECK (sender_type = 'staff'::checkin_sender AND public.has_mcf_atendimento_access(auth.uid()));

CREATE POLICY "MCF atendimento atualiza mensagens"
ON public.checkin_messages FOR UPDATE TO authenticated
USING (public.has_mcf_atendimento_access(auth.uid()))
WITH CHECK (public.has_mcf_atendimento_access(auth.uid()));

-- checkin_room_events
DROP POLICY IF EXISTS "Ver eventos de salas acessíveis" ON public.checkin_room_events;
DROP POLICY IF EXISTS "Inserir eventos" ON public.checkin_room_events;

CREATE POLICY "MCF atendimento ve eventos"
ON public.checkin_room_events FOR SELECT TO authenticated
USING (public.has_mcf_atendimento_access(auth.uid()));

CREATE POLICY "MCF atendimento insere eventos"
ON public.checkin_room_events FOR INSERT TO authenticated
WITH CHECK (public.has_mcf_atendimento_access(auth.uid()));