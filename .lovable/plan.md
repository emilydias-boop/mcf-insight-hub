# Auditoria — WhatsApp no lançamento de venda do Consórcio

Levantamento somente leitura. Nada foi alterado, religado, publicado ou disparado.

---

## Resposta curta às três perguntas do dono

1. **Nunca existiu WhatsApp no lançamento de venda do Consórcio.** O que existe, ativo até hoje, é um **e-mail** de boas-vindas ao cliente ("Boas-vindas Carta Cadastrada"), disparado no cadastro da carta — 275 envios, o último em 14/09/2026. Não há registro de nenhum envio de WhatsApp por esse evento, nem migração que tenha desligado algo. Não foi decisão nem quebra: foi configurado como e-mail desde 22/07/2026.
2. **Sim, ele mesmo consegue mudar a mensagem**, em Administração → Automações → aba Fluxos (`/admin/automacoes`, só perfil admin). O canal do fluxo pode ser e-mail, WhatsApp ou os dois, sem depender de programação.
3. **O dado hoje está bom para disparar.** Nas vendas lançadas nos últimos 60 dias, nenhuma nasceu sem crédito. A tela "R$ 0" que ele mandou não corresponde a nenhuma venda lançada nesse período (detalhe abaixo).

---

## 1) A automação que existia

### Fluxo "Boas-vindas Carta Cadastrada" — ATIVO, canal e-mail
- **Onde vive:** registro na tabela `automation_flows` (id `920ec993…`), criado em 22/07/2026, última edição em 24/08/2026. `is_active = true`, `channel = 'email'`, evento `consorcio_carta_cadastrada`.
- **O que dispara:** `src/hooks/useConsorcioPendingRegistrations.ts:611-627` — ao criar o cadastro pendente da carta, chama a função `automation-event-dispatcher` com esse evento.
- **Para quem:** **cliente** (e-mail do cadastro), não grupo interno.
- **Texto atual:** "Olá, {{nome}}! É com grande satisfação que confirmamos oficialmente a aquisição da sua Carta de Consórcio… Antony será o responsável por cuidar da sua carta de ponta a ponta… WhatsApp +55 11 94028-4344 / antony.nicolas@minhacasafinanciada.com".
- **Histórico de envio:** 275 e-mails, de 14/07/2026 a 14/09/2026, todos `sent`. **Zero envios de WhatsApp** com esse evento.

### Fluxo "Boas-vindas R2 (Contrato Pago)" — ATIVO, canal WhatsApp (não é consórcio)
- Registro `a108e63e…`, evento `attendee_contract_paid`, template Meta aprovado `Boas-Vindas Agendamento de R2` (Twilio SID `HX1d8b01…`).
- Disparado pelo gatilho de banco `trg_notify_attendee_contract_paid` em `meeting_slot_attendees`, que **filtra BU = incorporador**. Consórcio nunca entra.
- Sem registros em `automation_logs` para esse fluxo — não há prova de envio por esse caminho.

### Webhook Make.com (`consorcio.carta.cadastrada`) — ATIVO, caixa-preta
- `src/lib/consorcioCartaWebhook.ts` → função `consorcio-carta-cadastrada-webhook`, que posta o payload da carta numa URL fixa do Make (`hook.us1.make.com/pk492b4dfi…`). Idempotente por `webhook_carta_cadastrada_enviado_em`.
- **Este é o único candidato plausível à "automação que existia e parou":** o cenário do Make está fora do sistema, e nada aqui prova se ele manda ou mandava WhatsApp. `NÃO DETERMINADO` — só o painel do Make responde. É o que falta olhar.

### Webhook de saída por gatilho de banco — ATIVO
- `trg_enqueue_outbound_consorcio_webhook` em `consortium_cards` enfileira `consorcio.venda.criada/atualizada/cancelada` em `outbound_webhook_queue`, despachado a cada minuto. Repasse HTTP genérico para URLs cadastradas — não envia WhatsApp por si.

### Foi desligada por decisão ou por quebra?
**Nem uma nem outra.** Não há migração que desative gatilho ou regra de WhatsApp de consórcio; os `DROP TRIGGER` encontrados são recriações idempotentes. Não há código comentado. Não existe nenhum ponto no código que envie WhatsApp no lançamento da venda.

---

## 2) Infraestrutura de WhatsApp viva hoje

- **Provedor único: Twilio** (API oficial WhatsApp). Não há Z-API, Evolution nem Meta Cloud direto.
- **Quem envia de fato:**
  - `twilio-whatsapp-send` — envio programático, usado pelas automações.
  - `twilio-wa-send` — atendimento 1:1 do inbox, com teto diário por usuário.
  - `send-boleto-whatsapp` — boleto avulso do consórcio (cobrança, não venda).
  - `wa-broadcast-dispatch` — disparo em massa, roda a cada minuto por agendamento.
- **Números remetentes** (`wa_senders`, 2 ativos): `+55 11 5192-0293` (MCF Capital Comercial, massa + 1:1) e `+55 11 5217-0395` (SDR IA).
- **`wa_broadcasts`:** motor de disparo em massa. 51 campanhas, 5.455 destinatários, última em 16/09/2026 — **em uso**. Escrito pelas telas de broadcast (`src/components/checkin/broadcast/*`, `BulkBroadcastDialog`). Sem nenhuma ligação com venda de consórcio.
- **`automation-event-dispatcher`:** recebe um evento, procura fluxos ativos em `automation_flows` com aquele `trigger_event`, monta nome/e-mail/telefone do cliente e envia — e-mail pela `brevo-send`, WhatsApp pela `twilio-whatsapp-send`. Idempotente por colunas de "enviado em". Hoje só entende dois eventos: `consorcio_carta_cadastrada` e `attendee_contract_paid`.
- **`automation_routing_rules`** (a tabela com coluna `bu`): **existe no banco e está VAZIA — zero regras.** Nenhuma função e nenhuma tela leem essa tabela. É estrutura abandonada; **não é** onde as automações vivem.
- **Tela para editar regras e textos: SIM.** `/admin/automacoes` (só admin) → aba **Fluxos** cria/edita o fluxo, escolhe o evento (`consorcio_carta_cadastrada` já está na lista), o canal (e-mail / WhatsApp / ambos), o assunto e o corpo com variáveis `{{nome}}`, `{{telefone}}`, `{{grupo}}`, `{{cota}}`. Aba **Templates** edita os templates Meta aprovados.
- **Destinatário:** sempre resolvido do dado (telefone do cadastro/contato). Não há número fixo em secret para automação, e não há cadastro de destinatário interno.
- **Grupo de WhatsApp: NÃO há suporte.** Todo o envio é para número individual via Twilio, que não envia para grupos. Um aviso "no grupo interno" exigiria caminho novo (provedor diferente) ou um número individual de destino.

---

## 3) O ponto de disparo — botão "Lançar Venda"

- **Componente:** `src/components/consorcio/ProposalModal.tsx` (aberto na aba do funil R1 do Consórcio).
- **Grava, em sequência:**
  1. `useEnviarProposta` (`src/hooks/useConsorcioPostMeeting.ts:709+`) → `consorcio_proposals` (crédito total = soma das cartas, prazo/produto da carta principal, origem do lead) + `consorcio_proposal_cartas` (uma linha por carta: crédito, prazo, produto, categoria, condição, objetivo, parcela 1ª–12ª, demais, `parcelas_mcf`).
  2. `useCreatePendingRegistration` → `consorcio_pending_registrations`, um por carta (só se o bloco cadastral opcional for preenchido).
- **Gatilhos de banco reagindo a proposta/carta:** apenas auditoria e consistência (`trg_audit_consorcio_proposals`, `tg_sync_proposal_cartas_agregado`, `tg_validate_proposal_carta`, `trg_consorcio_stage_cota`). **Nenhum** dispara mensagem.

### Os sete dados que o dono quer

| Dado | De onde sairia | Disponível no lançamento? |
|---|---|---|
| Nome do lead | `contactName` do modal (contato do CRM); se o bloco cadastral for preenchido, `nome_completo`/`razao_social` | **Sim** |
| Crédito total | `consorcio_proposals.valor_credito` = soma das cartas | **Sim** |
| Quantas cartas | `consorcio_proposals.qtd_cartas` / linhas em `consorcio_proposal_cartas` | **Sim** |
| Valor de cada carta | `consorcio_proposal_cartas.valor_credito` | **Sim** |
| Quantas parcelas a MCF paga | `consorcio_proposal_cartas.parcelas_mcf` (marcação do closer) | **Sim, quando marcado** — 25 de 117 cartas dos últimos 60 dias ficaram sem marcação |
| Nome do closer | `vendedor_name` (texto passado ao modal) + `created_by` (usuário logado) | **Sim**, com a ressalva de que é texto livre e não distingue papel |
| Nome do SDR | **Não é gravado neste fluxo.** Precisaria vir de fora: do agendador da R1 do negócio no CRM (mesma hierarquia usada nas métricas: quem agendou > dono do pipeline > dono do negócio) | **Não no instante do lançamento** — exige uma consulta extra ao negócio/reunião |

Sobre o SDR: sim, a origem correta no consórcio é o agendador da R1, e ela existe no banco — mas não está no que o "Lançar Venda" grava. É o único dos sete que exige um passo a mais.

---

## 4) O caso da venda incompleta — medição

Janela: 18/07/2026 a 17/09/2026, propostas não excluídas.

| Situação | Total | Sem crédito | % |
|---|---|---|---|
| Vendas lançadas (`aceita`) | 61 | **0** | **0%** |
| Propostas ainda pendentes | 14 | 13 | 93% |
| Recusadas | 4 | 0 | 0% |

Nas **117 cartas** dessas 61 vendas lançadas: **nenhuma sem crédito**, nenhuma sem prazo, **24 sem a parcela 1ª–12ª** (20,5%) e 25 sem a marcação de parcelas MCF.

E as 24 sem parcela estão todas no passado:

| Semana | Vendas | Cartas | Cartas sem parcela |
|---|---|---|---|
| 20/07 | 13 | 13 | 13 |
| 27/07 | 8 | 8 | 8 |
| 10/08 | 2 | 2 | 2 |
| 17/08 | 2 | 5 | 1 |
| 24/08 | 13 | 41 | 0 |
| 31/08 | 11 | 27 | 0 |
| 07/09 | 7 | 16 | 0 |
| 14/09 | 5 | 5 | 0 |

**Desde 24/08, 89 cartas seguidas com parcela preenchida.**

**Conclusão:** o risco de mandar "Crédito Total: R$ 0" no lançamento é **zero nos últimos 60 dias** de vendas lançadas. A mensagem pode disparar no lançamento sem esperar o cadastro completar. Vale apenas uma guarda simples: não disparar se o crédito total vier zerado.

**Sobre a tela "1 carta · R$ 0" que ele mandou:** `NÃO DETERMINADO`. Nenhuma venda lançada nos últimos 60 dias tem crédito zero, então aquilo não é uma venda gravada — é muito provavelmente o próprio modal ainda em preenchimento (rascunho antes de salvar) ou uma proposta em status `pendente`, que é onde os 13 sem crédito estão. Para fechar isso eu precisaria da data/nome do cliente da tela.

---

## O que falta olhar

- **Painel do Make.com** (cenário do webhook `consorcio.carta.cadastrada`): é o único lugar onde pode ter existido um WhatsApp que "parou". Fora do sistema — precisa do acesso do dono.
- **Data/cliente da tela do "R$ 0"** para identificar o registro exato.
- **Se o destino é grupo interno:** hoje não há como. Precisa decisão sobre número individual ou provedor novo.

---

## Decisões que preciso do dono antes de propor implementação

1. **Cliente ou time?** A automação de hoje fala com o cliente por e-mail. O pedido parece ser um aviso interno de venda. São coisas diferentes.
2. **Se for interno: grupo ou número?** Grupo não é possível com o que existe. Número individual é.
3. **Incluir o SDR?** Se sim, o lançamento precisa buscar o agendador da R1 — trabalho a mais, mas viável.
4. **Disparo no lançamento** (com guarda de crédito zero) **ou só quando o cadastro estiver completo?** A medição diz que o lançamento já é seguro.

Nada será alterado até essas respostas.
