

# Trocar blocklist por allowlist de categorias do Incorporador

## Problema

O filtro atual usa uma **lista de exclusao** (blocklist) que nao cobre todas as categorias de outras BUs. Categorias como `ob_evento`, `viver_aluguel`, `contrato_clube_arremate` ainda passam pelo filtro e inflam o "Sem Closer".

Categorias que estao vazando:
- `ob_evento` ("Imersao Presencial") - 10 transacoes
- `viver_aluguel` ("Viver de Aluguel") - 7 transacoes
- `contrato_clube_arremate` - 2 transacoes
- `outros` com produtos nao-incorporador ("Almoço The Club", "Clube do Arremate", cursos avulsos) - ~8 transacoes

## Solucao

Substituir a blocklist por uma **allowlist** (lista de permissao) com apenas as categorias que pertencem ao Incorporador. Isso e mais seguro porque qualquer nova categoria criada no futuro sera automaticamente excluida ate ser mapeada.

## Detalhes tecnicos

### Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

Substituir o `EXCLUDED_FROM_INCORPORADOR` por:

```typescript
const ALLOWED_INCORPORADOR_CATEGORIES = new Set([
  'contrato',
  'incorporador',
  'parceria',
  'a010',
  'renovacao',
  'ob_vitalicio',
  'contrato-anticrise',
  'p2',
]);
```

E mudar o filtro de:
```typescript
const filteredTxs = transactions.filter(tx => 
  !EXCLUDED_FROM_INCORPORADOR.has(tx.product_category || '')
);
```

Para:
```typescript
const filteredTxs = transactions.filter(tx => {
  const cat = tx.product_category || '';
  return ALLOWED_INCORPORADOR_CATEGORIES.has(cat) || cat === '';
});
```

Transacoes sem categoria (`null`/`''`) continuam passando para nao perder dados novos nao-mapeados.

### Categorias incluidas e motivo

| Categoria | Motivo |
|---|---|
| `contrato` | Contratos A000 da BU |
| `incorporador` | Produtos core (A001, A005, A009) |
| `parceria` | Vendas via parceiros |
| `a010` | Funil de entrada |
| `renovacao` | Renovacoes de contrato |
| `ob_vitalicio` | Order bump vitalicio |
| `contrato-anticrise` | Plano anticrise |
| `p2` | Parcela P2 |

### Categorias que serao excluidas

`clube_arremate`, `projetos`, `ob_construir_alugar`, `imersao`, `ob_construir`, `ob_evento`, `viver_aluguel`, `contrato_clube_arremate`, `consorcio`, `credito`, `formacao`, `socios`, `efeito_alavanca`, `imersao_socios`, `outros`, `a012`

### Resultado esperado

- "Sem Closer" cai de 43 para aproximadamente 20-25 (apenas transacoes incorporador sem match)
- Nenhum produto de outra BU aparece no relatorio
- Novas categorias futuras sao excluidas por padrao ate serem adicionadas a allowlist

