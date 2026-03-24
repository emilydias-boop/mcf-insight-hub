

## Correção: Excluir assistente_administrativo da lista de SDRs

### Problema
O filtro em `useSdrsFromSquad.ts` (linha 52) exclui apenas `admin`, `manager`, `coordenador` da lista de SDRs. Antony tem role `assistente_administrativo`, então não é filtrado.

### Solução
Adicionar `assistente_administrativo` à lista de roles excluídas no cross-check da linha 52.

### Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSdrsFromSquad.ts` | Linha 52: `.in('role', ['admin', 'manager', 'coordenador'])` → `.in('role', ['admin', 'manager', 'coordenador', 'assistente_administrativo'])` |

