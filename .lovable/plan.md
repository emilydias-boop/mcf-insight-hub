

## Correção do Gráfico "Evolução Diária" — Usar data de criação do agendamento

### Problema identificado

O gráfico conta reuniões por `data_agendamento` (a data PARA quando a reunião foi marcada), não a data EM QUE o SDR fez o agendamento. Isso causa:

1. **Números diferentes da tabela detalhada** — a tabela mostra reuniões agendadas para cada dia, mas o gestor quer ver quantos agendamentos o SDR produziu naquele dia
2. **Fins de semana vazios** — como nenhuma reunião é agendada PARA sábado/domingo, esses dias aparecem como 0, mas o SDR pode ter criado agendamentos no sábado

### Correção

**Trocar o campo de agrupamento**: Em vez de `m.data_agendamento`, usar `m.booked_at` (ou `m.created_at` como fallback) para contar quantos agendamentos o SDR **fez** em cada dia.

### Implementação

**1. `src/hooks/useSdrPerformanceData.ts`** — Na construção de `dailyRows` (linhas 336-338), trocar:
```
m.data_agendamento?.substring(0, 10) === dateStr
```
por:
```
(m.booked_at || m.scheduled_at || m.data_agendamento)?.substring(0, 10) === dateStr
```
Isso usa a data em que o agendamento foi criado pelo SDR.

**2. Fins de semana visíveis** — Manter `metaDiaria: 0` para fins de semana (correto, não há meta), mas o "realizado" agora pode ser > 0 se o SDR agendou no sábado/domingo. O gráfico já renderiza todos os dias, então aparecerá automaticamente.

**3. Tabela diária** (`SdrDailyBreakdownTable`) — Aplicar a mesma lógica para consistência: o filtro de rows já inclui `r.realized > 0`, então fins de semana com atividade aparecerão.

### Arquivos afetados
- `src/hooks/useSdrPerformanceData.ts` — Alterar campo de agrupamento no cálculo de `dailyRows`

