# Voltar etapa no funil Consórcio — mapa das 6 etapas e desenho do "voltar"

Rodada de desenho. Nada de código. Abaixo, para cada etapa: o que avança, os efeitos colaterais
completos, o que já existe para voltar, e o que um "voltar" teria que desfazer — e o que não pode.

## Etapa 1 — Reuniões Agendadas → Etapa 2 (Realizadas)

- **Avança:** desfecho da reunião pelo closer. `R1FunnelTab.tsx` chama o update de status do
  attendee (`meeting_slot_attendees.status` → `realizada` / `no_show`).
- **Efeitos colaterais:** sync do estágio do deal em `crm_deals` (`syncDealStageFromAgenda`,
  com anti-regressão por `stage_order`); métricas de SDR/closer (agendadas, realizadas, no-show)
  e o funil por canal leem esse status; no-show com evidência entra nas travas de no-show.
  Sem webhook externo, sem financeiro.
- **Voltar hoje:** **já existe** — botão `Voltar p/ Agendada` (`R1FunnelTab.tsx:397`), aplica
  `status = 'scheduled'`.
- **Um "voltar" teria que desfazer:** só o status do attendee e o estágio do deal. Nada saiu do
  sistema. **Nada é irreversível aqui.**

## Etapa 2 — Reuniões Realizadas → Etapa 3 (Termos de Adesão Pendentes)

- **Avança:** "Lançar Venda" → `useEnviarProposta` (`useConsorcioPostMeeting.ts:708`).
- **Efeitos colaterais:** `INSERT` em `consorcio_proposals`; `INSERT` de 1..N linhas em
  `consorcio_proposal_cartas` (trigger `trg_sync_proposal_cartas_agregado` recalcula o total
  agregado da venda; `trg_validate_proposal_carta` valida); `crm_deals.stage_id` vai para
  *Proposta Enviada* (só VdA); auditoria em `trg_audit_consorcio_proposals`. Realizado/meta de
  Consórcio passa a contar essa venda. Sem webhook externo, sem cobrança.
- **Voltar hoje:** `useExcluirProposta` (registro em `consorcio_proposals_deleted_log`, remove
  documentos do Storage e apaga cadastros vinculados) e `useMarcarSemSucesso` (proposta
  `recusada` + deal para *Sem Sucesso*). Não existe "voltar para Realizada" preservando a venda.
- **Voltar teria que desfazer:** status da proposta, agregado das cartas e o estágio do deal.
  **Irreversível:** nada, exceto o que já foi apagado pelo caminho de exclusão atual (documento
  removido do Storage não volta).

## Etapa 3 — Termos Pendentes → Etapa 4 (Cotas a Fazer)

- **Avança:** aceite da proposta no `AcceptProposalModal` → `useCreatePendingRegistration`
  (`useConsorcioPendingRegistrations.ts:~500`).
- **Efeitos colaterais (lista completa):**
  1. `INSERT` em `consorcio_pending_registrations` (`status = 'aguardando_abertura'`, `aceite_date`);
  2. `consorcio_proposals` → `status = 'aceita'` + `aceite_at` / `aceite_by` / `aceite_date`;
  3. `consorcio_proposal_cartas.pending_registration_id` (vínculo 1:1 carta↔cadastro);
  4. upload dos documentos no bucket `consorcio-documents` + linhas em `consortium_documents`;
  5. **automações**: `functions.invoke('automation-event-dispatcher')` com evento
     `consorcio_carta_cadastrada` → e-mail/WhatsApp ao cliente;
  6. **webhook externo Make** `consorcio-carta-cadastrada-webhook` (idempotente via
     `webhook_carta_cadastrada_enviado_em`);
  7. triggers de auditoria e de vendedor default no cadastro pendente
     (`trg_pending_reg_default_vendedor`, `trg_audit_*`).
  Ainda **sem** `consortium_cards`, logo sem parcela, sem comissão, sem cobrança.
- **Voltar hoje:** `useDeletePendingRegistration` — **apaga** o cadastro pendente, apaga arquivos
  do Storage e devolve a proposta para `pendente` limpando `aceite_at/by/date`. É exclusão real.
  Existe também `useDeclinePendingRegistration` (carta declinada, abate da meta) com
  `useUndeclinePendingRegistration`.
- **Voltar teria que desfazer:** status/aceite da proposta, `status` do cadastro, vínculo da carta.
  **Não pode desfazer:** e-mail/WhatsApp já disparado e evento já entregue ao Make. O `voltar` deve
  **preservar** `webhook_carta_cadastrada_enviado_em` para não reenviar quando a venda avançar de novo.

## Etapa 4 — Cotas a Fazer → Etapa 5 (Cotas Cadastradas)

- **Trava de entrada na 4:** só entra com Termo de Adesão **assinado** (`consorcio_termos`,
  `cadastroLiberado` em `src/lib/consorcioLiberacaoCadastro.ts`).
- **Avança:** `OpenCotaModal` → criação da cota (`useConsorcioPendingRegistrations.ts:~1100`).
- **Efeitos colaterais (lista completa):**
  1. `INSERT` em `consortium_cards` (`tipo_registro = 'reserva'` ou `'contratacao'`);
  2. **trigger `trg_enqueue_outbound_consorcio_webhook`** → evento `consorcio.venda.criada`
     enfileirado em `outbound_webhook_queue` (**este é o que chega ao Dash**);
  3. trigger `tg_log_card_activity` → histórico da cota;
  4. `INSERT` em `consortium_pj_partners` quando PJ;
  5. **cronograma de parcelas** em `consortium_installments` (quando há `dia_vencimento`);
     reserva nasce `previsto`, contratação nasce `pendente` — a parcela 1 paga alimenta comissão/KPI;
  6. `consortium_documents.card_id` migrado do cadastro para a cota;
  7. cadastro pendente → `status = 'cota_aberta'`, `cota_aberta_at/by`, `consortium_card_id` + cópia
     de grupo/cota/plano/comissão;
  8. `consorcio_proposals.consortium_card_id`;
  9. cota reservada na Embracon — **fora do sistema**, feito por pessoa.
- **Voltar hoje:** nada limpo. Só `useDeleteConsorcioCard` (etapa 6): exige justificativa ≥ 15
  caracteres, marca `carta_excluida*` na proposta e **dá `DELETE` na cota** (parcelas e vínculos caem
  em cascata). O "Reverter" citado como defeituoso é o caminho de exclusão/undecline desta faixa.
  **Ponto honesto:** procurei `data_venda` em todo o código e no banco — só existe em
  `consorcio_venda_holding`. Não consegui confirmar qual caminho deixa as 11 vendas travadas no Dash;
  **investigar isso é o passo 1** do trabalho, antes de qualquer botão novo. O "voltar" novo **não deve
  reaproveitar** o caminho de exclusão — deve substituí-lo.
- **Voltar teria que desfazer:** cadastro volta a `aguardando_abertura`, cota sai da etapa 5.
  **Não pode desfazer:** o evento `consorcio.venda.criada` já entregue ao Dash, e a reserva já feita
  na Embracon. Consequência de desenho: voltar da 5 para a 4 **não apaga a cota** — marca a cota como
  revertida e a esconde do funil, deixando o registro vivo para reconciliar com o Dash e com a Embracon.

## Etapa 5 — Cotas Cadastradas → Etapa 6 (Cotas)

- **Avança:** botão "Parcela inicial paga" → `useMarcarParcelaInicial` (`useCotasCadastradas.ts:113`).
- **Efeitos colaterais:** `consorcio_pending_registrations.parcela_inicial_paga_em / _por`
  (marcador interno) **e** conversão da cota em `consortium_cards` → `tipo_registro = 'contratacao'`
  + `data_contratacao` = data do pagamento. `tipo_registro` e `data_contratacao` **não** estão na
  lista observada pelo trigger de webhook → **nenhum evento externo**. Nada de financeiro
  (regra do dono: etapa 5 não toca o FinanceHub). A confirmação Embracon oficial
  (`useConfirmarContratacaoEmbracon`, doc `confirmacao_embracon`) é caminho separado.
- **Voltar hoje:** "Desfazer" da marcação — limpa o marcador e devolve o card a `reserva` **apenas se
  existir `data_reserva`**. Não existe voltar da 5 para a 4. É exatamente o buraco do THIAGO FELIPE
  FAUSTINO (grupo 7274 / cota 1000).
- **Voltar teria que desfazer:** limpar o marcador da parcela inicial, devolver `tipo_registro` para
  `reserva`, `data_contratacao` para nulo, devolver parcelas `pendente` → `previsto`, e o cadastro para
  `aguardando_abertura`. **Não pode desfazer:** reserva/contratação já registrada na Embracon e
  qualquer parcela já marcada como paga em `consortium_installments` — se houver parcela paga, o
  voltar é **bloqueado**, não "desmarcado".

## Etapa 6 — Cotas (estoque)

- **Avança para dentro:** `data_contratacao` preenchida (etapa 5 ou `useConvertReservaToContratacao`,
  que recalcula todo o cronograma e vira `previsto` → `pendente`).
- **Efeitos colaterais:** parcelas com datas reais; comissão/payout e KPI "Cartas Subidas" passam a
  contar; `consorcio.venda.atualizada` dispara quando muda status/valor/grupo/cota/comissão;
  contemplação, transferência e cobrança penduram nesse registro.
- **Voltar hoje:** `useDeleteConsorcioCard` (exclusão real) e edição manual da cota.
- **Voltar teria que desfazer:** `data_contratacao`, `tipo_registro`, status das parcelas.
  **Não pode desfazer:** parcela paga, comissão já apurada em fechamento, contemplação registrada,
  transferência iniciada.

---

## Desenho do "voltar etapa" (uma mecânica só, seis usos)

**Uma tabela nova de histórico** — `consorcio_funil_reversoes`: `entidade` (proposta / cadastro / cota),
`entidade_id`, `de_etapa`, `para_etapa`, `motivo` (obrigatório, ≥ 15 caracteres), `revertido_por`,
`created_at`. Isso é **migração nova, tabela nova, nenhum ALTER em tabela existente** — exceto o item
abaixo, que precisa da sua decisão.

**Precisa de decisão sua (não assumo permissão):** para "esconder do funil sem apagar" eu preciso de
um marcador na cota — uma coluna nova em `consortium_cards` (ex.: `revertida_em` / `revertida_por`) ou
uma tabela lateral de cotas revertidas. Tabela lateral evita `ALTER TABLE` mas obriga todo hook de
listagem a filtrar por ela. Minha recomendação: coluna nova, nullable, sem default — não entra na lista
observada pelo trigger de webhook, logo não gera evento.

**Regras fixas do botão:**
- Nunca `DELETE`. Voltar move estado e grava linha no histórico.
- Nunca gera nem cancela cobrança, título, comissão, previsão de caixa ou chamada para
  `adm.mcfcapital.com.br` / MCF Pay / Asaas.
- Nunca reenvia webhook: flags de envio (`webhook_carta_cadastrada_enviado_em`) são preservadas.
- Motivo obrigatório, e o registro volta carregando um selo "revertida em <data> por <pessoa>".
- **Termo assinado não desassina.** Voltar da 4 para a 3 mantém o termo `assinado` e visível no
  histórico; se a venda mudar de valor/carta depois, é **novo termo**, gerado por cima, e o antigo fica
  arquivado. Se a venda voltar sem mudança, o termo antigo continua valendo e a venda reentra liberada.
- **Bloqueios duros (o botão não aparece):** parcela paga na cota; comissão em mês já fechado;
  contemplação, transferência ou cobrança iniciada.

**Permissão:** `admin`, `manager`, `coordenador` e `cobranca_consorcio` podem voltar etapa.
Closer e SDR **não** — voltar é desfazer trabalho de outra pessoa. Etapa 1 (`Voltar p/ Agendada`) fica
como está hoje, porque é o desfecho do próprio closer.

---

## As três respostas diretas

**Seguras de reverter** (só estado interno, nenhum efeito externo):
- 1 → 2 (status do attendee). Já existe e funciona.
- **5 → 4**: o avanço não dispara webhook nem financeiro; devolver `reserva` + parcelas `previsto` +
  cadastro `aguardando_abertura` é reversível de verdade.
- 6 → 5, **desde que** não haja parcela paga, contemplação, transferência ou mês fechado.

**Arriscadas:**
- **4 → 3**: o `INSERT` da cota já disparou `consorcio.venda.criada` para o Dash e a reserva já pode
  estar feita na Embracon. Reverter cria divergência sistema × Dash × Embracon. Precisa de reconciliação,
  não só de botão.
- **3 → 2**: e-mail/WhatsApp e o webhook do Make já saíram; o cliente já foi tocado.
- **2 → 1**: mexe em realizado/meta de Consórcio e em métrica de closer de mês possivelmente fechado.

**O que eu faria primeiro, se fosse só uma: 5 → 4.** É o pedido literal do dono (a cota do THIAGO
FELIPE FAUSTINO), é a única transição do meio do funil cujo avanço não produz nenhum efeito externo, e
é onde hoje a única saída é apagar. Entrega o alívio imediato e não cria nenhuma dívida de reconciliação.

**Antes de qualquer código:** investigar o "Reverter" defeituoso da etapa 4 e as 11 vendas travadas no
Dash. Não confirmei a causa (não existe coluna `data_venda` no fluxo do Consórcio) e não vou desenhar
sobre um diagnóstico não verificado.
