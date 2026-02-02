
Objetivo: fazer o Kanban de Negócios carregar corretamente as etapas (stages) para a origem **“Efeito Alavanca + Clube”** (id `7d7b1cb5-2a44-4552-9eff-c3b798646b78`) e demais origens que usam `local_pipeline_stages`, corrigindo o problema “Nenhum estágio configurado” que continua aparecendo.

## Diagnóstico (confirmado com evidência)
### Causa raiz: conflito de cache/queryFn do React Query por **queryKey igual**
Hoje existem **dois lugares** no front usando a mesma chave de cache:

- Kanban: `useCRMStages(originId)` em `src/hooks/useCRMData.ts`
  - deveria buscar primeiro em `local_pipeline_stages`
- Modal “Novo Negócio”: `DealFormDialog` em `src/components/crm/DealFormDialog.tsx`
  - roda uma `useQuery({ queryKey: ['crm-stages', defaultOriginId], queryFn: ... })`
  - **essa queryFn busca apenas em `crm_stages`**, nunca em `local_pipeline_stages`
  - e ela está `enabled: !!defaultOriginId`, então executa mesmo com o dialog fechado

No TanStack Query, quando múltiplos observers usam a mesma `queryKey`, o Query “compartilha” estado e opções; na prática isso pode fazer o Kanban acabar usando (ou ser “contaminado” por) a versão que consulta apenas `crm_stages`, resultando em `[]` e exibindo “Nenhum estágio configurado”.

Isso bate com o que vimos no Network: ao clicar na origem `7d7b...`, aparecem requests para:
- `crm_groups?...` e `crm_stages?origin_id=eq.7d7b...` (vazio)
e **não** aparece request para `local_pipeline_stages?origin_id=eq.7d7b...`, mesmo ele existindo no código do `useCRMStages`.
A explicação mais consistente é o `DealFormDialog` estar “dominando” a query `['crm-stages', originId]`.

Conclusão: não é problema do banco e não é “porque veio do Clint” — é problema de **frontend/cache**.

---

## Solução (o que será implementado)
### 1) Eliminar o conflito: `DealFormDialog` não pode usar `['crm-stages', originId]`
Vamos ajustar `src/components/crm/DealFormDialog.tsx` para não sobrescrever a query do Kanban.

Opção preferida (mais consistente e simples):
- Substituir a `useQuery` interna do DealFormDialog por **`useCRMStages(defaultOriginId)`**, reutilizando a mesma lógica do Kanban (incluindo `local_pipeline_stages`).
- E ajustar para **não buscar stages quando o dialog estiver fechado**, evitando carga e evitando reconfigurar a query desnecessariamente.

Como o `useCRMStages` atual não aceita `enabled`, há duas abordagens possíveis:
A) Evoluir o `useCRMStages` para aceitar um segundo argumento opcional de options (ex.: `{ enabled?: boolean }`) e repassar ao `useQuery`.
B) No DealFormDialog, manter uma `useQuery`, mas com uma **queryKey diferente**, ex.: `['deal-form-stages', defaultOriginId]`, e internamente chamar a mesma lógica (copiada) do `useCRMStages`.

Recomendação: **A)** (melhor manutenção, 1 fonte de verdade).

### 2) Adicionar fallback “global” apenas para o formulário (se necessário)
O DealFormDialog hoje tem um comportamento: se não existir stage local para a origem, ele busca estágios globais (`crm_stages` com `origin_id IS NULL`).
O `useCRMStages` hoje não faz esse fallback global.

Vamos decidir e implementar um comportamento seguro:
- Para o Kanban: manter como está (o Kanban precisa das etapas reais do pipeline).
- Para o DealFormDialog: se `useCRMStages(defaultOriginId)` retornar vazio, então (somente no dialog) buscar estágios globais como fallback, para que o usuário consiga criar um negócio mesmo em origens legadas sem stages.

Isso será feito com uma segunda queryKey separada, tipo `['deal-form-stages-global']`, ou com lógica condicional simples no componente.

### 3) Garantir que o Kanban sempre use `useCRMStages` (sem interferência)
Após remover o conflito, o Kanban deve voltar a:
- consultar `local_pipeline_stages` para `7d7b...` e renderizar as 13 colunas.

### 4) Observabilidade (temporária, para validar)
Manteremos os logs já adicionados no `useCRMStages` apenas durante a validação.
Se preferirem, depois removemos os logs (ou deixamos atrás de um guard, ex.: `if (import.meta.env.DEV)`).

---

## Arquivos que serão alterados
1) `src/components/crm/DealFormDialog.tsx`
- Remover `useQuery` atual que usa `queryKey: ['crm-stages', defaultOriginId]`
- Reutilizar `useCRMStages(defaultOriginId)` (idealmente com `enabled: open && !!defaultOriginId`)
- Implementar fallback global apenas para o formulário, se necessário

2) `src/hooks/useCRMData.ts`
- Evoluir `useCRMStages` para aceitar `options` (ex.: `enabled`, e talvez `staleTime` customizável)
- Manter `queryKey` como `['crm-stages', originOrGroupId]`

(Provável que mais nenhum arquivo seja necessário, já que o `PipelineStagesEditor` e `useCreatePipeline` já invalidam `['crm-stages']`.)

---

## Riscos e como vamos evitar
- Risco: mudar o comportamento do formulário e impedir criação em pipelines legadas sem stages.
  - Mitigação: fallback global no DealFormDialog apenas quando não houver stages para a origem.
- Risco: continuar vendo “Nenhum estágio configurado” por causa de permissões de visualização (stage_permissions).
  - Mitigação: após corrigir o fetch, se as stages chegarem mas sumirem no Kanban, então investigamos `useStagePermissions`/`canViewStage`. Porém hoje o problema é anterior (stages nem chegam).

---

## Como vamos validar (checklist prático)
1) Abrir `/consorcio/crm/negocios`
2) Selecionar “BU - LEILÃO” e clicar “Efeito Alavanca + Clube”
3) Confirmar no Network que aparece:
   - `GET /rest/v1/local_pipeline_stages?...origin_id=eq.7d7b...` retornando 13
4) Confirmar que o Kanban renderiza as colunas com as 13 etapas
5) Abrir “Novo Negócio” e confirmar que o select de etapas está preenchido
6) Testar também uma origem legada (se existir) para garantir que o formulário ainda funciona (fallback global, se aplicável)

---

## Resultado esperado
- O Kanban deixa de mostrar “Nenhum estágio configurado” para `7d7b...`
- As etapas aparecem corretamente para essa origem e suas suborigens (quando selecionadas)
- O formulário “Novo Negócio” não interfere mais no carregamento de stages do Kanban
