

## Ajustar Dashboard do Closer para Visão Focada em Contratos

### Contexto

A visão do Closer é diferente do SDR. O Closer recebe reuniões agendadas, e o que importa é quantos contratos ele fecha. As mudanças necessárias:

### 1. Projeção do Período — Baseada em Contratos Pagos
**Arquivo**: `src/hooks/useCloserPerformanceData.ts`

Atualmente projeta R1 Agendada. Deve projetar **Contratos Pagos**:
- Meta final = 4 contratos/dia útil × dias úteis do período
- Realizado = `cm.contrato_pago`
- Projeção = ritmo médio de contratos × dias úteis totais
- Gap = meta - realizado
- Necessário/dia = gap / dias restantes

### 2. Evolução Diária (Gráfico) — Contratos diários vendidos
**Arquivo**: `src/hooks/useCloserPerformanceData.ts`

O gráfico deve mostrar contratos acumulados vs meta acumulada de contratos (4/dia útil), não reuniões agendadas. Agrupar leads com `contract_paid_at` por dia.

### 3. Performance Diária Detalhada — Colunas específicas do Closer
**Arquivo**: Criar `src/components/closer/CloserDailyBreakdownTable.tsx`

A tabela genérica do SDR mostra apenas "Realizado" e "Meta Dia". Para o Closer, precisa mostrar por dia:

| Data | Agendados | Realizados | No-Show | Contratos | Meta Dia | Gap | Status |

- Agendados = reuniões agendadas naquele dia
- Realizados = reuniões com status completed/contract_paid
- No-Show = reuniões com status no_show
- Contratos = reuniões com contract_paid_at naquele dia
- Meta Dia = 4 (contratos/dia útil)
- Gap = Contratos - Meta
- Status = baseado no acumulado de contratos vs meta acumulada

Isso requer um novo tipo `CloserDailyRow` com campos extras e um componente dedicado.

### 4. Ajustar meta diária base
**Arquivo**: `src/hooks/useCloserPerformanceData.ts`

Trocar `CLOSER_META_DIARIA = 10` (R1 meetings) para `CLOSER_META_DIARIA_CONTRATOS = 4` (contratos/dia).

### 5. Ajustar summaryText
Texto do resumo deve focar em contratos: "fechou X contratos de Y previstos".

### Detalhes técnicos

**Novo tipo `CloserDailyRow`** (extends DailyRow):
```text
CloserDailyRow {
  ...DailyRow fields (realized = contratos do dia)
  agendados: number    // reuniões agendadas no dia
  realizados: number   // reuniões completadas no dia
  noShows: number      // no-shows do dia
  contratos: number    // contratos pagos no dia
}
```

**Novo componente `CloserDailyBreakdownTable`**: Renderiza tabela com as 7 colunas acima + acumulado de contratos.

**Page** (`CloserMeetingsDetailPage.tsx`): Trocar `<SdrDailyBreakdownTable>` por `<CloserDailyBreakdownTable>`.

### Arquivos afetados
- `src/hooks/useCloserPerformanceData.ts` — Projeção por contratos, dailyRows por contratos, nova meta diária
- `src/components/closer/CloserDailyBreakdownTable.tsx` — Novo componente com colunas específicas
- `src/pages/crm/CloserMeetingsDetailPage.tsx` — Usar novo componente de tabela

