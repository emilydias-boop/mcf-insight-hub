

## Fix: Enriquecimento de "Parceria" genérica está pegando "A000 - Contrato"

### Causa raiz

O enriquecimento de transações genéricas "Parceria" (linhas 306-311) busca transações do mesmo email no Hubla com `product_category IN ('incorporador', 'parceria', 'ob_vitalicio')`. Como "A000 - Contrato" tem category `incorporador`, ele é selecionado como candidato. Na prioridade (linhas 323-328), A000 cai no bucket 5 (outros), mas se não existir A001/A009/etc para aquele email, o A000 é usado — substituindo o nome "Parceria" por "A000 - Contrato".

### Correção

**`src/hooks/useR2CarrinhoVendas.ts`** — 2 pontos:

1. **Filtrar A000/Contrato dos candidatos de enriquecimento** (após linha 318): antes de ordenar, excluir transações cujo nome contém "A000" ou "Contrato" (case-insensitive), pois são pagamentos de contrato e não produtos de parceria.

```typescript
const filteredMatches = (hublaMatches || []).filter(match => {
  const name = match.product_name?.toUpperCase() || '';
  return !name.includes('A000') && !name.includes('CONTRATO');
});
```

2. **Usar `filteredMatches` no sort** em vez de `hublaMatches` (linha 319).

Isso garante que apenas produtos de parceria reais (A001, A009, A003, A004, etc.) sejam usados para enriquecer transações genéricas.

### Arquivo alterado
- `src/hooks/useR2CarrinhoVendas.ts`

