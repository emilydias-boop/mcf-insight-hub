

# Corrigir filtro de data: filtrar por "Agendado em" (booked_at)

## Problema
O filtro de data atual filtra pelo horario da reuniao (`scheduled_at`). O usuario precisa filtrar pela coluna **"Agendado em"** (`booked_at`) para ver quais leads o SDR agendou em um dia especifico.

## Solucao

Alterar o filtro de data no `SdrLeadsTable.tsx` para usar `booked_at` em vez de `scheduled_at`:

1. **Trocar o campo filtrado** na logica de `filteredMeetings`: de `scheduled_at` para `booked_at`
2. **Renomear o label** do botao de "Data reuniao" para "Agendado em"
3. **"Hoje"** continua funcionando igual, mas agora filtra por leads agendados hoje

### Arquivo
| Arquivo | Acao |
|---------|------|
| `src/components/sdr/SdrLeadsTable.tsx` | Linha 100: trocar `scheduled_at`/`data_agendamento` por `booked_at`; Linha ~139: renomear label para "Agendado em" |

