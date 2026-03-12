

## Problema: Pipeline solo não permite configurar Distribuição de Dono

### Causa raiz

Em `Negocios.tsx` (linha 738-744), quando há uma única pipeline (`hasSinglePipeline`), o `PipelineConfigModal` é aberto com `targetType="group"` e o `selectedPipelineId` (que é um group ID).

Porém em `PipelineConfigModal.tsx` (linha 215), a seção "Distribuição de dono" verifica `if (targetType !== 'origin')` e bloqueia o acesso mostrando: *"A distribuição de leads só está disponível para origins específicas"*.

Resultado: o usuário não consegue configurar distribuição nem outras funcionalidades que dependem de uma origin.

### Correção

**Arquivo: `src/components/crm/PipelineConfigModal.tsx`**

Quando `targetType === 'group'`, buscar as origins filhas desse grupo. Se houver apenas 1 origin, usar automaticamente seu ID para a distribuição. Se houver múltiplas, exibir um seletor para o usuário escolher qual origin configurar.

1. Adicionar query para buscar origins do grupo: `crm_origins` filtrado por `group_id = targetId`
2. Na seção `distribution`, em vez de bloquear para groups:
   - Se há 1 origin filha: renderizar `LeadDistributionConfig` com essa origin
   - Se há múltiplas origins: exibir `Select` para escolher a origin, depois renderizar o config
   - Se há 0 origins: mostrar mensagem informativa
3. Aplicar a mesma lógica para `webhooks` e `incoming-webhooks` no tab de Integrações (que também usam `originId`)

**Arquivo: `src/pages/crm/Negocios.tsx`**

Manter como está. A correção fica toda no modal.

### Resultado

O ícone de engrenagem na pipeline solo abrirá o modal e permitirá configurar distribuição de dono, webhooks e demais funcionalidades mesmo sendo um group, resolvendo automaticamente para a(s) origin(s) filha(s).

