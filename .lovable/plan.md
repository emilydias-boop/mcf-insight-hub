

## Corrigir Jean Carlos aparecendo como SDR no Consórcio

### Causa raiz

Jean Carlos tem `role = 'closer'` na tabela `user_roles`, mas o hook `useSdrsFromSquad` só exclui roles `admin`, `manager`, `coordenador` e `assistente_administrativo`. O role `closer` não está na lista de exclusão, então ele passa no filtro e aparece como SDR disponível para distribuição.

### Solução (duas ações)

#### 1. Desativar Jean na tabela `sdr` (dados)
UPDATE na tabela `sdr` para marcar `active = false` no registro do Jean Carlos (`id = f574bca6-7669-4a91-bea3-ff46bac848ed`).

#### 2. Adicionar `closer` à lista de exclusão no código
**Arquivo:** `src/hooks/useSdrsFromSquad.ts`

Adicionar `'closer'` e `'closer_sombra'` ao filtro `.in('role', [...])` na linha 52:

```typescript
// Antes:
.in('role', ['admin', 'manager', 'coordenador', 'assistente_administrativo']);

// Depois:
.in('role', ['admin', 'manager', 'coordenador', 'assistente_administrativo', 'closer', 'closer_sombra']);
```

### Resultado
- Jean Carlos deixa de aparecer imediatamente (registro desativado)
- Qualquer futuro closer que tenha registro legado na tabela `sdr` também será excluído automaticamente pelo filtro de roles
- Nenhum SDR legítimo é afetado

### Arquivos alterados
1. `src/hooks/useSdrsFromSquad.ts` — adicionar `closer`/`closer_sombra` à exclusão
2. Tabela `sdr` — UPDATE `active = false` para Jean Carlos

