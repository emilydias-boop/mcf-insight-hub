
## Objetivo
Eliminar o “trava” onde a Jessica entra e o app mostra o cargo como **Viewer** e bloqueia acesso (ex.: `/crm/agenda-r2`), e só volta ao normal após **refresh**. Isso é um sintoma clássico de **condição de corrida** no carregamento inicial das roles.

---

## Diagnóstico (com base no código atual)
Hoje o `AuthContext` faz **duas inicializações concorrentes**:

1) `supabase.auth.onAuthStateChange(...)`  
2) `supabase.auth.getSession().then(...)`

Ambos podem disparar `fetchUserRoles()` quase ao mesmo tempo.

Se uma dessas chamadas:
- falhar momentaneamente,
- retornar vazio por qualquer motivo transitório (latência, token ainda acoplando, etc.),
- ou simplesmente terminar por último,

ela pode **sobrescrever** o estado com `role = null` e `allRoles = []`.  
No UI, `AppSidebar.getRoleLabel(null)` cai no default e mostra **Viewer**.  
E guards (ex.: `R2AccessGuard`) podem negar acesso enquanto isso.

O refresh “resolve” porque muda a ordem/timing e a chamada “boa” vence.

---

## Solução (alto nível)
### A) Tornar a inicialização do Auth determinística (sem corrida)
- Remover a duplicidade: usar **apenas uma fonte** para sessão inicial.
- Preferência: usar somente o `onAuthStateChange` (evento `INITIAL_SESSION` já fornece a sessão inicial), e **eliminar** o `getSession()` separado — ou manter `getSession()` e ignorar `INITIAL_SESSION`. O importante é **não rodar os dois** fazendo fetch de roles.

### B) Proteger contra respostas “atrasadas” (stale) sobrescrevendo o estado
Mesmo com A, ainda é saudável ter proteção:
- Implementar um `requestId`/`version` incremental para o carregamento de roles.
- Antes de aplicar `setRole/setAllRoles`, checar se aquele requestId ainda é o “mais recente”.
Isso impede que uma resposta antiga sobrescreva a mais nova.

### C) Garantir que `loading` represente “sessão + roles prontas”
- Hoje dá para cair num estado “logado, mas sem roles confiáveis”.
- Ajustar `loading` para só virar `false` quando:
  - não existe usuário (deslogado), OU
  - existe usuário e as roles foram resolvidas (inclusive se não existir nenhuma role, definir explicitamente `primaryRole = 'viewer'` e `roles = ['viewer']`, se essa for a regra do produto).

### D) Evitar “flash” de Acesso Negado nos guards durante carregamento
- Atualizar `R2AccessGuard` para respeitar `loading` do `AuthContext`.
- Enquanto `AuthContext.loading === true`, retornar skeleton/spinner ou `null` (mantendo consistência com outras telas), evitando aparecer “Acesso Negado” temporariamente.

---

## Passo a passo de implementação (frontend)

### 1) Refatorar `src/contexts/AuthContext.tsx`
**Mudanças principais:**
- Remover a segunda inicialização (o bloco `supabase.auth.getSession().then(...)`) OU tornar o `onAuthStateChange` ignorar `INITIAL_SESSION` se `getSession` foi escolhido.
- Criar uma função única `handleSession(session)` responsável por:
  - setar `session` e `user`
  - validar bloqueio (profiles.access_status / blocked_until)
  - carregar roles (`fetchUserRoles`)
  - setar `role`, `allRoles`
  - setar `loading` corretamente

**Anti-race:**
- Introduzir um `let roleLoadVersion = 0` (ref via `useRef`)  
- A cada `handleSession` com usuário: `const myVersion = ++roleLoadVersion`
- Após `await fetchUserRoles(...)`, somente aplicar estado se `myVersion === roleLoadVersion`.

**Fallback de role (decisão de regra):**
- Se `user_roles` vier vazio e isso for esperado, padronizar como viewer:
  - `roles = ['viewer']`
  - `primaryRole = 'viewer'`

### 2) Ajustar `src/components/auth/R2AccessGuard.tsx`
- Já usa `useMyR2Closer`, mas precisa evitar negar acesso enquanto o auth está “instável”.
- Adicionar `const { loading } = useAuth()` e:
  - Se `loading === true`, retornar `null` ou um loader leve.
- Isso remove o “flash” de Acesso Negado quando a role ainda está sendo resolvida.

### 3) (Opcional, recomendado) Ajustar `src/components/layout/AppSidebar.tsx`
Problema atual: quando `role` é `null` ele mostra “Viewer”, o que confunde e expõe o bug visualmente.
- Exibir algo como “Carregando…” enquanto `AuthContext.loading` for true.
- Alternativamente, manter o Badge, mas com texto neutro (“Carregando”) em vez de “Viewer”, para evitar interpretação errada.

---

## Passo a passo de validação (checklist)
1) Logar como Jessica e navegar diretamente para `/crm/agenda-r2` (sem refresh):
   - não deve aparecer Viewer temporário
   - não deve aparecer “Acesso Negado”
   - deve carregar e permitir acesso assim que roles forem resolvidas
2) Repetir teste em:
   - aba anônima / janela privada
   - hard reload (Ctrl+F5)
   - navegação interna (indo de `/crm` para `/crm/agenda-r2`)
3) Confirmar que um usuário realmente “viewer-only” continua vendo Viewer corretamente.
4) Confirmar que o comportamento de bloqueio/desativado (profiles.access_status / blocked_until) permanece correto.

---

## Riscos e cuidados
- Ao mexer no `loading`, garantir que o app não “fique eternamente carregando” se houver erro de rede:
  - Em caso de erro no fetch de roles, fazer retry controlado ou cair para fallback “viewer” com toast de erro.
- Manter a lógica de multi-role (ROLE_PRIORITY) intacta.

---

## Entregáveis
- Refatoração do `AuthContext` para eliminar corrida e garantir consistência de roles.
- Pequeno ajuste no `R2AccessGuard` para aguardar auth/roles.
- (Opcional) Ajuste visual no `AppSidebar` para não exibir “Viewer” quando ainda está carregando.
