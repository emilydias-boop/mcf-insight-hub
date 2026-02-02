
Objetivo: fazer as etapas (stages) aparecerem no Kanban para a origem **“Efeito Alavanca + Clube”** (id `7d7b1cb5-2a44-4552-9eff-c3b798646b78`) e suas suborigens, e explicar por que hoje aparece “Nenhum estágio configurado”.

## O que já dá para afirmar (com evidência)

### 1) Não é “porque foi criada direto e não veio do Clint”
As suas etapas existem no banco na tabela **`public.local_pipeline_stages`** com `origin_id = 7d7b1cb5...` e `is_active=true` (13 etapas). Ou seja: foram criadas corretamente e o Kanban deveria conseguir ler.

### 2) O Kanban está lendo a tabela errada (legada) no momento do erro
Pelos requests capturados no preview, quando você abre a origem `7d7b1cb5...`, o frontend está chamando:

- `GET /rest/v1/crm_stages?origin_id=eq.7d7b1cb5...` → retorna `[]`

E **não aparece request** equivalente para:

- `GET /rest/v1/local_pipeline_stages?origin_id=eq.7d7b1cb5...` → (que deveria retornar 13)

Isso explica 100% o “Nenhum estágio configurado”: o componente só mostra essa tela quando `stages.length === 0`.

### 3) Por que isso pode estar acontecendo mesmo com o código “certo”
Mesmo com o `useCRMStages` já preparado para priorizar `local_pipeline_stages` (e só cair para `crm_stages` como fallback), na prática o app ainda está executando o fluxo que termina no `crm_stages`. As causas mais prováveis são:
- cache/versão do bundle no navegador (hard refresh não feito) — muito comum quando o usuário alterna entre preview/published;
- algum caminho no runtime que está retornando antes de executar a query do `local_pipeline_stages` (ex.: erro silencioso, condição não atendida, ou retorno de cache antigo da query com `[]`);
- o Kanban está sendo renderizado num estado em que `originId` não é o esperado (menos provável, porque o request do `crm_stages` está com o origin correto).

## Correção proposta (o que vou implementar quando sairmos do modo leitura)

### A) Tornar o `useCRMStages` “à prova de fallback errado”
No `src/hooks/useCRMData.ts`, ajustar a implementação para:
1. **Sempre** tentar `local_pipeline_stages` primeiro (para origem ou grupo), e registrar debug.
2. Só cair no fallback do `crm_stages` se:
   - a query do `local_pipeline_stages` retornou **0** e **sem erro**, e
   - houver um motivo real para usar legado (por exemplo, pipelines antigas que ainda não migraram).
3. Se o app detectar que o `crm_stages` está vazio mas o `local_pipeline_stages` deveria existir, mostrar um aviso de diagnóstico (toast) “Etapas locais existem mas não foram carregadas; recarregue com Ctrl+F5” + botão “Recarregar”.

Implementação técnica:
- adicionar logs e contadores:
  - `[useCRMStages] originOrGroupId=...`
  - `[useCRMStages] tried local_pipeline_stages, count=X, error=...`
  - `[useCRMStages] falling back to crm_stages, reason=...`
- adicionar opções do React Query para eliminar “cache fantasma”:
  - `refetchOnMount: 'always'`
  - `refetchOnWindowFocus: true`
  - (e reavaliar `staleTime`: para stages pode ser `0` ou baixo, porque mudanças de estágio/config são sensíveis)

### B) Invalidar cache de stages após edição nas Configurações
Você confirmou que “nas Configurações eu vejo as etapas”. Então o fluxo de Configurações está gravando certo — mas o Kanban precisa refazer fetch imediatamente.

Ajuste:
- localizar o componente/tela que salva/edita etapas (ex.: `PipelineConfigModal`, `PipelineSettings`, editor de etapas do wizard) e garantir:
  - `queryClient.invalidateQueries({ queryKey: ['crm-stages'] })`
  - e, se soubermos o originId, invalidar também especificamente `['crm-stages', originId]`

### C) Adicionar um “diagnóstico visível” no Kanban (temporário)
Para não depender só de console:
- mostrar, no topo do Kanban (apenas para admin/manager), uma linha pequena:
  - `OriginId atual: ... | stages carregadas: N | fonte: local/crm`
Assim a gente confirma na hora se está vindo do local ou do legado, sem abrir DevTools.

### D) Checklist de validação (o que vamos verificar ao final)
1. Abrir `/consorcio/crm/negocios`
2. Selecionar “BU - LEILÃO” → clicar “Efeito Alavanca + Clube”
3. Confirmar no Network:
   - existe request para `local_pipeline_stages?origin_id=eq.7d7b...` retornando 13
   - `crm_stages` não é mais usado como fonte principal
4. Confirmar que as colunas do Kanban aparecem com as 13 etapas.

## Ação imediata (sem código) para você testar agora
Antes de eu mexer em mais código, faça um hard reload real para garantir que está com o bundle atualizado:
- Windows: **Ctrl + Shift + R** (ou Ctrl+F5)
- Se não resolver: DevTools → Application → **Clear site data** → reload

Se mesmo após isso continuar aparecendo “Nenhum estágio configurado”, aí confirmamos que é 100% runtime/fallback e aplicamos as mudanças A/B/C acima.

## Arquivos envolvidos
- `src/hooks/useCRMData.ts` (principal: reforçar prioridade do local + opções de refetch + logs)
- Arquivo(s) de Configurações/edição de etapas (para invalidar cache após salvar) — vou localizar no projeto e listar exatamente antes de implementar
- (Opcional) `src/components/crm/DealKanbanBoard.tsx` (diagnóstico visível/temporário)

## Por que isso resolve
Porque o problema atual não é “falta de etapas no banco”; é “o Kanban está consultando `crm_stages` (legado) e retornando vazio”. Forçando a prioridade do `local_pipeline_stages`, refazendo fetch na montagem/foco e invalidando cache após edições, o Kanban passa a refletir as 13 etapas que já existem para a origem.
