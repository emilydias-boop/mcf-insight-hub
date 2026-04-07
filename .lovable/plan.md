

# Substituir botao "Hoje" por filtro de data da reuniao

## Problema
O botao "Hoje" e redundante (ja da pra selecionar hoje no date picker de "Agendado em"). O usuario quer um segundo filtro de data para filtrar pela **data da reuniao** (`scheduled_at`).

## Solucao

No `SdrLeadsTable.tsx`:

1. **Remover** o botao "Hoje" (linhas 165-172)
2. **Adicionar estado** `meetingDateFilter` (Date | undefined)
3. **Adicionar segundo DatePicker** com label "Reuniao em" que filtra por `scheduled_at`
4. **Adicionar logica de filtro** no `filteredMeetings`: comparar `scheduled_at` com startOfDay/endOfDay do `meetingDateFilter`
5. **Atualizar** `hasActiveFilters` e "Limpar filtros" para incluir o novo filtro

### Layout final dos filtros
```text
[🔍 Buscar lead...] [📅 Agendado em] [📅 Reuniao em] [Status ▼] [Tipo ▼] [Limpar]
```

### Arquivo
| Arquivo | Acao |
|---------|------|
| `src/components/sdr/SdrLeadsTable.tsx` | Remover botao Hoje, adicionar state + DatePicker + filtro para `scheduled_at` |

