
# Bloquear Reentrada de Parceiros no Fluxo Inicial + Lista de Retornos

## Problema
Leads que ja completaram o ciclo completo (A010 -> Contrato -> Parceria A001/A009) estao reentrando no pipeline como novos leads quando compram A010 novamente ou recebem um novo webhook do Clint. O sistema nao verifica se a pessoa ja e parceira antes de criar/atualizar o deal no fluxo inicial.

## Solucao em 3 Partes

### Parte 1: Tabela de Retornos de Parceiros

Criar uma tabela `partner_returns` para registrar quando um parceiro tenta reentrar no fluxo:

```text
partner_returns
- id (uuid, PK)
- contact_id (uuid, FK crm_contacts)
- contact_email (text)
- contact_name (text)
- partner_product (text) -- "A001", "A009", etc.
- return_source (text) -- "hubla_a010", "clint_webhook", etc.
- return_product (text) -- produto que disparou o retorno
- return_value (numeric)
- original_deal_id (uuid) -- deal da parceria original
- blocked (boolean, default true) -- se foi bloqueado de entrar no fluxo
- notes (text)
- reviewed_at (timestamptz)
- reviewed_by (uuid)
- created_at (timestamptz, default now())
```

### Parte 2: Verificacao nos Webhooks

Modificar os dois webhook handlers para verificar se o lead ja e parceiro ANTES de criar/atualizar o deal no pipeline:

**`supabase/functions/hubla-webhook-handler/index.ts`**
- Na funcao `createOrUpdateCRMContact`, antes de criar um deal novo ou atualizar um existente:
  1. Buscar em `hubla_transactions` se o email possui transacoes de produtos A001, A009, A003 ou A004 com `sale_status = 'completed'`
  2. Se sim, NAO criar/atualizar o deal no pipeline
  3. Inserir um registro em `partner_returns` com os detalhes
  4. Logar: "Parceiro detectado, bloqueado de reentrar no fluxo"

**`supabase/functions/clint-webhook-handler/index.ts`**
- Na funcao `handleDealCreated`, antes do upsert do deal:
  1. Mesma verificacao de parceria via `hubla_transactions`
  2. Se parceiro, bloquear criacao e registrar em `partner_returns`
- Na funcao `handleDealStageChanged`, no trecho que cria deal novo (linha ~1038):
  1. Mesma verificacao antes de criar

A verificacao de parceria sera uma funcao auxiliar compartilhada (inline em cada edge function):

```typescript
async function checkIfPartner(supabase: any, email: string | null): Promise<{isPartner: boolean, product: string | null}> {
  if (!email) return { isPartner: false, product: null };
  
  const PARTNER_PRODUCTS = ['A001', 'A002', 'A003', 'A004', 'A009'];
  
  const { data: transactions } = await supabase
    .from('hubla_transactions')
    .select('product_name')
    .ilike('customer_email', email)
    .eq('sale_status', 'completed')
    .limit(50);
  
  if (!transactions?.length) return { isPartner: false, product: null };
  
  for (const tx of transactions) {
    const name = (tx.product_name || '').toUpperCase();
    for (const code of PARTNER_PRODUCTS) {
      if (name.includes(code)) {
        return { isPartner: true, product: code };
      }
    }
    if (name.includes('INCORPORADOR') && !name.includes('CONTRATO')) {
      return { isPartner: true, product: 'MCF Incorporador' };
    }
    if (name.includes('ANTICRISE') && !name.includes('CONTRATO')) {
      return { isPartner: true, product: 'Anticrise' };
    }
  }
  
  return { isPartner: false, product: null };
}
```

### Parte 3: Pagina de Retornos de Parceiros (UI)

Criar uma pagina `/crm/retornos-parceiros` acessivel pelo menu do CRM:

- Tabela listando todos os registros de `partner_returns`
- Colunas: Nome, Email, Produto Parceria, Origem do Retorno, Produto Novo, Valor, Data, Status (Pendente/Revisado)
- Filtros por data e fonte de retorno
- Ao clicar em um registro, mostrar drawer com:
  - Historico do lead (transacoes anteriores)
  - O que ele comprou de novo
  - Como ele retornou ao fluxo (webhook Hubla, Clint, etc.)
  - Botao para marcar como revisado

### Parte 4: Badge no Kanban (para deals existentes que ja entraram)

No componente `DealKanbanBoard` ou nos cards de deal, adicionar deteccao de parceiro similar ao que ja existe na agenda (usando `usePartnerProductDetection`). Se um deal no Kanban pertence a alguem que ja e parceiro, exibir badge "Parceiro - A001" no card.

## Arquivos a Criar
1. `src/pages/crm/RetornosParceiros.tsx` -- pagina de listagem
2. `src/hooks/usePartnerReturns.ts` -- hook para buscar dados da tabela

## Arquivos a Modificar
1. `supabase/functions/hubla-webhook-handler/index.ts` -- adicionar verificacao de parceria
2. `supabase/functions/clint-webhook-handler/index.ts` -- adicionar verificacao de parceria
3. `src/pages/CRM.tsx` -- adicionar item no menu de navegacao
4. `src/App.tsx` -- adicionar rota

## Migracao SQL
- Criar tabela `partner_returns` com RLS
- Politica de leitura para usuarios autenticados

## Ordem de Implementacao
1. Criar tabela `partner_returns` (migracao)
2. Atualizar `hubla-webhook-handler` com verificacao
3. Atualizar `clint-webhook-handler` com verificacao
4. Criar pagina de retornos no frontend
5. Adicionar rota e navegacao
