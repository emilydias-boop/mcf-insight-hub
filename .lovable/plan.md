
Objetivo
- Fazer a tela /crm/negocios voltar a carregar negócios imediatamente (o “não apareceu nada” hoje é um bug de seleção/IDs).
- Enquanto isso, deixar o dropdown “Funil” mostrar só 1 “Lançamento” (o mais recente), mesmo que ainda existam duplicados no banco (Live), para você não ficar travada esperando limpeza manual.

Diagnóstico (o que está acontecendo agora)
1) Bug de ID (causa do “não apareceu nada”)
- Em src/pages/crm/Negocios.tsx, o estado selectedPipelineId está sendo usado como se fosse “pipeline/group id”.
- Porém, o código de default (SDR_AUTHORIZED_ORIGIN_ID e BU_DEFAULT_ORIGIN_MAP) está setando selectedPipelineId com um ORIGIN_ID em alguns casos.
- Aí o hook useCRMOriginsByPipeline (src/hooks/useCRMOriginsByPipeline.ts) assume que pipelineId é group_id e faz:
  - crm_origins.eq('group_id', pipelineId)
  - Se pipelineId é um origin_id, isso volta vazio → pipelineOrigins fica vazio → effectiveOriginId pode ficar undefined → a tela não carrega negócios.
- Isso explica o comportamento “vazio”, independentemente de você ter duplicados ou não.

2) Duplicados no dropdown (causa do “aparece várias e vazias”)
- PipelineSelector busca TODOS os crm_groups e renderiza direto.
- Não há filtro para:
  - is_archived = false
  - deduplicar por nome/display_name (ex: manter só o mais recente “Lançamento / Live”)
- Então, mesmo após você limpar Test, o Live segue com “n” grupos iguais e o dropdown continua poluído.

Solução proposta (em duas camadas)
Camada A (urgente): corrigir a lógica para sempre existir um effectiveOriginId válido
- Ajustar Negocios.tsx e/ou useCRMOriginsByPipeline.ts para lidar quando “pipelineId” na prática for um origin_id.
- Resultado: a tela volta a mostrar negócios hoje, sem depender da limpeza do banco.

Camada B (UX / “aparecer um deles pra ontem”): deduplicar e filtrar pipelines no frontend
- Mesmo que o banco Live ainda tenha duplicatas, o dropdown vai exibir apenas:
  - 1 item por nome (o mais recente)
  - e ocultar arquivados (is_archived=true)
- Resultado: você “some” com as duplicatas imediatamente no UI, e depois você pode limpar o Live com calma.

Detalhamento técnico das mudanças (o que vou implementar no código)
1) Corrigir “pipelineId pode ser originId” (não quebrar mais)
Arquivo: src/hooks/useCRMOriginsByPipeline.ts
- Hoje o hook assume “pipelineId = group_id” sempre.
- Vou torná-lo resiliente:
  - Se pipelineId vier preenchido:
    - Primeiro tentar confirmar se pipelineId existe em crm_groups (select id where id=eq(pipelineId)).
      - Se existir: comportamento atual (buscar origens por group_id).
      - Se NÃO existir: tratar pipelineId como origin_id:
        - Buscar a origin por id
        - Retornar [origin] (lista flat) para alimentar a sidebar e para o Negocios conseguir pegar default.
- Também vou corrigir um detalhe que hoje está errado:
  - Tem um trecho que faz crm_deals.eq('origin_id', pipelineId) pensando que pipelineId é origin. Isso está inconsistente (pipelineId é group_id nessa branch). Vou remover/ajustar para contar deals apenas via originIds reais (in(origin_id, originIds)).

Arquivo: src/pages/crm/Negocios.tsx
- Vou ajustar o default do effectiveOriginId para cobrir o cenário:
  - Se selectedPipelineId for um originId (detectado porque pipelineOrigins vem vazio OU o hook indicar que retornou uma origin única), usar ele diretamente como effectiveOriginId.
- Assim, mesmo que BU_DEFAULT_ORIGIN_MAP continue sendo origin_id, a tela volta a funcionar.

2) Mostrar só o pipeline mais recente no dropdown (dedupe)
Arquivo: src/components/crm/PipelineSelector.tsx
- Alterar query de pipelines para trazer também created_at e is_archived:
  - select('id, name, display_name, created_at, is_archived')
  - filtrar is_archived = false (se coluna existir; pela memória do projeto existe)
- Deduplicar no frontend:
  - Chave de dedupe: normalizar (display_name ?? name).trim().toLowerCase()
  - Para cada chave, manter o registro com created_at mais recente.
- Renderizar só a lista deduplicada.
- Resultado: “Lançamento / Live” aparece uma vez só (o mais novo).

3) Sidebar collapsed coerente com o dropdown (opcional, mas recomendado)
Arquivo: src/components/crm/OriginsSidebar.tsx
- A query allGroups (usada quando sidebar está collapsed) hoje busca crm_groups sem filtrar is_archived e sem dedupe.
- Vou aplicar a mesma regra do PipelineSelector:
  - filtrar is_archived=false
  - dedupe por nome
- Resultado: sidebar collapsed não mostra “vários ícones iguais”.

4) Validação rápida (como vamos conferir)
- Abrir /crm/negocios:
  - Deve aparecer negócios (sem “tela vazia” por effectiveOriginId undefined).
- Dropdown Funil:
  - Deve aparecer só 1 “Lançamento / Live” (o mais recente), mesmo que o Live ainda tenha duplicados.
- Selecionar “Todos os funis”:
  - Deve carregar sidebar em árvore normalmente.
- Selecionar um funil específico:
  - Deve carregar lista de origens do grupo.
- Confirmar que não aparece mais o estado “Configure os estágios…” por causa de pipeline incorreto (a não ser que realmente esteja sem estágio).

Dependências / riscos
- Se a coluna is_archived não existir em crm_groups no Live/Test, o filtro vai falhar. Para evitar quebrar:
  - Vou implementar o filtro de forma defensiva (se der erro de coluna, fallback para não filtrar; e ainda assim aplicar dedupe).
- Se RLS estiver bloqueando select em crm_groups/crm_origins, nada vai aparecer. Mas como vocês já veem itens no dropdown hoje, isso provavelmente está ok.

O que você vai ganhar “pra ontem”
- Mesmo sem rodar mais SQL nenhum agora:
  - O dropdown vai parar de mostrar “várias e vazias” (dedupe no frontend).
  - A tela vai voltar a carregar negócios (fix de effectiveOriginId).

Depois (opcional): limpeza definitiva no Live
- Ainda recomendo executar a limpeza no Live quando você quiser deixar o banco “limpo de verdade”, mas o UI já vai ficar ok imediatamente após o patch.

Arquivos que serão alterados
- src/hooks/useCRMOriginsByPipeline.ts
- src/pages/crm/Negocios.tsx
- src/components/crm/PipelineSelector.tsx
- src/components/crm/OriginsSidebar.tsx

Critério de pronto (DoD)
- Em /crm/negocios, a lista de negócios carrega sem ficar vazia por pipeline/origin mismatch.
- No dropdown “Funil”, “Lançamento / Live” aparece apenas uma vez (o mais recente).
- Nenhum erro novo no console relacionado a queries de crm_groups/crm_origins.
