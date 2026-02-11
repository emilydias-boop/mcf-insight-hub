
# Historico Cross-Pipeline e Enriquecimento do Drawer para Consorcio

## Problema
Quando o closer abre o drawer de um lead (ex: Guilherme Machado), so ve informacoes do deal atual. Mas o lead pode ter passado por varias pipelines (Incorporador, Efeito Alavanca, Gerentes de Relacionamento, etc.) e ter historico rico em cada uma. O closer precisa ver TUDO sobre o lead.

## Dados reais encontrados
O lead "Guilherme Machado" tem 6 deals em pipelines diferentes:
- Efeito Alavanca + Clube (R1 Realizada)
- Efeito Alavanca + Clube (VENDA REALIZADA 50K)
- PIPELINE INSIDE SALES (Venda realizada)
- GERENTES DE RELACIONAMENTO (MCF Credito - Construcao)
- GERENTES DE RELACIONAMENTO (Base 50K)
- Contrato Pago (sem pipeline)

O campo `contact_id` permite agrupar todos esses deals e mostrar o historico completo.

## Solucao

### 1. Novo hook: `useContactDeals.ts`
Busca todos os deals do mesmo `contact_id`, excluindo o deal atual. Retorna lista com pipeline, stage, data de criacao e custom_fields de cada deal.

```
Query: crm_deals where contact_id = X and id != currentDealId
Select: id, name, created_at, owner_id, custom_fields,
        crm_origins(name), crm_stages(stage_name, color)
Order: created_at desc
```

### 2. Novo componente: `CrossPipelineHistory.tsx`
Card colapsavel (aberto por default) mostrando todos os outros deals do contato:
- Titulo: "Historico em Outras Pipelines (X)"
- Para cada deal:
  - Pipeline (origin_name) com badge colorido
  - Stage atual com cor
  - Data de entrada
  - Owner/responsavel
- Se nao houver outros deals, nao renderiza o componente

### 3. Enriquecer o header do drawer com dados do custom_fields
Adicionar no `SdrCompactHeader.tsx`:
- Regiao/Estado: `custom_fields.estado`
- Faixa de renda: `custom_fields.faixa_de_renda`
- Exibidos como badges adicionais no header

### 4. Integrar no `DealDetailsDrawer.tsx`
Inserir o `CrossPipelineHistory` logo apos o `LeadJourneyCard`, antes do bloco de qualificacao. Isso posiciona o historico cross-pipeline em destaque para o closer.

## Secao tecnica

### Arquivo novo: `src/hooks/useContactDeals.ts`
- Hook `useContactDeals(contactId, excludeDealId)` 
- Query na tabela `crm_deals` filtrando por `contact_id`, excluindo `id = excludeDealId`
- Inclui joins com `crm_origins(name)` e `crm_stages(stage_name, color)`
- Retorna array tipado com os campos necessarios

### Arquivo novo: `src/components/crm/CrossPipelineHistory.tsx`
- Recebe `contactId` e `currentDealId` como props
- Usa `useContactDeals` para buscar dados
- Renderiza um `Collapsible` com lista de deals
- Cada deal mostra: pipeline badge, stage badge com cor, data formatada
- Clicavel para abrir o deal no drawer (troca o dealId)

### Arquivo modificado: `src/components/crm/SdrCompactHeader.tsx`
- Extrair `custom_fields.estado` e `custom_fields.faixa_de_renda` do deal
- Adicionar 2 badges adicionais na area de chips (Regiao e Renda)
- Icones: MapPin para regiao (ja importado), DollarSign para renda

### Arquivo modificado: `src/components/crm/DealDetailsDrawer.tsx`
- Importar e renderizar `CrossPipelineHistory` apos `LeadJourneyCard`
- Passar `contactId={deal.contact_id}` e `currentDealId={deal.id}`

Total: 2 arquivos novos, 2 arquivos modificados. Nenhuma mudanca de banco de dados.
