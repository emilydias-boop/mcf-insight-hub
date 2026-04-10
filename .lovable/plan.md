

# Fix: Encaixar atualiza status para Aprovado

## Problema
Ao encaixar um lead, só o `carrinho_week_start` é atualizado. O `r2_status_id` permanece como "Próxima Semana", então o lead não aparece na aba Aprovados da semana de encaixe.

## Correção

**Arquivo:** `src/hooks/useEncaixarNoCarrinho.ts`

Na mutation, antes do update:
1. Buscar o ID do status "Aprovado" em `r2_status_options`
2. Atualizar tanto `carrinho_week_start` quanto `r2_status_id` no mesmo update

```typescript
// Buscar status Aprovado
const { data: statusOptions } = await supabase
  .from('r2_status_options')
  .select('id, name')
  .eq('is_active', true);

const aprovadoId = statusOptions?.find(s => 
  s.name.toLowerCase().includes('aprovado')
)?.id;

// Update duplo
const { error } = await supabase
  .from('meeting_slot_attendees')
  .update({ 
    carrinho_week_start: weekStartStr,
    r2_status_id: aprovadoId
  })
  .eq('id', attendeeId);
```

Resultado: lead encaixado aparece como Aprovado na semana escolhida.

