

# Corrigir Scroll e Historico Cross-Pipeline

## Problema 1: Historico nao aparece
Alguns deals do mesmo lead (ex: Guilherme Machado) nao possuem `contact_id` preenchido no banco. Quando o deal aberto tem `contact_id = NULL`, o componente `CrossPipelineHistory` retorna vazio pois a condicao `!contactId` e verdadeira.

**Solucao**: Fazer fallback buscando pelo nome do contato. Se `contact_id` estiver vazio, buscar deals com o mesmo `name` na tabela `crm_deals`.

### Arquivo modificado: `src/hooks/useContactDeals.ts`
- Aceitar um parametro adicional `dealName` como fallback
- Se `contactId` existir, buscar por `contact_id` (comportamento atual)
- Se `contactId` for null mas `dealName` existir, buscar por `name` (fallback por nome)
- Isso cobre os deals que nao tem contact_id populado

### Arquivo modificado: `src/components/crm/CrossPipelineHistory.tsx`
- Aceitar nova prop `dealName`
- Passar para o hook `useContactDeals`
- Remover a condicao `!contactId` que retorna null (agora pode funcionar sem contactId)

### Arquivo modificado: `src/components/crm/DealDetailsDrawer.tsx`
- Passar `dealName={deal.name}` como prop adicional ao `CrossPipelineHistory`

## Problema 2: Scroll nao funciona
O container interno com `flex-1 overflow-y-auto` nao scrolla porque em contexto flex, `min-height` padrao e `auto`, impedindo que o item encolha abaixo do tamanho do conteudo.

### Arquivo modificado: `src/components/crm/DealDetailsDrawer.tsx`
- Adicionar `min-h-0` ao container scrollavel (linha 97)
- De: `className="flex-1 overflow-y-auto p-4 space-y-3"`
- Para: `className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3"`

## Resumo
- 3 arquivos modificados
- Scroll corrigido com `min-h-0`
- Historico cross-pipeline funciona mesmo sem `contact_id` (fallback por nome)
