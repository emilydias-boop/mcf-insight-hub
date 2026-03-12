
Diagnóstico confirmado (com código + dados):
- O problema atual não está mais na lógica de `PipelineConfigModal` de resolver origins do grupo; está no ID enviado pelo `Negocios`.
- Em `src/pages/crm/Negocios.tsx`, com pipeline única:
  - `hasSinglePipeline` usa `buAllowedGroups.length === 1` (grupo).
  - Mas `selectedPipelineId` pode ser **origin_id** (porque o default prioriza `buMapping.defaultOrigin`).
  - O modal é aberto com `targetType="group"` + `targetId={selectedPipelineId}`.
- Resultado: o modal tenta buscar grupo com ID de origin, falha silenciosamente, título fica vazio (`Configurar:`) e a seção “Distribuição de dono” mostra “Nenhuma origin encontrada...”.

Plano de correção:
1) Corrigir o alvo do modal na tela de Negócios
- Arquivo: `src/pages/crm/Negocios.tsx`
- Criar `singlePipelineGroupId` com `buAllowedGroups[0]` quando `hasSinglePipeline`.
- Abrir `PipelineConfigModal` com:
  - `targetType="group"`
  - `targetId={singlePipelineGroupId}` (não mais `selectedPipelineId`).
- Ajustar também o nome exibido no header para usar o `singlePipelineGroupId` quando estiver em modo de pipeline única (evita título genérico/incorreto).

2) Melhorar UX no modal para não perder contexto da origin atual
- Arquivo: `src/components/crm/PipelineConfigModal.tsx`
- Adicionar prop opcional `preferredOriginId?: string` (recebendo `selectedPipelineId` quando ele for origin).
- Quando grupo tiver múltiplas origins, pré-selecionar automaticamente essa origin no seletor, se pertencer ao grupo.
- Mantém o comportamento existente:
  - 1 origin no grupo: abre direto.
  - múltiplas origins: seletor.
  - 0 origins: mensagem informativa.

3) Blindagem defensiva (evitar estado “vazio” confuso)
- Arquivo: `src/components/crm/PipelineConfigModal.tsx`
- Tornar query de `targetData` de grupo mais resiliente (`maybeSingle` + fallback visual controlado) para não quebrar contexto caso ID inválido chegue no futuro.
- Exibir mensagem clara de erro de configuração se grupo/origin não for encontrado (em vez de só “Configurar:” vazio).

Detalhes técnicos:
- Não há mudança de banco/Supabase schema.
- Não altera regra de prioridade de seleção de pipeline (defaultOrigin continua útil para filtrar negócios).
- Corrige apenas a resolução de “qual entidade configurar” no modal de pipeline única, mantendo compatibilidade com o restante do fluxo.

Validação após implementação:
1. Entrar em `/crm/negocios` com BU que tenha `hasSinglePipeline = true`.
2. Clicar na engrenagem do título.
3. Confirmar:
   - Título do modal preenchido corretamente.
   - “Distribuição de dono” carrega configuração (ou seletor de origin, se múltiplas).
   - “Webhooks de Saída” e “Webhooks de Entrada” também funcionam.
4. Validar que, ao abrir em pipeline única, a origin atualmente usada no board já venha selecionada no modal (quando aplicável).
