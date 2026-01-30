
Objetivo
- Resolver o erro “Servidor não respondeu / Failed to fetch” no login, que hoje está acontecendo porque o browser não consegue completar as requisições para `https://rehcfgqvigfcekiipqkc.supabase.co/auth/v1/token`.
- Diferenciar claramente “instabilidade do Supabase” vs “bloqueio de CORS/origin” vs “configuração incorreta do client”.
- Aplicar uma solução alinhada ao que o próprio status do Supabase sugere (“reconectar”), mas no contexto web isso significa: limpar sessão local + revalidar conexão + corrigir CORS/origins no projeto.

O que os logs mostram (diagnóstico)
- Console: `TypeError: Failed to fetch` dentro do fluxo do Supabase Auth (`_refreshAccessToken` e `signInWithPassword`).
- Network: as chamadas `POST /auth/v1/token?grant_type=password` e `POST /auth/v1/token?grant_type=refresh_token` falham com `Failed to fetch` (não chega a ser um 401/403/500 visível).
- Isso é típico de:
  1) Problema de rede/DNS/TLS momentâneo, ou
  2) Bloqueio por CORS/preflight, ou
  3) Bloqueio/interferência de extensão (adblock/privacy), ou
  4) Configuração inconsistente/instável de URL/keys (especialmente quando dependemos de env vars e o build muda entre preview/published).

Importante: “reconectar” no status do Supabase normalmente se refere a conexões de banco/infra. No browser, a única “conexão” persistente é a sessão no storage + chamadas HTTP. Então, o caminho real é: (a) corrigir CORS/origins + (b) resetar sessão local + (c) validar conectividade.

Plano de ação (implementação)
A) Confirmar/ajustar configurações no Supabase Dashboard (sem mexer no código ainda)
1) Auth > URL Configuration
   - Site URL: configurar para a URL publicada (produção): `https://mcf-insight-hub.lovable.app`
   - Redirect URLs (adicionar também):
     - `https://id-preview--34c6432e-9b01-4946-b0e7-fde5393c994f.lovable.app/*`
     - `https://mcf-insight-hub.lovable.app/*`
   - Observação: isso é obrigatório para fluxos de email (signup/reset), mas também ajuda a eliminar configurações inconsistentes de ambiente.
2) API Settings > CORS Allowed Origins (se disponível no seu painel)
   - Adicionar explicitamente:
     - `https://id-preview--34c6432e-9b01-4946-b0e7-fde5393c994f.lovable.app`
     - `https://mcf-insight-hub.lovable.app`
   - Se houver também um domínio “lovableproject.com” (a versão antiga/iframe), adicionar:
     - `https://*.lovableproject.com` (se o painel aceitar wildcard) ou os domínios exatos que você usa.
3) Re-testar login depois de salvar essas configurações.

B) Corrigir a forma como o client Supabase é configurado no front (reduzir chance de “URL/key indefinido/errado”)
Contexto: hoje `src/integrations/supabase/client.ts` usa `import.meta.env.VITE_*`. Em projetos Lovable, isso pode variar entre preview/published e causar comportamento inconsistente. Além disso, a própria guideline do projeto diz para não depender de `VITE_*` no código.
Mudança planejada:
1) Substituir `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` por constantes hardcoded do projeto (ref e anon key já conhecidos).
2) Adicionar um guard simples: se URL/key estiver ausente por qualquer motivo, lançar erro claro e mostrar UI amigável (ao invés de “Failed to fetch”).

C) Implementar um “reconnect” real no app (botão de ação que faz o que o usuário espera)
1) Criar um helper único `resetSupabaseSession()` que:
   - `await supabase.auth.signOut()` (ignorar “session missing”)
   - limpar `localStorage` das chaves `sb-*` e itens contendo `supabase`
   - (opcional) limpar `indexedDB` do supabase (se existir no browser; pode ser necessário em alguns cenários)
2) Expor isso na UI:
   - Em `/auth`, adicionar um botão “Reconectar com Supabase” (texto claro: “Limpa sessão e tenta de novo”).
   - Manter também no `ProtectedRoute` (já existe “Limpar sessão e reiniciar” — vamos reaproveitar a mesma função para consistência).

D) Adicionar Diagnóstico/Health Check no /auth (para não ficar no escuro com “Failed to fetch”)
Objetivo: quando “Failed to fetch” acontecer, mostrar ao usuário uma mensagem com instruções concretas (CORS/origin) e um “Teste de Conexão”.
1) Criar um `SupabaseConnectivityCheck` simples:
   - Tentar um `fetch` direto (sem supabase-js) para um endpoint que responda rápido e que ajude a diagnosticar CORS:
     - Ex.: `GET https://rehcfgqvigfcekiipqkc.supabase.co/auth/v1/health` (se existir) ou um `GET` simples em `/rest/v1/` com headers mínimos.
   - Capturar:
     - Se falha como “Failed to fetch” => provável CORS/rede
     - Se retorna status 401/404 => rede ok, endpoint/headers a ajustar
2) Mostrar no UI:
   - “Status: Conectividade OK / Bloqueado por CORS / Servidor instável”
   - Um link direto para as telas do Supabase que o usuário precisa ajustar (Auth URL config + API CORS).

E) Melhorar o tratamento de erro do login para refletir o diagnóstico real
Hoje, quando `withTimeout` retorna `null`, mostramos “Servidor não respondeu”.
Mudanças planejadas:
1) Se o erro for `TypeError: Failed to fetch`:
   - Mostrar texto: “Não foi possível conectar ao Supabase (bloqueio de rede ou CORS).”
   - Mostrar ações: “Reconectar (limpar sessão)”, “Abrir configurações de CORS no Supabase”, “Tentar novamente”
2) Se o erro for timeout (15s):
   - Mensagem: “Supabase demorou para responder (instabilidade). Tente novamente em alguns minutos.”
3) Logar no console (sem dados sensíveis):
   - origin atual (`window.location.origin`)
   - supabase URL
   - timestamp
   - tipo do erro (fetch/cors/timeout)

Arquivos que serão alterados
- `src/integrations/supabase/client.ts`
  - Parar de usar `import.meta.env.VITE_*`
  - Hardcode do `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`
  - Guard/erro amigável se algo estiver inválido
- `src/pages/Auth.tsx`
  - Adicionar seção “Conectividade” (health check + botão “Reconectar”)
  - Melhorar mensagens de erro para CORS/rede vs timeout
- `src/components/auth/ProtectedRoute.tsx`
  - Reaproveitar `resetSupabaseSession()` do contexto/helper (evitar duplicação)
- (Opcional) `src/contexts/AuthContext.tsx`
  - Centralizar `resetSupabaseSession()`
  - Ajustar mensagens para “Failed to fetch” serem específicas de conectividade/CORS
  - Evitar que o refresh automático fique spammando erro no console quando não há conectividade (ex.: backoff simples)

Critérios de aceite (validação)
1) Em preview e em produção:
   - Login deixa de mostrar “Servidor não respondeu” quando o problema real for CORS: passa a mostrar mensagem específica e ações de correção.
2) Após ajustar CORS/origins no Supabase:
   - `signInWithPassword` completa (sucesso ou erro de credenciais), sem `Failed to fetch`.
3) Botão “Reconectar com Supabase”:
   - Limpa sessão e permite tentar login novamente sem precisar abrir DevTools/limpar manualmente.
4) Observabilidade:
   - Console logs mostram qual é o erro (fetch vs timeout) e tempo gasto, sem expor tokens.

Riscos e notas
- Se houver um incidente real no Supabase (status page) no momento do teste, o app ainda pode falhar; mas o UX ficará claro e com ações úteis.
- Se a falha for causada por firewall/ISP/antivírus local, a correção de CORS não resolve; o health check ajudará a identificar.
