

## Melhorias no Painel de Controle do Funil Comercial

### Problemas Identificados

1. **Lead B não existe mais** — o `FunilDuplo` divide em Lead A / Lead B desnecessariamente, ocupando espaço com uma coluna vazia
2. **Período dos KPIs invisível** — os 4 cards usam a semana corrente internamente mas não mostram qual período, e o seletor de período do funil é independente dos KPIs
3. **Dois seletores de período desconectados** — KPIs fixos na semana, funil com seu próprio dropdown

### Solução

**Seletor de período global** no topo que controla KPIs + Funil + Distribuição, tudo sincronizado.

**Substituir `FunilDuplo` por funil simples (sem divisão A/B)** — usar o hook `useClintFunnel` (que já existe e retorna dados unificados) em vez do `useClintFunnelByLeadType`.

### Implementação

1. **`FunilDashboard.tsx`** — reescrever:
   - Adicionar seletor de período global (Hoje / Semana / Mês) no header, com label visível do intervalo de datas
   - Remover `FunilDuplo` e substituir por um funil simples usando `useClintFunnel` com `FunilLista` única
   - Passar o mesmo período para KPIs, funil e distribuição
   - Manter Novo Lead (Vendas A010), distribuição por etapa e listas de negócios

2. **Manter `FunilDuplo.tsx` intacto** — pode ser usado em outras páginas, não deletar

### Resultado
- 1 seletor de período controla tudo
- Funil unificado sem coluna Lead B vazia
- Período visível em texto (ex: "21/02 - 27/02/2026")

