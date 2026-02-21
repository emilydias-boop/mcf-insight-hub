
# Fix: SDRs de Consorcio Nao Veem Novas Stages Criadas

## Causa Raiz

O sistema tem **duas tabelas de estagios** que ficam dessincronizadas:

- `local_pipeline_stages` - criados pelo Editor de Pipeline no sistema
- `crm_stages` - sincronizados do Clint CRM externo

Para a origin "Efeito Alavanca + Clube" (`7d7b1cb5`):
- `local_pipeline_stages`: 14 estagios (sem "SEM SUCESSO", sem "AGUARDANDO DOC", sem "EVENTOS")
- `crm_stages`: 16 estagios (inclui "SEM SUCESSO", "AGUARDANDO DOC", "EVENTOS")

O hook `useCRMStages` **prioriza `local_pipeline_stages`**: se encontra estagios la, retorna apenas esses e ignora completamente `crm_stages`. Resultado: qualquer estagio que exista APENAS em `crm_stages` fica invisivel para todos os usuarios.

Cenarios que causam o problema:
1. Admin cria estagio no Clint CRM -> sync adiciona em `crm_stages` -> nao aparece no Kanban (porque `local_pipeline_stages` tem prioridade)
2. Admin cria estagio via Editor do sistema -> vai para `local_pipeline_stages` -> nao espelha em `crm_stages` -> causa erro de FK ao mover deals

## Solucao

Alterar o `useCRMStages` para **mesclar** as duas fontes em vez de usar uma OU outra. Estagios de `local_pipeline_stages` tem prioridade na ordem e nos atributos, mas estagios que existem apenas em `crm_stages` tambem sao incluidos.

Adicionalmente, o `PipelineStagesEditor` deve espelhar novas stages em `crm_stages` para evitar erros de FK.

### Arquivo 1: `src/hooks/useCRMData.ts` (funcao `fetchCRMStages`)

Logica atual (linhas 93-117):
```
if (localStages && localStages.length > 0) {
  // Retorna APENAS local stages, ignora crm_stages
  return uniqueStages.map(...)
}
// Fallback: retorna crm_stages
```

Nova logica:
```
// 1. Buscar local_pipeline_stages (como ja faz)
// 2. Buscar crm_stages para a mesma origin
// 3. Mesclar: local tem prioridade por nome,
//    mas stages que so existem em crm_stages sao adicionados ao final
```

Isso garante que:
- Stages criados no Editor aparecem com prioridade
- Stages sincronizados do Clint que nao foram replicados localmente tambem aparecem
- Nao ha duplicatas (dedup por nome, case-insensitive)

### Arquivo 2: `src/components/crm/PipelineStagesEditor.tsx` (mutacao de criacao)

Apos criar em `local_pipeline_stages`, tambem inserir o espelhamento em `crm_stages` com o mesmo UUID e `clint_id = 'local-{uuid}'`. Isso previne erros de FK quando deals sao movidos para o novo estagio.

## Impacto

- SDRs passam a ver todas as stages, tanto as do Editor quanto as do Clint
- Novas stages criadas pelo admin sao automaticamente espelhadas em `crm_stages`
- Nenhuma mudanca na interface visual - apenas a lista de colunas do Kanban fica completa
- Compatibilidade retroativa mantida: stages existentes continuam funcionando
