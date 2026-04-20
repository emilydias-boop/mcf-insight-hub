

## Forçar redeploy da `outbound-webhook-test` e diagnosticar

### Diagnóstico atual

- `supabase/config.toml` já tem `verify_jwt = false` para `outbound-webhook-test` ✅
- Curl direto da função pelo backend retorna `404 "config not found"` (= função executa, JWT desativado funciona) ✅
- **Mas `supabase--edge_function_logs outbound-webhook-test` retorna "No logs found"** — significa que a função existe deployada mas o tráfego do navegador não chega até ela
- Frontend mostra "Failed to send a request to the Edge Function" — erro do `supabase.functions.invoke()` no client

### Hipóteses prováveis

1. **Deploy da função não absorveu a mudança do config.toml** — alteração de `verify_jwt` exige redeploy explícito da função
2. **Lockfile/esm.sh drift** — a função importa `https://esm.sh/@supabase/supabase-js@2.45.0`; se o boot falhar, o gateway responde com erro de rede para o client (sem gerar logs da função)
3. **Cache do navegador do usuário** — possível mas menos provável

### Ações (em ordem)

1. **Forçar redeploy** das 2 funções: `outbound-webhook-test` e `outbound-webhook-dispatcher`
   - Usar `supabase--deploy_edge_functions(["outbound-webhook-test", "outbound-webhook-dispatcher"])`
2. **Trocar import do esm.sh para npm:** na `outbound-webhook-test/index.ts` (mais estável em edge-runtime, recomendado pelos docs Lovable):
   - De: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";`
   - Para: `import { createClient } from "npm:@supabase/supabase-js@2.45.0";`
   - Aplicar a mesma troca em `outbound-webhook-dispatcher/index.ts` para consistência
3. **Redeployar novamente** após a mudança
4. **Validar** chamando a função diretamente via `supabase--curl_edge_functions` com o `config_id` real do webhook `Vendas Reais — Debug webhook.site` — confirmar HTTP 200 + logs aparecendo
5. **Pedir ao usuário** para fazer hard-refresh (Ctrl+Shift+R) na aba `/admin/automacoes` e clicar **Testar**

### Resultado esperado

- Após redeploy: `supabase--edge_function_logs outbound-webhook-test` passa a mostrar logs
- Botão **Testar** retorna toast verde com `HTTP 200 em XXXms`
- Payload de exemplo aparece ao vivo no webhook.site
- Linha em **Logs** com `event: test.ping`, status 200

### Escopo

- 2 arquivos alterados: `supabase/functions/outbound-webhook-test/index.ts` e `supabase/functions/outbound-webhook-dispatcher/index.ts` (1 linha de import cada)
- 2 deploys de edge function
- Zero alteração de schema/dados
- Zero alteração de UI/frontend

