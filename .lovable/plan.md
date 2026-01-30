
Objetivo
- Eliminar o “Carregando…” infinito (tela do ProtectedRoute) e garantir que o app sempre:
  1) mostra o /auth quando não tem sessão
  2) entra no app quando tem sessão
  3) se o banco/roles/profiles estiver lento, não trava a UI (carrega em “modo degradado” e tenta completar depois)

O que vimos / hipótese mais provável
- A tela “Carregando…” que você printou é exatamente a UI do `ProtectedRoute`.
- O `ProtectedRoute` fica preso quando `useAuth().loading` nunca vira `false`.
- No `AuthContext`, hoje o `loading` só vira `false` depois de completar (ou falhar) chamadas ao banco:
  - `profiles` ( `.single()` ) + `user_roles`
- Se o Postgres/Supabase estiver intermitente ou lento (timeout/544, picos de carga, etc.), essas chamadas podem demorar muito (ou “pendurar” tempo suficiente para parecer travamento). Resultado: `loading` fica `true` e o app não sai do spinner.

Estratégia de correção (robusta)
1) Separar “carregamento de sessão” de “carregamento de perfil/roles”
- Hoje: `loading` = sessão + profile + roles (tudo junto) → trava UI quando profile/roles atrasam
- Proposto:
  - `authLoading` (rápido): só valida “tem sessão?” e atualiza `user/session`
  - `roleLoading` (lento): busca perfil/roles em background com timeout e retry
- O `ProtectedRoute` deve depender APENAS do `authLoading` (não do `roleLoading`).

2) Sempre encerrar o loading da rota em poucos segundos (timeout hard)
- Implementar um “watchdog” no `AuthProvider`:
  - Se após X segundos (ex.: 6–10s) a inicialização não terminou, forçar:
    - `authLoading = false`
    - se não houver user -> direcionar para `/auth`
    - se houver user -> liberar o app com role fallback e mostrar alerta “modo degradado”
- Isso impede que qualquer falha externa deixe o app preso para sempre.

3) Não bloquear onAuthStateChange com fetch pesado
- Manter o callback do `onAuthStateChange` “leve”:
  - Atualizar estado de sessão (`setSession`, `setUser`) e encerrar `authLoading`
  - Disparar `fetchUserRoles` e `fetchProfileAccessStatus` de forma assíncrona e cancelável (ou com timeout).
- Importante: isso segue a boa prática de evitar “deadlocks” por chamadas Supabase dentro do fluxo crítico de auth.

4) Timeouts reais nas queries “críticas”
- Envolver chamadas `profiles` e `user_roles` em `Promise.race([... , timeoutPromise])`
- Se estourar timeout:
  - aplicar fallback seguro (ex.: role = viewer)
  - registrar log (console.warn)
  - mostrar toast “Servidor lento — carregamos com acesso básico, tentando sincronizar…”
  - disparar retry com backoff (ex.: 3 tentativas: 2s, 5s, 10s)

5) Melhorar UX do “Carregando…”
- Em `ProtectedRoute`, trocar spinner “mudo” por:
  - Texto: “Carregando sua sessão…”
  - Após 8s: mostrar bloco com botões:
    - “Tentar novamente” (recarrega o app)
    - “Ir para login” (navigate /auth e opcionalmente limpar sessão local)
    - “Limpar sessão” (supabase.auth.signOut + limpar localStorage específico do supabase, com cuidado)
- Isso reduz suporte/manual quando algo externo falha.

6) Instrumentação mínima para diagnóstico (sem expor dados sensíveis)
- Adicionar logs controlados (somente console, sem tokens):
  - Tempo do `getSession`
  - Tempo da query `profiles`
  - Tempo da query `user_roles`
  - Se caiu em timeout e quantas tentativas
- (Opcional) Criar um “Health Badge” no canto (somente admin) indicando: Auth OK / Roles delayed / DB slow.

Arquivos envolvidos (mudanças previstas)
- `src/contexts/AuthContext.tsx`
  - Introduzir `authLoading` e `roleLoading` (ou manter `loading` como authLoading e adicionar `roleLoading`)
  - Refatorar `handleSession` para:
    - atualizar `user/session` e encerrar `authLoading` cedo
    - buscar profile/roles em background com timeout, retry e fallback
  - Implementar watchdog global de inicialização
- `src/components/auth/ProtectedRoute.tsx`
  - Usar `authLoading` (ou o `loading` re-semantizado para authLoading)
  - UX de timeout: botões de ação e mensagem clara
- (Opcional) `src/components/ErrorBoundary.tsx`
  - Manter, mas adicionar orientação quando o problema for “backend lento” (não exceção)
- (Opcional) `src/App.tsx`
  - Verificar se existe algum initializer que deveria depender de `user`/auth (ex.: PriceCacheInitializer), garantindo que ele não reintroduza travas.

Critérios de aceite (o que vamos validar)
1) Sem sessão:
- Abrir “/” deve ir para “/auth” rapidamente (sem spinner infinito).
2) Com sessão válida:
- Abrir “/” deve entrar no app em poucos segundos mesmo se roles/profiles estiverem lentos.
3) Banco instável:
- App não fica preso; entra em modo degradado, exibe aviso e tenta recuperar roles em background.
4) Regressão zero:
- Login/Logout continuam funcionando.
- Guardas de rota (RoleGuard/ResourceGuard) continuam funcionando quando roles carregarem; enquanto não carregarem, usar fallback conservador (viewer) sem travar.

Riscos e mitigação
- Risco: liberar app antes de carregar roles pode mostrar menu/rotas que depois devem ser bloqueadas.
  - Mitigação: enquanto `roleLoading=true`, tratar `role` como ‘viewer’ (conservador) e/ou esconder itens sensíveis até roles carregarem.
- Risco: loops de retry gerando carga.
  - Mitigação: backoff + limite de tentativas + cancelar se usuário deslogar/trocar sessão.

Sequência de implementação
1) Refatorar AuthContext: separar loading, aplicar timeouts e watchdog.
2) Ajustar ProtectedRoute para novo estado e UX de timeout.
3) Testes manuais:
   - Aba anônima (sem sessão)
   - Login normal
   - Recarregar F5 com sessão
   - Simular lentidão (reduzir rede no DevTools) e validar que não trava
4) (Opcional) adicionar pequena telemetria de tempo (somente console).

Observação importante
- Como você relatou que é “sempre” e “nos dois ambientes”, isso é forte indício de deadlock/espera indefinida no fluxo de auth (não somente “peso de dados”). A mudança acima é o padrão mais seguro para nunca mais travar no spinner, mesmo com o Supabase lento.

