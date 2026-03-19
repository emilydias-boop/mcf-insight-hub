

## Plano: Agrupar assinaturas por cliente na tabela de Cobranças

### Situação atual
- 1686 assinaturas para 1093 clientes distintos — muitos clientes aparecem 3-9 vezes (um row por produto)
- O sync está correto: agrupa por `email + produto`, sem duplicatas reais
- Os nomes repetidos são clientes que possuem múltiplos produtos (A010, Acesso Vitalício, Construir Para Alugar, etc.)

### Solução: Visão agrupada por cliente

Criar um modo de visualização agrupado onde cada cliente aparece uma única vez com uma linha expansível mostrando seus produtos.

### Mudanças

**1. `src/components/financeiro/cobranca/CobrancaTable.tsx`**
- Adicionar toggle "Agrupar por cliente" no header da tabela
- Quando ativo, agrupar `subscriptions` por `customer_email`
- Linha principal do grupo mostra: nome, email, quantidade de produtos, soma total contratado, soma total pago, contagem de parcelas agregada, pior status do grupo
- Ao clicar na linha do grupo, expandir para mostrar sub-linhas com cada produto individual (mantendo o click para abrir drawer)
- Badge com contagem de produtos (ex: "4 produtos")

**2. `src/hooks/useBillingSubscriptions.ts`**
- Sem mudanças — os dados já vêm corretos, a agrupação é puramente visual

### Comportamento

```text
┌─────────────────────┬──────────┬─────────┬─────────┬──────────┐
│ Cliente              │ Produtos │ Status  │ V.Total │ V.Pago   │
├─────────────────────┼──────────┼─────────┼─────────┼──────────┤
│ ▶ Juliana Caldas     │ 9 prod.  │ Atrasada│ R$8.200 │ R$820    │
│   ├ A010 Consultoria │          │ Atrasada│ R$470   │ R$37     │
│   ├ Acesso Vitalício │          │ Atrasada│ R$570   │ R$160    │
│   └ Construir p/ ... │          │ Atrasada│ R$970   │ R$77     │
├─────────────────────┼──────────┼─────────┼─────────┼──────────┤
│ ▶ Lucas Terrini      │ 6 prod.  │ Atrasada│ R$4.100 │ R$350    │
└─────────────────────┴──────────┴─────────┴─────────┴──────────┘
```

- Toggle desligado = visão atual (flat, uma linha por assinatura)
- Toggle ligado = visão agrupada por cliente
- Filtros e busca continuam funcionando normalmente
- Click no sub-item abre o drawer de detalhes da assinatura individual
- Paginação opera sobre os grupos (não sobre assinaturas individuais)

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/financeiro/cobranca/CobrancaTable.tsx` | Adicionar toggle de agrupamento e lógica de expand/collapse por cliente |

