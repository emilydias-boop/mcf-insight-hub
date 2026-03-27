

## Fix: "A000 - Contrato" aparecendo na aba Vendas do Carrinho R2

### Causa raiz

A query busca corretamente apenas transacoes com `product_category = 'parceria'` — todas sao registros genéricos chamados "Parceria" (source: make).

O problema esta no **passo de enriquecimento** (linhas 290-361 do hook). Ele busca QUALQUER transacao Hubla do mesmo email na mesma semana para substituir o nome genérico "Parceria" pelo produto real. Mas essa busca nao filtra por categoria — entao se o cliente comprou um "A000 - Contrato" no Hubla, esse nome substitui "Parceria" na tela.

### Solucao

**Arquivo: `src/hooks/useR2CarrinhoVendas.ts`** — Filtrar a query de enriquecimento

Na query de enriquecimento (linha 306), adicionar filtro para excluir categorias que nao sao parceria:

```typescript
// Antes (linha 306-312):
.eq('source', 'hubla')

// Depois:
.eq('source', 'hubla')
.in('product_category', ['incorporador', 'parceria', 'ob_vitalicio'])
```

Isso garante que apenas produtos que representam a parceria real (A001, A009, A003, A004, A010) sejam usados para enriquecer o nome, excluindo "contrato", "renovacao", "clube_arremate" etc.

Alternativamente, usar `.not('product_category', 'in', '(contrato,outros,clube_arremate,imersao_socios,contrato_clube_arremate)')` para ser mais permissivo.

### Resultado esperado
- "A000 - Contrato" nao aparece mais como nome de produto na aba Vendas
- Transacoes genéricas "Parceria" sao enriquecidas apenas com nomes de produtos de parceria reais (A001, A009, A003, A004)

