## O que os dados mostram

- No código existe **um único** ponto de envio para `hook.us1.make.com/pk492b4dfi83s1u4k566i98mg34k8xto`: a edge function `consorcio-carta-cadastrada-webhook`. Não há trigger, cron, pg_net nem `outbound_webhook_configs` apontando para essa URL (verificado no banco).
- A execução vazia que você citou (30/07 18:39:17) casa com o cadastro **MILTON BRUNO DE SOUZA CRISTIANO** (`dde0e5a4…`), marcado como enviado às 18:39:36. Esse registro tem titular, e-mail, telefone e crédito de R$ 1.000.000 preenchidos — ou seja, o app tinha dados para enviar, e mesmo assim o Make registrou o body vazio.
- Conclusão provável (ainda **não confirmada**): o body sai preenchido do app, mas o Make não o interpreta — cenário típico quando a *data structure* do webhook foi determinada a partir de uma requisição antiga/vazia, ou quando o Make ignora JSON aninhado que não bate com a estrutura salva. Confirmar isso é o primeiro passo do plano, não uma premissa.

## Passo 1 — Provar de que lado está o vazio

Instrumentar a edge function para registrar exatamente o que sai e o que o Make responde:
- log do `JSON.stringify(payload).length` e do payload completo antes do `fetch`;
- log do status HTTP e do corpo de resposta do Make;
- persistir esse envio em `bu_webhook_logs` (tabela já existente) com payload e resposta, para auditoria posterior sem depender da janela curta de logs.

Depois, disparar um "Reenviar webhook" em um cadastro conhecido e comparar: se o log mostra payload completo e o Make continua exibindo vazio, o problema é 100% da configuração do cenário no Make.

## Passo 2 — Tornar o payload à prova de Make

Independente do resultado, ajustar o envio para o formato que o Make aceita com mais segurança:
- manter o JSON atual, mas **adicionar uma versão achatada** (chaves de primeiro nível: `nome_completo`, `email`, `telefone`, `cpf`, `valor_credito`, `grupo`, `cota`, `produto`, `prazo_meses`, `vendedor`, `origem_lead`, `card_id`, `registration_id`), já que webhooks do Make mapeiam campos de topo com muito mais facilidade que objetos aninhados;
- garantir `Content-Type: application/json` e nenhum campo `undefined` no corpo;
- em caso de resposta não-2xx ou corpo de resposta inesperado do Make, **não** marcar `webhook_carta_cadastrada_enviado_em`, para permitir reenvio.

## Passo 3 — Ação do seu lado no Make (necessária)

Se o Passo 1 confirmar que o payload sai completo:
1. Abrir o módulo Webhook no cenário do Make → **Redetermine data structure**;
2. Reenviar uma carta pelo botão "Reenviar webhook" no painel Concluídas – Operacional enquanto o Make estiver aguardando;
3. Salvar a nova estrutura e remapear os campos nos módulos seguintes.

Sem isso, mesmo com o payload correto o cenário continuará exibindo execuções em branco.

## Detalhes técnicos

- Arquivo a alterar: `supabase/functions/consorcio-carta-cadastrada-webhook/index.ts` (logging + payload achatado + não marcar flag em falha).
- Arquivo a alterar: `src/lib/consorcioCartaWebhook.ts` (só gravar a flag quando a função retornar `success: true` com status 2xx do Make).
- Nenhuma mudança de schema; gravação de auditoria reaproveita `bu_webhook_logs`.
