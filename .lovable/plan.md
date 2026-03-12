

## Diagnóstico: Pipeline solo ainda não configurável

Verifiquei o código, o banco de dados e as policies RLS. Tudo parece correto:
- O grupo `a6f3cbfc-...` (Perpétuo - X1) existe no banco
- Tem 11 origins filhas (incluindo PIPELINE INSIDE SALES)
- RLS permite SELECT para todos os autenticados
- O `Negocios.tsx` passa `buAllowedGroups[0]` como `targetId`

O screenshot mostra "Configurar:" sem nome e "Nenhuma origin encontrada" -- o que indica que tanto `targetData` quanto `groupOrigins` retornam vazios/null, mesmo com dados corretos no banco.

**Causa provável**: O modal pode estar sendo montado antes do `targetId` estar estável, ou o react-query está cacheando um resultado vazio de uma execução anterior (quando o `targetId` era diferente). Também há um bug na dependency array do `resolvedOriginId` (usa `selectedOriginId` em vez de `effectiveSelectedOriginId`).

### Correções

**Arquivo: `src/components/crm/PipelineConfigModal.tsx`**

1. **Adicionar console.log temporário** para debugar o `targetId` e `groupOrigins` recebidos (remover depois)
2. **Corrigir dependency array** do `resolvedOriginId`: trocar `selectedOriginId` por `effectiveSelectedOriginId`
3. **Resetar estado interno quando modal abre com novo targetId**: Garantir que `selectedOriginId` é resetado ao trocar de `targetId` (useEffect)
4. **Adicionar `refetchOnMount: true`** nas queries de `targetData` e `groupOrigins` para evitar cache stale
5. **Fallback visual melhorado**: Se `targetData` for null após loading, mostrar mensagem de erro com o `targetId` para debugging

**Arquivo: `src/pages/crm/Negocios.tsx`**

6. **Adicionar console.log** no render do PipelineConfigModal para confirmar qual `targetId` está sendo passado
7. **Guard extra**: Garantir que `buAllowedGroups[0]` é uma string válida (não undefined) antes de renderizar o modal

