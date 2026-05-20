# Plano: Smoke test end-to-end + proteção {{2}}

## Parte 1 — Proteção contra variáveis vazias (UI + edge)

**Objetivo:** garantir que nenhum envio (teste ou produção) chegue ao Twilio com variável obrigatória vazia, evitando texto quebrado tipo "Data e horário:" sem valor.

1. **TemplateTestSendDialog (frontend)**
   - Marcar todas as variáveis do template como obrigatórias no formulário.
   - Validação com zod: cada variável `min(1)` após `trim()`.
   - Botão "Enviar teste" desabilitado enquanto houver campo vazio; mensagens de erro inline por variável.

2. **automation-test-send (edge function)**
   - Remover o fallback atual `raw && raw.trim() ? raw : ' '`.
   - Validar entrada com zod: rejeitar com 400 se alguma variável declarada no template vier vazia/whitespace, retornando `{ error: { variable: 'campo X obrigatório' } }`.

3. **send-whatsapp-template (edge function de produção)**
   - Mesma validação server-side antes de montar `ContentVariables`.
   - Se vier vazio em produção (bug de upstream), logar em `automation_logs` com status `failed_validation` e não enviar, em vez de mascarar com espaço.

## Parte 2 — Smoke test end-to-end real (Caminho B)

**Sem mudanças de código** — apenas roteiro guiado executado por você no preview, com checagem de logs por mim.

### Pré-checks (eu executo)
- Confirmar fluxo `Confirmação R1 Incorporador` está `ativo` em `automation_flows`.
- Confirmar trigger configurado para stage `R1 Agendada` no PIPELINE INSIDE SALES (Incorporador).
- Confirmar template vinculado ao fluxo e variáveis mapeadas (nome, data_hora, especialista, link).

### Roteiro de execução (você executa)
1. Em `/crm` → PIPELINE INSIDE SALES → criar deal de teste com:
   - Nome: seu nome
   - Telefone: seu WhatsApp pessoal (E.164)
   - Produto: Incorporador
2. Mover para stage **"R1 Agendada"** com data/hora futura (>1h) e especialista atribuído.
3. Aguardar até 60s.

### Verificação (eu executo)
- Query em `automation_logs` filtrando pelo deal_id → status `sent`, sid Twilio presente.
- Query em `automation_flow_runs` → run finalizado sem erro.
- Você confirma recepção no WhatsApp com **todas** as variáveis preenchidas corretamente.

### Critério de sucesso
- Mensagem chega com nome real, data/hora real, especialista real, link real — nenhum placeholder.
- Logs registram `status=sent` e `twilio_sid`.
- Nenhum erro 21656 ou validation no edge log.

## Detalhes técnicos

- **Arquivos editados:**
  - `src/components/admin/automacoes/TemplateTestSendDialog.tsx` (validação zod + UI)
  - `supabase/functions/automation-test-send/index.ts` (remover fallback, adicionar validação)
  - `supabase/functions/send-whatsapp-template/index.ts` (validação server-side + log)
- **Sem migrations.** Sem mudanças em `automation_flows` ou template.
- **Limpeza pós-teste:** deletar deal de teste do pipeline e marcar logs como `test_run=true` se a coluna existir.

## Fora de escopo
- Cron de lembretes D-1/M-20 (você optou por end-to-end primeiro).
- Mudanças no template oficial (corpo da mensagem).
- Refactor maior do dispatcher de automações.
