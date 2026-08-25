# Assinatura do termo com código de uso único por e-mail — levantamento e desenho

Veredito curto: **é viável**. O canal de e-mail existe, está em uso todos os dias e o e-mail do cliente está preenchido em ~90% dos cadastros. Há dois pontos que exigem decisão sua e um risco concreto de vazamento do código em log que precisa ser fechado no desenho.

## A. O e-mail chega

**1. Existe envio hoje — de fato.** Duas rotas:
- `supabase/functions/brevo-send/index.ts` — Brevo (`BREVO_API_KEY`, linha 42), remetente `marketing@minhacasafinanciada.com` (linha 19). É a rota principal.
- `supabase/functions/send-document-email/index.ts` — Resend (`RESEND_API_KEY`, linha 69), remetente `notificacoes@mcfgestao.com.br`. Usada só para notificação de documentos de RH.

**2. Está em uso e funcionando, não parado.** `automation_logs` com `channel='email'`: **1.511 registros, todos com status `sent`**, o último em 2026-08-25 00:13 UTC. Nos últimos 30 dias: 1.463 envios, **1.443 para destinatários externos** (clientes) e 20 internos. Ou seja: enviar e-mail para o cliente já é rotina.
- Observação: `src/lib/consorcioBoasVindasEmail.ts` monta um e-mail de boas-vindas de Consórcio que **nenhum arquivo chama** — é código morto, não conte com ele.

**3. E-mail do cliente preenchido — números reais de `consorcio_pending_registrations`:**

| Recorte | Total | Com e-mail válido (`@`) | % |
|---|---|---|---|
| Todos os cadastros | 452 | 403 | **89,2%** |
| Criados nos últimos 60 dias | 312 | 283 | **90,7%** |
| Termos gerados (`consorcio_termos`) | 31 | 31 com `cliente_email` no snapshot | **100%** |

O percentual **não é baixo** — não derruba a solução. Mas 1 em cada 10 cadastros não tem e-mail, então o desenho precisa de um caminho para esse caso (ver item 11).

**4. Destinatário do código.** O snapshot já guarda `cliente_email`: **31 de 31 termos têm a chave preenchida com `@`**. Conferi contra `profiles`: **zero** snapshots com e-mail de gente da casa. O snapshot é gravado em `useCreateTermo` (`src/hooks/useConsorcioTermos.ts:194`) a partir dos dados do cadastro do cliente, não do closer. Ainda assim o desenho deve **bloquear no servidor** e-mail que exista em `profiles`/`employees` — hoje isso é verdade por sorte, não por regra.

## B. Como o link chega hoje

**5. Link copiado à mão e mandado por fora (WhatsApp).** `GerarTermoModal.tsx:117` e `TermoPanelDialog.tsx:43` fazem `navigator.clipboard.writeText(termoPublicUrl(token))`; o campo aparece só-leitura ao lado de um botão "Copiar". **Não existe nenhum envio automático do termo por e-mail.** Consequência prática: o código por e-mail **muda o processo do time** — o closer continua mandando o link por WhatsApp, mas o cliente passa a depender de um e-mail que hoje ninguém envia nem confere. Isso é o principal custo operacional da mudança, não o técnico.

## C. Onde encaixar

**6. Fluxo atual de `supabase/functions/termo-assinatura/index.ts`** (roda com `service_role`, ignora RLS):
- `GET ?token=` → busca por `access_token`; expira se `pendente` e vencido; na primeira abertura grava `visualizado_em`/`visualizado_ip` (linhas 111-120); devolve `publicPayload` (conteúdo, nome/documento mascarados, certificado se assinado).
- `POST {token, nome, cpf}` → recusa `comprovante_cadastro`, `assinado`, `cancelado`, expirado; compara CPF só-dígitos e nome normalizado contra `dados_snapshot`; grava `status='assinado'`, `assinado_em`, `assinante_nome/cpf/ip/user_agent` com `UPDATE ... eq('status','pendente')` (idempotente).

Encaixe do código, sem tocar no que já funciona:
- Duas ações novas no POST (`action: 'request_code'` e `action: 'sign'`), mantendo o corpo atual como caminho legado durante a virada.
- `already_signed`, `cancelled`, `expired`, `not_signable` continuam iguais e vêm **antes** de qualquer lógica de código. Termo já assinado não muda em nada.

**7. Onde fica o código.** Tabela nova `consorcio_termo_codigos`:
- `termo_id`, `codigo_hash` (SHA-256 de código + salt de servidor — nunca texto puro), `email_destino`, `expires_at` (10 min), `tentativas` (int), `consumido_em`, `criado_em`, `criado_ip`.
- Verificação = hash do que o cliente digitou comparado ao hash guardado. Defendo hash em vez de texto puro porque a tabela é lida por `service_role` e qualquer consulta de suporte veria o valor; com hash, nem o banco sabe o código.
- 6 dígitos numéricos, expiração de 10 minutos, máximo 5 tentativas, pedido novo invalida o anterior.

**8. O código não pode ser visível para ninguém da casa.** Regras do desenho:
- Sem policy de `SELECT` para nenhum papel — apenas a edge function com `service_role`. O código em claro existe só na memória da função e no corpo do e-mail.
- **Risco real hoje:** `brevo-send` grava o HTML inteiro do e-mail em `automation_logs.content_sent` (linhas 63-76) e `automation_logs` é legível no CRM. Se o e-mail do código passar por `brevo-send` como está, **o código fica visível para gente da casa** e a trava perde valor. Solução: chamar a API do Brevo **direto de dentro de `termo-assinatura`**, sem passar por `brevo-send` e sem gravar `content_sent`; registrar apenas "código enviado para e‑mail mascarado, às HH:MM".
- Nenhum `console.log` com o código (a função hoje só loga erro, linha 196 — manter assim).
- A resposta da API devolve só o e-mail mascarado, nunca o código.

## D. Registro de contexto

**9. O que já se enxerga sem esforço:** IP (`x-forwarded-for`, linha 168) e user agent (linha 180) — ambos já gravados hoje. Horário é `now()` no servidor, autoritativo. **Localização exige permissão do navegador** (`navigator.geolocation`) e, quando o cliente **nega**, não vem nada: a assinatura precisa concluir normalmente e o registro fica com localização nula. Localização é opcional por natureza; nunca condição para assinar. Como complemento sem permissão, dá para guardar o fuso horário do navegador e uma geolocalização aproximada por IP (país/cidade), rotulada como *aproximada*.

**10. Onde gravar o contexto.** Tabela nova `consorcio_termo_assinatura_contexto`, com a mesma disciplina da trilha de fora do funil: **INSERT apenas pela função; nenhum UPDATE, nenhum DELETE para ninguém**. Campos: `termo_id`, `evento` (`codigo_solicitado` | `codigo_recusado` | `assinado`), `ocorrido_em`, `ip`, `user_agent`, `plataforma`, `timezone`, `geo_lat`/`geo_lng`/`geo_precisao` (nulos permitidos), `geo_origem` (`navegador` | `ip` | `ausente`). Leitura: `admin`, `manager`, `coordenador` e `cobranca_consorcio` — os mesmos que já veem dados do cliente.

## E. Riscos e custo

**11. O que quebra.** Existem **5 termos `pendente`** agora (2 deles de teste com validade até 2028). Se a exigência entrar ligada para todos, um pendente cujo cadastro esteja sem e-mail **fica travado**. Virada proposta: exigência só para termos **gerados depois** da mudança (coluna `exige_codigo` no termo, default `true` para novos, `false` nos 5 atuais), e o botão de gerar termo passa a **exigir e-mail do cliente** no cadastro. Assim ninguém fica no meio do caminho e os ~10% sem e-mail são resolvidos no momento da geração, não na hora da assinatura.

**12. Rate limit e abuso.** Pedido de código: no máximo 1 por minuto e 5 por dia por termo, contados na própria tabela de códigos (o token do termo é o escopo — não é endpoint aberto para qualquer e-mail, o destinatário vem do snapshot, o cliente não escolhe). Força bruta: 6 dígitos + 5 tentativas + 10 minutos + invalidação ao errar o limite dá probabilidade desprezível; após o limite, só um novo pedido resolve, e o pedido tem seu próprio teto.

**13. Opinião honesta.** Viável, e **mais viável que a foto do documento** neste sistema. Razões: o canal de e-mail já roda 1.400+ envios externos por mês e não precisa de infraestrutura nova; o e-mail do cliente já está em 90% dos cadastros e em 100% dos termos gerados; a foto do documento exigiria storage novo, política de retenção de dado sensível, e alguém da casa conferindo a foto — o que reintroduz exatamente o problema que a trava quer resolver (gente da casa no meio da assinatura). Não recomendo voltar ao dono. Os dois obstáculos reais são operacionais, não técnicos: (a) o time hoje entrega o link por WhatsApp e vai precisar orientar o cliente a buscar o e-mail; (b) o log do `brevo-send` vazaria o código se o envio não for isolado — está tratado no item 8.

## Se você aprovar, a implementação seria

1. Migração: `consorcio_termo_codigos`, `consorcio_termo_assinatura_contexto` (insert-only), `consorcio_termos.exige_codigo`, grants e policies.
2. `termo-assinatura`: ações `request_code` e `sign`, envio direto ao Brevo sem log de conteúdo, rate limit, gravação de contexto.
3. Página pública do termo: passo do código, campo de 6 dígitos, "reenviar" com contador, pedido opcional de localização com fallback silencioso.
4. Geração do termo: exigir e-mail do cliente; mostrar o e-mail mascarado que receberá o código.
