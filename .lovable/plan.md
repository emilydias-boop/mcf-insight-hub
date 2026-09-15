# Correção de raiz: troca de closer e reagendamento na Agenda

## Bug 1 — troca de closer grava o cadastro errado (R2 em reunião de R1)

Confirmado no código: em `src/components/crm/MoveEntireMeetingModal.tsx` a lista de destino vem de `useClosers()` (`src/hooks/useCloserScheduling.ts`), que busca **todos** os closers ativos, sem filtrar `bu` nem `meeting_type`. Como a mesma pessoa tem uma linha por BU e por tipo de reunião, a mesma pessoa aparece repetida e pode ser gravada a linha de R2 num slot de R1. A gravação (`meeting_slots.closer_id`) não valida nada antes.

### Arquivos alterados

1. **`src/hooks/useCloserScheduling.ts`**
   - `useClosers` passa a aceitar filtros opcionais `{ bu, meetingType }` e aplica `is_active = true`, `bu = ...` e `meeting_type = ...` na consulta, ordenando por nome. Sem filtros, comportamento atual preservado (não quebra as outras telas que usam o hook).
   - Nova função utilitária de validação `assertCloserMatchesSlot(closerId, slotId)`: lê `closers.meeting_type/bu/name` e `meeting_slots.meeting_type`; se ambos não forem nulos e forem diferentes, lança erro com a mensagem exigida:
     `"{Nome} não possui cadastro de closer {R1/R2} na BU {bu}. Cadastre em Configurações › Closers antes de transferir."`

2. **`src/components/crm/MoveEntireMeetingModal.tsx`**
   - Aba "Trocar Closer": lista alimentada pelos closers da **mesma BU do closer atual do slot** e com **`meeting_type` igual ao `meeting_slots.meeting_type`** da reunião em questão, excluindo o closer atual — uma pessoa, uma linha.
   - Antes do `update` de `closer_id`, chama `assertCloserMatchesSlot`; erro aborta a mutação e exibe o toast, sem gravar nada. O log em `attendee_movement_logs` continua igual.
   - Aba "Mover p/ outro slot": ao criar o slot destino (`insert` em `meeting_slots`), passa a gravar `meeting_type` igual ao da reunião de origem e valida o closer destino pela mesma regra (hoje o insert não define `meeting_type`).

3. **Outros pontos que gravam `meeting_slots.closer_id`** (levantados na busca; todos recebem a mesma validação/consistência de `meeting_type`):
   - `src/hooks/useAgendaData.ts` → `useRescheduleMeeting` (grava `closer_id` quando há troca de closer no reagendamento).
   - `src/hooks/useTransferR2Attendee.ts` → cria slot com `meeting_type: 'r2'`; passa a validar que o closer destino é `r2`.
   - `src/hooks/useR2AgendaData.ts` (dois pontos: busca/criação de slot destino e criação de slot novo) → validar `r2`.
   - `src/hooks/useCloserScheduling.ts` → `useBookMeeting` (insert de slot) → validar contra o `meeting_type` do slot criado.
   - `supabase/functions/create-manual-approved-lead/index.ts` → insert de slot com `closer_id`: passa a conferir o `meeting_type` do closer antes de inserir e retorna erro explícito.

Nada de metas, ranking, remuneração ou atribuição de venda é tocado.

## Bug 2 — reagendamento deixa o participante invisível

Confirmado: em `useMoveAttendeeToMeeting` (`src/hooks/useAgendaData.ts`, ~2495) e em `MoveEntireMeetingModal` (`moveAll`) o mesmo registro de `meeting_slot_attendees` é apontado para o slot novo **e** recebe `status = 'rescheduled'`. Além disso o gatilho de banco `trg_reset_attendee_status_on_same_day_move` força `status = 'rescheduled'` sempre que o participante muda de slot no mesmo dia — ou seja, mesmo corrigindo o código, o banco continuaria escondendo a reunião. Telas como a Agenda filtram `rescheduled` para fora da visão padrão.

Dois caminhos possíveis, e preciso da sua escolha antes de implementar:

**Opção A (recomendada) — um único registro, sempre ativo**
- O registro movido para o slot novo fica com status ativo (`invited`), `is_reschedule = true`.
- O gatilho de banco passa a **não** forçar `rescheduled` na troca de slot (mantém a anulação do no-show, que é o objetivo original dele: quem foi remanejado no mesmo dia não leva falta).
- O histórico continua inteiro em `attendee_movement_logs` (`previous_status`, slots de origem/destino), que é a fonte que a tela de histórico já lê.
- Vantagem: não cria linha nova, então **a contagem literal da Agenda R1 (520 / 299 / 155 / 66) não muda**.

**Opção B — dois registros (histórico no slot antigo)**
- Como você descreveu: registro antigo permanece no slot antigo com `rescheduled`, e um registro **novo** é criado no slot novo com status ativo.
- Dois problemas concretos: (1) o painel conta reuniões **linha por linha** de `meeting_slot_attendees`, então cada reagendamento passaria a somar +1 em "R1 Agendada"; (2) `parent_attendee_id` hoje significa "acompanhante/parceiro" e é usado pela agenda para renderizar convidados — reaproveitá-lo para encadear reagendamentos exigiria coluna nova (`rescheduled_from_attendee_id`) para não misturar os dois significados.

Se você confirmar a Opção B, o plano ganha a coluna nova e uma revisão explícita das contagens; a Opção A resolve a invisibilidade sem tocar em número nenhum.

### Arquivos alterados (comum às duas opções)
- `src/hooks/useAgendaData.ts` — `useMoveAttendeeToMeeting`: status ativo no registro do slot novo; `useRescheduleMeeting` mantém o slot em `rescheduled` (isso é o slot, não o participante) sem afetar visibilidade.
- `src/components/crm/MoveEntireMeetingModal.tsx` — `moveAll` com a mesma semântica.
- `src/hooks/useTransferR2Attendee.ts` — já usa `scheduled` (ativo); apenas alinhado ao status ativo escolhido.
- `src/components/crm/MoveAttendeeModal.tsx` — ajuste de rótulo/aviso se necessário para refletir a nova semântica.

Nenhum registro é apagado; `attendee_movement_logs` continua sendo inserido como hoje.

## Migração de proteção (SQL)

```sql
CREATE OR REPLACE FUNCTION public.validate_slot_closer_meeting_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closer_type text;
  v_closer_name text;
  v_closer_bu   text;
BEGIN
  IF NEW.closer_id IS NULL OR NEW.meeting_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.closer_id IS NOT DISTINCT FROM OLD.closer_id
     AND NEW.meeting_type IS NOT DISTINCT FROM OLD.meeting_type THEN
    RETURN NEW;
  END IF;

  SELECT c.meeting_type, c.name, c.bu
    INTO v_closer_type, v_closer_name, v_closer_bu
  FROM public.closers c
  WHERE c.id = NEW.closer_id;

  IF v_closer_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_closer_type <> NEW.meeting_type THEN
    RAISE EXCEPTION
      '% não possui cadastro de closer % na BU %. Cadastre em Configurações › Closers antes de transferir. (slot=%, closer_meeting_type=%)',
      COALESCE(v_closer_name, NEW.closer_id::text),
      upper(NEW.meeting_type),
      COALESCE(v_closer_bu, 'indefinida'),
      NEW.meeting_type,
      v_closer_type
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_slot_closer_meeting_type ON public.meeting_slots;
CREATE TRIGGER trg_validate_slot_closer_meeting_type
BEFORE INSERT OR UPDATE OF closer_id, meeting_type ON public.meeting_slots
FOR EACH ROW
EXECUTE FUNCTION public.validate_slot_closer_meeting_type();
```

Se a Opção A for aprovada, a mesma migração ajusta `public.reset_attendee_status_on_same_day_move` para deixar de forçar `rescheduled` (mantendo apenas a anulação do no-show e `is_reschedule = true`).

Observação: o gatilho valida a partir de agora; registros antigos incompatíveis continuam como estão (nenhum UPDATE de correção de dados será feito). Se algum slot histórico incompatível ainda receber `update` de outra coluna, o gatilho não dispara — ele só olha `closer_id` e `meeting_type`.

## Verificação antes de fechar
- Trocar closer numa reunião de R1 mostrando só cadastros R1 da BU, e conferir que a reunião continua na grade.
- Tentar gravar um closer R2 num slot R1 por caminho direto e ver o erro do gatilho.
- Reagendar o participante (mesmo dia e dia seguinte) e conferir que ele aparece no slot novo e que o histórico de movimentação continua completo.
- Build/typecheck.
