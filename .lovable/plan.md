

# Tornar "Sem closer" clicavel com o mesmo detalhamento

## Problema

Na tabela "Faturamento por Closer", a linha "Sem closer" nao e clicavel — diferente das linhas dos closers que abrem um popup com KPIs, breakdown por categoria e detalhamento de parcerias. O usuario quer ver os mesmos dados para as transacoes sem atribuicao.

## Mudanca

### Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

Tornar a linha "Sem closer" clicavel, usando o mesmo botao das demais linhas para abrir o `CloserRevenueDetailDialog`.

**Antes (linhas 186-189)**:
```text
) : (
  <span className="font-medium text-muted-foreground">{row.name}</span>
)}
```

**Depois**:
```text
) : (
  <button
    className="font-medium text-left hover:underline cursor-pointer text-muted-foreground"
    onClick={() => setSelectedCloser({ id: row.id, name: row.name })}
  >
    {row.name}
  </button>
)}
```

### Resultado

- Clicar em "Sem closer" abrira o mesmo popup de detalhamento
- O popup mostrara: KPIs (Contratos, Parcerias, Reembolsos, Total), Breakdown por Categoria e Detalhamento de Parcerias das transacoes sem closer atribuido
- A comparacao com mes anterior sera desabilitada automaticamente (pois o closerId `__unassigned__` nao tera attendees correspondentes)

