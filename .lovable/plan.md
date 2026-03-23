

## Plano: Nova aba "Todas Reuniões" + Corrigir notas do consórcio

### Problema 1: Falta aba com visão completa de todas as reuniões
Hoje a Pós-Reunião só mostra abas por status (Realizadas aguardando ação, Propostas, Sem Sucesso). Não há como ver **todas** as reuniões independente do status atual, nem filtrar por status específico.

### Problema 2: Notas das reuniões de consórcio não aparecem no lead
As notas do closer são salvas na tabela `meeting_slot_attendees` (campo `closer_notes`), mas o `DealNotesTab` já busca essas notas. O problema provavelmente é que os deals de consórcio não possuem registros em `meeting_slot_attendees` vinculados — as reuniões consórcio usam `owner_id` no deal mas podem não ter um `meeting_slot` associado. Preciso verificar se o drawer de agenda do consórcio está de fato salvando as notas corretamente.

---

### Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useConsorcioPostMeeting.ts` | Novo hook `useTodasReunioesConsorcio()` que busca todos os deals de consórcio com meeting data, closer, status/stage, e notas (closer_notes do attendee) |
| `src/pages/crm/PosReuniao.tsx` | Nova aba "Todas Reuniões" com tabela completa, filtros de status, closer, pipeline, data, busca. Closers veem apenas suas reuniões. Export inclui notas |
| `src/hooks/useConsorcioPostMeeting.ts` | Garantir que `CompletedMeeting` e o novo tipo incluam campo `closer_notes` vindo de `meeting_slot_attendees` |

### Nova aba "Todas Reuniões"

**Dados**: Query busca deals de consórcio (todas as stages, não apenas R1 Realizada), faz JOIN com `meeting_slot_attendees` para pegar `closer_notes` e data da reunião.

**Filtros**:
- Busca por nome/telefone
- Pipeline (Viver de Aluguel / Efeito Alavanca)
- Closer
- Status/Stage (multi-select ou dropdown com todas as stages: R1 Realizada, Proposta Enviada, Contrato Pago, Sem Sucesso, etc.)
- Data início/fim

**Permissão**: Se `role === 'closer'`, usa `useMyCloser()` para identificar o closer logado e filtra automaticamente `owner_id` pelo email do closer. Admins/managers veem tudo.

**Export Excel**: Inclui coluna "Notas" com o `closer_notes` do attendee.

### Correção de notas

O hook `useRealizadas()` já busca meeting dates via `meeting_slot_attendees`, mas não traz `closer_notes`. O novo hook `useTodasReunioesConsorcio()` incluirá `closer_notes` e `notes` do attendee na query. Isso garante que as notas salvas pelo closer na agenda apareçam tanto na aba "Todas Reuniões" quanto no export.

Se as notas não estão sendo **salvas**, o problema é que o closer salva no `meeting_slot_attendees.closer_notes` mas o deal não tem `meeting_slot_attendee` associado. Verificarei se há attendees vinculados e, se necessário, o hook buscará notas também de `deal_activities` como fallback.

### Resultado esperado
- Nova aba "Todas Reuniões" na Pós-Reunião do consórcio com visão 360 de todas as reuniões
- Closers veem apenas suas reuniões automaticamente
- Filtro por status permite ver reuniões em qualquer etapa
- Export Excel inclui notas do closer
- Notas salvas na agenda aparecem corretamente no lead

