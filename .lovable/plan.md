
Objetivo: corrigir definitivamente o modal de configuração da pipeline solo em `/crm/negocios`, que ainda abre como “Pipeline não encontrada”.

Diagnóstico confirmado:
- Pelos logs atuais, o `PipelineConfigModal` está recebendo `targetType="group"` com `targetId=e3c04f21...`.
- Esse ID é de **origin** (PIPELINE INSIDE SALES), não de **group**.
- Por isso:
  - busca em `crm_groups` falha;
  - `groupOrigins` vem vazio;
  - aparece “Pipeline não encontrada” e “Nenhuma origin encontrada...”.

Do I know what the issue is? Sim.
Problema exato: há cenários em que o modal recebe ID de origin para fluxo de group; o modal hoje não se autocorrige.

Plano de implementação

1) Blindar o modal para aceitar ID “errado” sem quebrar
- Arquivo: `src/components/crm/PipelineConfigModal.tsx`
- Criar resolução interna de alvo:
  - se `targetType="group"` e `targetId` não existir em `crm_groups`,
  - tentar `crm_origins` por esse mesmo ID,
  - se existir, usar `origin.group_id` como `effectiveGroupId`.
- Todas as queries dependentes (nome da pipeline, `groupOrigins`, distribuição/webhooks) passam a usar `effectiveGroupId`.
- Remover os `console.log` temporários e manter fallback visual claro.

2) Corrigir origem do ID no Negócios (fonte primária)
- Arquivo: `src/pages/crm/Negocios.tsx`
- Criar `singlePipelineGroupId` robusto:
  - prioridade: `buAllowedGroups[0]` válido em `pipelines` (crm_groups),
  - fallback: se `selectedPipelineId` for origin, resolver `group_id`.
- Passar esse ID no modal (`targetId={singlePipelineGroupId}`).
- Manter `preferredOriginId={selectedPipelineId}` para preservar contexto da origin.

3) Ajustar título da página para pipeline solo
- Arquivo: `src/pages/crm/Negocios.tsx`
- Em `hasSinglePipeline`, mostrar nome do group por `singlePipelineGroupId` (não por `selectedPipelineId`), evitando “Pipeline de Vendas” genérico.

Validação (fim-a-fim)
1. Abrir `/crm/negocios` (BU Incorporador).
2. Clicar na engrenagem do título.
3. Confirmar:
   - título do modal com nome da pipeline;
   - aba “Distribuição de dono” carregando origins;
   - webhooks de saída/entrada abrindo normalmente.
4. Verificar no console:
   - `targetType=group`;
   - `effectiveGroupId=a6f3cbfc...`;
   - `groupOrigins loaded > 0`.

Detalhes técnicos
- Sem mudança de schema/migrations.
- Correção é defensiva em 2 camadas:
  - camada chamadora (`Negocios`) envia ID correto;
  - camada modal (`PipelineConfigModal`) auto-recupera quando vier ID de origin por qualquer fluxo futuro.
