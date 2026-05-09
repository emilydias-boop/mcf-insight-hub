## Diagnóstico

O template "Boa Vindas" (SID `HX1abf...c573`) está configurado assim:

- `variables = ['nome']` — só `nome` mapeado para `{{1}}`.
- `content` = `Olá {{nome}}, ...` (ok).
- `buttons_config[0]` = `{ type: 'url', url: 'https://wa.me/{{dono_link_wa}}' }`.

Três bugs somam:

### 1. URL do botão duplica o prefixo `wa.me`
O `automation-processor` já resolve `dono_link_wa` para `https://wa.me/55XXXXXXXXXXX`. Como o botão usa `https://wa.me/{{dono_link_wa}}`, o resultado renderizado é `https://wa.me/https://wa.me/55…` e o botão não abre.

### 2. `buildContentPayload` não converte placeholders dentro do `url` do botão
Em `supabase/functions/twilio-content-manage/index.ts` o loop `{{nome}} → {{1}}` só toca em `content`. O `b.url` é enviado cru ao Twilio, então `{{dono_link_wa}}` nunca é interpolado e o template é registrado com URL quebrada.

### 3. `twilio-whatsapp-send` envia `ContentVariables` em ordem fixa, ignorando `template.variables`
O processor manda sempre 9 chaves (`nome, email, telefone, sdr, dono_nome, dono_telefone, dono_link_wa, data, link`) e o `twilio-whatsapp-send` numera por ordem de inserção. O Twilio espera as posições na ordem do `template.variables`. Para "Boa Vindas" ainda funciona (só `{{1}}`), mas qualquer template com mais variáveis vai receber valores trocados.

## Nova variável: `dono_link_wa_agendar` (com mensagem pré-preenchida quando o dono é SDR)

Criar uma nova variável dedicada para o caso "quero agendar minha reunião":

- `dono_link_wa_agendar` resolve para:
  - Se o dono é **SDR**: `https://wa.me/55XXXXXXXXXXX?text=Ol%C3%A1%2C%20quero%20agendar%20minha%20reuni%C3%A3o`
  - Se o dono é **Closer** (R1/R2): `https://wa.me/55XXXXXXXXXXX?text=Ol%C3%A1%2C%20quero%20confirmar%20minha%20reuni%C3%A3o` (mensagem ajustada ao contexto do estágio)
  - Se não há telefone do dono → string vazia (e o item é pulado, igual ao comportamento atual de `dono_link_wa`).

A detecção do papel do dono usa o estágio do deal (mesma cascata do `resolve_deal_owner`):
- `R2 Agendada` / `Contrato Pago` → mensagem de confirmação para Closer R2.
- `R1 Agendada` / `R1 Realizada` / `No-Show` → mensagem para Closer R1.
- Demais (incluindo `Novo Lead`, `Em Contato`, `Qualificado`) → mensagem de agendamento para SDR.

A mensagem padrão por papel fica configurável em duas constantes no `automation-processor` (fácil de editar futuramente):
```
WA_DEFAULT_MSG_SDR = 'Olá, quero agendar minha reunião'
WA_DEFAULT_MSG_CLOSER = 'Olá, quero confirmar minha reunião'
```

A variável antiga `dono_link_wa` continua existindo (só o número, sem texto), para retrocompatibilidade com flows que já a usam.

## Plano de correção

### A. Corrigir o template "Boa Vindas"
Migration única atualizando o registro `cf53890c-...`:
- `buttons_config[0].url` → `https://wa.me/{{dono_link_wa_agendar}}` (sem prefixo `https://wa.me/`, já vem completo).
- `variables` → `['nome', 'dono_link_wa_agendar']`.
- Zerar `twilio_template_sid` e `approval_status='draft'` para forçar recriação + reaprovação.

### B. `twilio-content-manage`: substituir `{{var}}` → `{{N}}` também em `b.url`
Aplicar o mesmo loop de substituição que já roda em `content` ao campo `url` dos botões `type: 'url'`. Mantém o `sanitizeTitle` atual para `title`.

### C. `automation-processor`: nova variável e mapeamento posicional correto
- Calcular `donoRole` (sdr | closer_r1 | closer_r2) a partir do `_stage_name` retornado/inferido.
- Construir `donoLinkWaAgendar = donoTelefone ? https://wa.me/${donoTelefone}?text=${encodeURIComponent(msgPorPapel)} : ''`.
- Adicionar `dono_link_wa_agendar` ao map de variáveis (e ao regex que decide pular por falta de telefone).
- Antes de invocar `twilio-whatsapp-send`, montar `contentVariables` numerado **na ordem exata do `template.variables`** (`{ '1': vars[template.variables[0]], '2': ... }`) e mandar pronto.

### D. `twilio-whatsapp-send`: aceitar `contentVariables` já numerado
- Se `body.contentVariables` vier preenchido, usar diretamente como `ContentVariables`.
- Senão, manter o fallback atual (numeração por ordem de inserção) para não quebrar callers existentes.

### E. Reaprovação na Meta
Após (A) + (B), no painel `/admin/automacoes → Templates`:
1. "Criar no Twilio" no template "Boa Vindas" (gera novo `ContentSid`).
2. "Submeter para aprovação".
3. Aguardar aprovação (URL com placeholder geralmente passa rápido em Utility).

### F. Validação
- Disparar manualmente o flow do estágio "Novo Lead" para um deal cujo `original_sdr_email` tenha `employees.telefone` cadastrado.
- Conferir em `automation_logs.content_sent` que a URL final é tipo `https://wa.me/5511999999999?text=Ol%C3%A1%2C%20quero%20agendar%20minha%20reuni%C3%A3o`.
- Abrir no celular e validar que o WhatsApp abre a conversa com o SDR e a mensagem já preenchida.

## Arquivos impactados

- `supabase/migrations/<timestamp>_fix_boavindas_button_and_add_link_agendar.sql`
- `supabase/functions/twilio-content-manage/index.ts` (interpolação `{{var}}` em `b.url`)
- `supabase/functions/automation-processor/index.ts` (nova variável `dono_link_wa_agendar`, papel dinâmico, `contentVariables` posicional)
- `supabase/functions/twilio-whatsapp-send/index.ts` (aceitar `contentVariables` pronto)
