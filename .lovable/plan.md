

## Plano: Total Geral usar Comissão do Efeito Alavanca (não valor de crédito)

### Problema
O "Total Geral" soma `apuradoSemanal/Mensal/Anual` de todos os setores. Para Efeito Alavanca, esse valor é o `valor_credito` (R$ 22M+), mas o que de fato entra como receita é a **comissão** (R$ 1M). Isso infla o Total Geral.

### Correção

**Arquivo: `src/hooks/useSetoresDashboard.ts`** (linhas 237-245)

Alterar o cálculo de `totais` para que, no caso do setor `efeito_alavanca`, use `comissaoSemanal/Mensal/Anual` em vez de `apuradoSemanal/Mensal/Anual`:

```typescript
const totais = {
  apuradoSemanal: setores.reduce((sum, s) => 
    sum + (s.id === 'efeito_alavanca' ? (s.comissaoSemanal || 0) : s.apuradoSemanal), 0),
  // ... mesmo padrão para mensal e anual
};
```

O card do Efeito Alavanca continua mostrando `valor_credito` como "Apurado" e a comissão abaixo, mas para o Total Geral só entra a comissão.

