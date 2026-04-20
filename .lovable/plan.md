

## Liberar RLS para SDRs com capability flags ativas

### Causa raiz

A Caroline tem os flags corretos (`can_manage_agenda=true`, `can_cancel_meeting=true`) e a UI do drawer já renderiza os botões para ela. Mas quando ela clica, o **banco de dados rejeita** silenciosamente. As RLS atuais de `meeting_slots` e `meeting_slot_attendees` não consideram os novos flags:

| Tabela | Operação | Política atual | SDR passa? |
|---|---|---|---|
| `meeting_slot_attendees` | UPDATE | `booked_by = auth.uid() OR admin/coordenador/closer` | ❌ Só se ela mesma agendou |
| `meeting_slot_attendees` | DELETE | `admin/manager/coordenador` | ❌ Nunca |
| `meeting_slots` | UPDATE | `booked_by = auth.uid() OR admin/coordenador/closer` | ❌ Só se ela mesma agendou |
| `meeting_slots` | DELETE | `admin/manager/coordenador` | ❌ Nunca |

Resultado: o botão aparece, ela clica, o Supabase retorna sucesso (0 linhas afetadas) mas nada muda — exatamente o sintoma que ela está vendo.

### Solução

Criar uma função SECURITY DEFINER e estender as 4 políticas para também aceitar usuários com a flag de capacidade ligada no `profiles`.

**1. Nova função helper**
```sql
create or replace function public.has_agenda_capability(_user_id uuid, _capability text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case _capability
    when 'manage' then coalesce((select can_manage_agenda from profiles where id = _user_id), false)
    when 'cancel' then coalesce((select can_cancel_meeting from profiles where id = _user_id), false)
    when 'link_contract' then coalesce((select can_link_contract from profiles where id = _user_id), false)
    else false
  end;
$$;
```

**2. Atualizar política UPDATE de `meeting_slot_attendees`**
Adicionar `OR public.has_agenda_capability(auth.uid(), 'manage')` ao USING.

**3. Atualizar política DELETE de `meeting_slot_attendees`**
Adicionar `OR public.has_agenda_capability(auth.uid(), 'cancel')`.

**4. Atualizar política UPDATE de `meeting_slots`**
Adicionar `OR public.has_agenda_capability(auth.uid(), 'manage')`.

**5. Atualizar política DELETE de `meeting_slots`**
Adicionar `OR public.has_agenda_capability(auth.uid(), 'cancel')`.

### Migration única

```sql
-- 1. Helper function
CREATE OR REPLACE FUNCTION public.has_agenda_capability(_user_id uuid, _capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _capability
    WHEN 'manage' THEN COALESCE((SELECT can_manage_agenda FROM profiles WHERE id = _user_id), false)
    WHEN 'cancel' THEN COALESCE((SELECT can_cancel_meeting FROM profiles WHERE id = _user_id), false)
    WHEN 'link_contract' THEN COALESCE((SELECT can_link_contract FROM profiles WHERE id = _user_id), false)
    ELSE false
  END;
$$;

-- 2. meeting_slot_attendees UPDATE
DROP POLICY IF EXISTS "Users can update attendees they booked or have elevated roles"
  ON public.meeting_slot_attendees;
CREATE POLICY "Users can update attendees they booked or have elevated roles"
  ON public.meeting_slot_attendees FOR UPDATE
  USING (
    booked_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'closer'::app_role)
    OR public.has_agenda_capability(auth.uid(), 'manage')
  );

-- 3. meeting_slot_attendees DELETE
DROP POLICY IF EXISTS "Authorized roles can delete attendees"
  ON public.meeting_slot_attendees;
CREATE POLICY "Authorized roles can delete attendees"
  ON public.meeting_slot_attendees FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR public.has_agenda_capability(auth.uid(), 'cancel')
  );

-- 4. meeting_slots UPDATE
DROP POLICY IF EXISTS "Users can update slots they booked or have elevated roles"
  ON public.meeting_slots;
CREATE POLICY "Users can update slots they booked or have elevated roles"
  ON public.meeting_slots FOR UPDATE
  USING (
    booked_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'closer'::app_role)
    OR public.has_agenda_capability(auth.uid(), 'manage')
  );

-- 5. meeting_slots DELETE
DROP POLICY IF EXISTS "Authorized roles can delete meeting slots"
  ON public.meeting_slots;
CREATE POLICY "Authorized roles can delete meeting slots"
  ON public.meeting_slots FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR public.has_agenda_capability(auth.uid(), 'cancel')
  );
```

### Validação

1. Caroline (sem fazer logout — RLS é checada em runtime, não no JWT) abre uma reunião onde ela **não é** a `booked_by`
2. Clica "Realizada" → status muda ✅
3. Clica "Voltar p/ Agendada" → reverte ✅
4. Clica "Cancelar Reunião" no R2 → reunião cancela ✅
5. Outro SDR sem flags ligadas (ex: Geison) tenta o mesmo → continua bloqueado ✅
6. Admins/managers/coordenadores → continuam funcionando como antes ✅

### Por que não precisa logout

`has_agenda_capability()` lê direto de `profiles` no momento da query, não do JWT. Então qualquer mudança feita em `/usuarios` vale **imediatamente** na próxima ação da Caroline — sem precisar refresh nem relogin.

### Escopo

- 1 migration SQL (1 função nova + 4 policies recriadas)
- Zero alteração de frontend (UI já está correta)
- Zero alteração em `useMyAgendaCapabilities`, drawers, hooks
- Reversível: basta desligar o flag no `/usuarios` que a permissão evapora

