

## Resultado da varredura final

Após verificar todos os ~245 hooks e suas importações, o sistema está **praticamente limpo**. Encontrei apenas **1 arquivo órfão**:

| Arquivo | Linhas | Motivo |
|---------|--------|--------|
| `src/hooks/usePlaybookDocs.ts` | 205 | Zero importadores — substituído pelo `useNotionPlaybook.ts` que é usado em todos os componentes de playbook |

### Contexto

O sistema de Playbook migrou para usar `useNotionPlaybook.ts` (que é importado por 7 componentes). O antigo `usePlaybookDocs.ts` ficou para trás sem nenhum consumidor.

### Ação

Deletar `src/hooks/usePlaybookDocs.ts`.

### Resultado

Após essa remoção, **100% dos hooks, componentes e páginas do sistema têm pelo menos 1 importador ativo**. Não há mais código morto.

