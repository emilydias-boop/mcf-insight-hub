
# Corrigir SDR e Closer R1 - Causa raiz encontrada

## Problema real
A query de R1 meetings no `useR2MeetingsExtended.ts` busca **todos** os R1 meetings com `.limit(500)`, mas existem **610+ R1 meetings** no banco. Isso significa que muitos R1 meetings relevantes ficam de fora, resultando em:
- SDR mostrando "—" ou caindo no fallback do `deal.owner_id` (que e o Closer apos transferencia)
- Closer R1 mostrando "—"

Exemplo concreto: Henrique mota Welter tem R1 com `booked_by = c1ede6ed` (Leticia Nunes), mas essa R1 nao esta nos 500 resultados.

## Solucao
Alterar a query de R1 para buscar **diretamente pela tabela `meeting_slot_attendees`** filtrada pelos `dealIds` conhecidos, em vez de buscar todos os R1 meetings com limite arbitrario.

## Secao tecnica

### Arquivo: `src/hooks/useR2MeetingsExtended.ts`

**Substituir a query de R1** (linhas 132-164):

Em vez de:
```text
supabase.from('meeting_slots')
  .select(...)
  .eq('meeting_type', 'r1')
  .limit(500)
```

Usar:
```text
supabase.from('meeting_slot_attendees')
  .select(`
    deal_id,
    notes,
    booked_by,
    meeting_slot:meeting_slots!inner(
      id,
      scheduled_at,
      meeting_type,
      closer:closers!meeting_slots_closer_id_fkey(id, name)
    )
  `)
  .in('deal_id', dealIds)
  .eq('meeting_slot.meeting_type', 'r1')
  .order('created_at', { ascending: false })
```

Isso garante:
1. Busca apenas os R1 meetings dos deals relevantes (sem limite arbitrario)
2. Obtem `booked_by` do attendee (SDR correto)
3. Obtem `closer` e `scheduled_at` do meeting_slot (Closer R1 correto)
4. Funciona independente de quantos R1 meetings existem no banco

**Adaptar o processamento** dos resultados para o novo formato de resposta (attendee-centric em vez de meeting-centric).

Nenhum outro arquivo precisa ser alterado.
