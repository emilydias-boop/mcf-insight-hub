
# Adicionar Duracao de Reuniao e Leads por Reuniao na Config do Closer (Consorcio)

## Objetivo

Adicionar dois controles na tela "Configurar Closers" do R1 (usada pelo Consorcio): tempo de duracao da reuniao e quantidade maxima de leads por horario. Atualmente, esses controles existem apenas na config do R2.

## Mudancas

### 1. Nova coluna no banco de dados

Adicionar `meeting_duration_minutes` na tabela `closers` (default: 45 minutos).

```sql
ALTER TABLE closers ADD COLUMN meeting_duration_minutes INTEGER DEFAULT 45;
```

A coluna `max_leads_per_slot` ja existe (default: 4).

### 2. Atualizar CloserAvailabilityConfig.tsx

Adicionar dois controles apos o color picker, seguindo o mesmo padrao visual do R2:

- **Slider "Duracao da Reuniao"**: valores de 15 a 120 minutos (step 15). Salva no campo `meeting_duration_minutes` do closer.
- **Slider "Leads por Reuniao"**: valores de 1 a 6. Salva no campo `max_leads_per_slot` do closer. (Mesmo componente ja usado no R2.)

Ambos salvam automaticamente ao arrastar (mesmo padrao do R2).

### 3. Atualizar hooks e tipos

- Adicionar `meeting_duration_minutes` ao tipo `CloserWithAvailability` em `useAgendaData.ts`
- Adicionar mutation para salvar `max_leads_per_slot` e `meeting_duration_minutes` (usar `useUpdateCloserColor` como base ou criar mutation dedicada)
- Atualizar `types.ts` do Supabase para incluir a nova coluna

### 4. Usar duracao configurada na agenda

No `AgendaCalendar.tsx`, onde aparece `meeting.duration_minutes || 30`, o fallback ja vem do `meeting_slots.duration_minutes`. Quando um agendamento for criado, ele deve usar o `meeting_duration_minutes` do closer como duracao padrao (isso ja e feito no fluxo de booking).

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | Adicionar coluna `meeting_duration_minutes` |
| `src/components/crm/CloserAvailabilityConfig.tsx` | Adicionar sliders de duracao e max leads |
| `src/hooks/useAgendaData.ts` | Adicionar mutation para salvar configs do closer |
| `src/integrations/supabase/types.ts` | Adicionar nova coluna ao tipo |

## Secao Tecnica

### UI dos Novos Controles (entre color picker e slots)

```text
+--------------------------------------------------+
| Cor do Closer                                     |
| [cores...]                                        |
+--------------------------------------------------+
| Duracao da Reuniao: 45 min                        |  <-- NOVO
| [========|==============] (slider 15-120, step 15)|
| Tempo padrao de cada reuniao                      |
+--------------------------------------------------+
| Leads por Reuniao: 4                              |  <-- NOVO
| [===========|===========] (slider 1-6, step 1)    |
| Quantos leads no mesmo horario (padrao: 4)        |
+--------------------------------------------------+
| Segunda    7 horarios    [Copiar] [+ Adicionar]   |
| ...                                               |
+--------------------------------------------------+
```

### Mutation para salvar

Reutilizar o padrao do `useUpdateCloserColor` mas generalizar para aceitar qualquer campo:

```typescript
const updateCloserSettings = useMutation({
  mutationFn: async ({ closerId, data }: { closerId: string; data: Partial<CloserSettings> }) => {
    const { error } = await supabase
      .from('closers')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', closerId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['agenda-closers'] });
  }
});
```
