

## Enriquecer tab "Avançaram" com detalhes do carrinho

### Problema
A tab "Avançaram" mostra apenas dados basicos (nome, telefone, closer, data R2). O usuario precisa ver a jornada completa do carrinho: data da compra do contrato, data da R1, se comprou parceria, e quando.

### Alteracoes

**1. Hook `useCarrinhoAnalysisReport.ts`**

Enriquecer `LeadAvancado` com novos campos:
- `dataR1: string | null` — data da R1 do lead (ja temos `r1DateByContactId`, so precisa mapear)
- `comprouParceria: boolean` — se comprou produto com `product_category = 'parceria'`
- `dataParceria: string | null` — data da compra da parceria
- `valorContrato: number` — `net_value` da transacao do contrato

Para parceria: apos processar os contratos, fazer uma query batch em `hubla_transactions` com `product_category = 'parceria'` e `customer_email IN (emails dos avancados)`, filtrar por `sale_status IN ('completed', 'paid')`. Montar um map email → { date, product_name }.

Para R1: ja temos `r1DateByContactId` no hook. Basta usar `crmContactMap` para pegar o `contact_id` e buscar a data.

**2. Painel `CarrinhoAnalysisReportPanel.tsx`**

Atualizar tabela "Avançaram" com novas colunas:
- **Data Contrato** (ja existe como "Data Compra")
- **Data R1** — formatada dd/MM/yy HH:mm
- **Data R2** (ja existe)
- **Parceria** — badge verde "Sim" com data, ou "—"
- Remover coluna "Produto" (sempre A000) e "Outside" (pouco relevante aqui)

Ordem das colunas: Nome | Telefone | UF | Data Contrato | Data R1 | Data R2 | Closer | Parceria | Status

Atualizar export Excel com os mesmos campos.

### Detalhes tecnicos
- Query de parceria: `supabase.from('hubla_transactions').select('customer_email, sale_date, product_name').eq('product_category', 'parceria').in('sale_status', ['completed', 'paid']).in('customer_email', emails)` — executada em paralelo com as queries existentes
- R1 date: reutilizar `r1DateByContactId` que ja e construido na linha 324

