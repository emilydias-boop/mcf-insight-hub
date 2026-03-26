

## Mostrar "Contatos" dentro do card de Ligações + corrigir paginação

### Problema 1: Paginação
A query em `useSdrCallMetrics.ts` não pagina — Supabase retorna no máximo 1000 rows. Se o SDR fez mais de 1000 ligações no mês, o `totalCalls` fica truncado. Isso pode explicar o 118 parecer baixo.

### Problema 2: Falta o breakdown
O card "Total Ligações" mostra só o número total. O gestor quer ver quantas foram contato e quantas não foram, **no mesmo card**.

### Solução

**Arquivo 1: `src/hooks/useSdrCallMetrics.ts`**
- Adicionar paginação na query de calls (loop com `.range()` em blocos de 1000) para garantir que todas as ligações são contadas.

**Arquivo 2: `src/hooks/useSdrPerformanceData.ts`**
- Passar `callMetrics.answered` e `callMetrics.unanswered` como dados extras na métrica "Total Ligações" (campo `extra` ou similar) para que o card possa renderizar.

**Arquivo 3: `src/components/sdr/SdrDetailKPICards.tsx`**
- No card "Total Ligações", adicionar uma linha abaixo do valor principal mostrando: `Contatos: X · Sem contato: Y` em texto menor.

### Resultado visual

```text
┌─────────────────────────┐
│ TOTAL LIGAÇÕES      ⓘ  │
│ 1.247                   │
│ ████████████░░░  67%    │
│ Meta: 1.848             │
│ Faltam 601              │
│                         │
│ Contatos: 480           │
│ Sem contato: 767        │
└─────────────────────────┘
```

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useSdrCallMetrics.ts` | Adicionar paginação na query de calls |
| `src/hooks/useSdrPerformanceData.ts` | Incluir answered/unanswered como dados extras na métrica |
| `src/components/sdr/SdrDetailKPICards.tsx` | Renderizar breakdown Contatos/Sem contato no card |

