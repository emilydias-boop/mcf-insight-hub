

# Corrigir Outsides orfaos sem criar deals automaticamente

## Problema confirmado

Thiago Desidera: contato existe (8c21c...), tem 2 transacoes A010 + 2 contratos A000, mas **nenhum deal** no CRM. Causa: race condition no webhook (eventos duplicados simultaneos).

## Preocupacao do usuario

Se criarmos deals automaticamente para todo contrato orfao, podemos criar deals falsos quando alguem compra no nome de outra pessoa (socio, esposa, etc.).

## Solucao revisada: 2 partes

### Parte 1: Fix preventivo no webhook (evitar novos orfaos)

**Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`**

Na funcao `createOrUpdateCRMContact`, apos o upsert com `ignoreDuplicates: true` (linha 603-610):
- Quando `newDeal` e null E `dealError` e null (upsert ignorado), fazer um SELECT para confirmar que o deal realmente existe
- Se NAO existir (orfao por race condition), fazer INSERT direto como fallback
- Adicionar log explicito: `"Deal verificado/criado via fallback"`

Isso corrige o caso do Thiago para futuras compras — o deal sera criado mesmo com eventos duplicados.

### Parte 2: Listar orfaos existentes para revisao manual (sem criar deals)

**Arquivo: `supabase/functions/distribute-outside-leads/index.ts`**

Adicionar uma secao extra no response que lista contratos orfaos encontrados:
- Buscar `hubla_transactions` com `product_category IN ('contrato','incorporador')`, `product_name ILIKE '%contrato%'`, `sale_status = 'completed'`, ultimos 30 dias
- Para cada email, verificar se existe `crm_contacts` com deal na origin "PIPELINE INSIDE SALES"
- Se tem contato mas SEM deal: incluir na lista `orphan_contracts` do response (email, nome, data, produto)
- Se nem contato tem: incluir na lista `no_contact_contracts`
- **NAO criar deals** — apenas informar para revisao manual

O botao de distribuicao no frontend mostrara esses orfaos como aviso:
> "X contratos sem deal no CRM detectados. Verifique manualmente."

### Parte 3: Botao de correcao manual no frontend

**Arquivo: `src/components/crm/OutsideDistributionButton.tsx`**

Quando o response incluir `orphan_contracts`, mostrar uma secao extra no dialog:
- Lista dos orfaos com nome, email, data do contrato
- Botao "Criar Deal" individual para cada um (chamando o webhook handler com os dados corretos)
- Isso da controle ao coordenador para decidir caso a caso se o contrato e legitimo ou se foi compra no nome de terceiro

## Arquivos alterados
1. `supabase/functions/hubla-webhook-handler/index.ts` — fallback apos upsert ignorado
2. `supabase/functions/distribute-outside-leads/index.ts` — listar orfaos sem criar deals
3. `src/components/crm/OutsideDistributionButton.tsx` — mostrar orfaos para acao manual

## Resultado
- Novos webhooks nao geram mais orfaos (fix preventivo)
- Orfaos existentes aparecem para revisao manual, sem criar deals automaticamente
- Coordenador decide caso a caso se o contrato e legitimo

