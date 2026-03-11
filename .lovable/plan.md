

## Diagnóstico: Dois Problemas Identificados

### Problema 1: Slot 17:00 da Jessica não aparece no "Por Sócio"

**O que encontrei no banco:**
- O slot 17:00 para Jessica Martins **EXISTE** na tabela `r2_daily_slots` (id: `5a91c21e-...`)
- Total de 13 slots para 11/03, incluindo o 17:00 dela
- O hook `useR2DailySlotsForView` retorna 13 slots (confirmado no console)
- **Porém**: existe um `meeting_slot` órfão (SEM participantes) no mesmo horário 17:00 BRT (20:00 UTC) para Jessica (id: `51469efc-...`, status: scheduled)

**Causa raiz**: O slot órfão pode estar interferindo na lógica de disponibilidade. Embora o `useR2MeetingsExtended` filtre slots sem participantes, o hook pode estar criando um conflito intermitente. Adicionalmente, a correção de cache anterior (staleTime 5s + invalidação ao fechar dialog) pode não ter entrado em vigor se a página não foi recarregada.

**Correção**:
1. Limpar o meeting_slot órfão (sem attendees) para Jessica no dia 11/03 às 17:00
2. Adicionar lógica no `R2CloserColumnCalendar` para ignorar explicitamente meeting_slots sem participantes na verificação de disponibilidade
3. Forçar `refetchOnMount: true` no hook `useR2DailySlotsForView` para garantir dados frescos ao trocar de aba

### Problema 2: Visão "Calendário" (semana) praticamente vazia

**O que vejo no screenshot**: Apesar de 46 reuniões existirem, a visão semanal mostra apenas o cabeçalho dos dias, uma barra verde no Wednesday com "07:00", e um botão "+ Claudia" no canto.

**Causa provável**: A `AgendaCalendar` no modo semana para R2 tem problemas de layout:
1. Os meeting cards usam `position: absolute` com `height` de 144px (40min ÷ 15min × 48px) mas as células-pai têm apenas 48px — o overflow precisa funcionar perfeitamente
2. O grid CSS pode estar colapsando as colunas quando há muitos closers (5 closers × min-width 140px = 700px)
3. As reuniões podem estar renderizando mas fora da área visível (scroll errado), ou o cálculo de `timeSlots` pode estar gerando uma range incorreta

**Correção**:
1. Verificar e corrigir o cálculo de `timeSlots` no `AgendaCalendar` para R2 semana — garantir que os slots configurados E reuniões sejam considerados
2. Reduzir `duration_minutes` de 40 para 30 na conversão `meetingsAsMeetingSlots` (R2 usa slots de 30min, não 40) — isso evita que cards de 144px sobreponham slots vizinhos
3. Ajustar `overflow-visible` nos containers do grid para garantir que cards multi-slot não sejam cortados
4. Revisar o auto-scroll para posicionar na primeira reunião do dia ao abrir a aba Calendário

### Arquivos a editar

- `src/components/crm/R2CloserColumnCalendar.tsx` — ignorar orphan meetings
- `src/pages/crm/AgendaR2.tsx` — corrigir `duration_minutes: 40 → 30`, adicionar refetch ao trocar tabs
- `src/hooks/useR2DailySlotsForView.ts` — adicionar `refetchOnMount: true`
- `src/components/crm/AgendaCalendar.tsx` — revisar layout/overflow do week view para R2
- Migração SQL para limpar meeting_slots órfãos

