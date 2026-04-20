

## Corrigir erro "Failed to send a request to the Edge Function" no botão Testar

### Diagnóstico

As edge functions de webhook de saída (`outbound-webhook-test`, `outbound-webhook-dispatcher`, `outbound-webhook-cron` se existir) **não estão registradas em `supabase/config.toml`**. Isso faz o Supabase aplicar o comportamento padrão de exigir JWT válido, causando rejeição da request antes da execução — por isso não há logs da função (ela nunca rodou).

Confirmações:
- `grep "outbound-webhook" supabase/config.toml` retorna vazio
- `supabase--edge_function_logs outbound-webhook-test` retorna "No logs found"
- Erro no UI: `Failed to send a request to the Edge Function` (erro de rede/auth, não erro interno)
- Código da função está correto (CORS ok, lógica ok)

### Correção

Adicionar 3 entradas em `supabase/config.toml`:

```toml
[functions.outbound-webhook-test]
verify_jwt = false

[functions.outbound-webhook-dispatcher]
verify_jwt = false

[functions.outbound-webhook-cron]
verify_jwt = false
```

(A `outbound-webhook-cron` é incluída por precaução — se não existir como função separada será ignorada sem efeito; vou confirmar antes de aplicar e remover se desnecessária.)

### Validação

1. Após o deploy, voltar em `/admin/automacoes` → **Webhooks Saída**
2. Clicar em **Testar** no card "Vendas Reais — Debug webhook.site"
3. Resultado esperado:
   - Toast verde: `Teste enviado com sucesso (HTTP 200 em XXXms)`
   - Payload de exemplo aparece ao vivo na tela do webhook.site
   - Contador de "Sucessos" aumenta no card
4. Clicar em **Logs** → linha com `event: test.ping`, status 200, payload visível

### Escopo

- 1 alteração em `supabase/config.toml` (adicionar entradas)
- Zero alteração de código
- Zero alteração de schema/dados
- Zero impacto em outras funções

