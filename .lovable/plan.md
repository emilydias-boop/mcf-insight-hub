# Voltar etapa no funil Consórcio — correção do mapa, com evidência

Você estava certo: eu me contradisse. A contradição está resolvida abaixo com código e dados.
Ainda é rodada de desenho.

## 1. Onde nasce a linha em `consortium_cards` — numeração sem ambiguidade

A linha nasce na **4 → 5**, não na 5 → 6.

- **4 → 5 (Cotas a Fazer → Cotas Cadastradas):** `OpenCotaModal` → hook de criação em
  `src/hooks/useConsorcioPendingRegistrations.ts` (~1180): `supabase.from('consortium_cards').insert(...)`
  com `tipo_registro: isReserva ? 'reserva' : 'contratacao'`. Na mesma transação: parceiros PJ,
  cronograma em `consortium_installments`, `consortium_documents.card_id` migrado, cadastro pendente
  para `status = 'cota_aberta'` + `cota_aberta_at` + `consortium_card_id`, e
  `consorcio_proposals.consortium_card_id`. O `INSERT` na cota dispara
  `trg_enqueue_outbound_consorcio_webhook` → `consorcio.venda.criada` na `outbound_webhook_queue`.
- **5 → 6 (Cotas Cadastradas → Cotas):** `useMarcarParcelaInicial` (`useCotasCadastradas.ts:113`) —
  grava `parcela_inicial_paga_em/_por` no cadastro e faz `UPDATE` na cota já existente:
  `tipo_registro = 'contratacao'` + `data_contratacao`. Nenhum `INSERT`, e nenhuma dessas duas colunas
  está na lista observada pelo trigger → **nenhum evento sai**. (`useConvertReservaToContratacao` é o
  outro caminho da mesma transição, com recálculo do cronograma.)

**Condição de cada aba:**
- Etapa 5 (`useCotasCadastradas`): cadastro com `status in ('cota_aberta','vinculada')`,
  `consortium_card_id IS NOT NULL`, e grupo/cota preenchidos.
- Etapa 6 (Cotas): cota com `data_contratacao` preenchida.

Portanto o que eu chamei de "5 → 4 segura" era o **desfazer da 5 → 6** — esse sim é interno.
O desfazer da criação da cota (5 → 4) é a transição **arriscada**.

## 2. Estado real da cota do THIAGO FELIPE FAUSTINO (grupo 7274 / cota 1000)

Consultado agora no banco:

- **Não existe mais linha em `consortium_cards`.** O id `ab0758fc-2357-4970-9ab0-c6d7edd6a940`
  não retorna nada. A cota foi **excluída** — a proposta `68a1624b…` está com
  `carta_excluida = true`, `carta_excluida_em = 2026-08-24 00:24`, por *Grimaldo de Oliveira Melo Neto*,
  motivo *"teste do grima ."*, `consortium_card_id` nulo e `status = 'recusada'`.
  Logo: `tipo_registro` e `data_contratacao` não existem mais para consultar.
- **O cadastro pendente `808473fd…` continua `status = 'cota_aberta'`**, `cota_aberta_at 22/08 12:33`,
  com `consortium_card_id` ainda apontando para a cota apagada. Não há FK nessa coluna
  (`consorcio_pending_registrations` só tem FK em `credito_id`, `deal_id`, `proposal_id`) — o ponteiro
  ficou **pendurado**. É exatamente por isso que ele continua aparecendo em Cotas Cadastradas: a aba
  pede `consortium_card_id IS NOT NULL`, e o ponteiro morto satisfaz a condição.
- **Evento para o Dash:** saiu **1** evento `consorcio.venda.criada` em 22/08 12:33 para o config
  *Consórcio - Vendas para Grima*, e ele está **`failed`**: 3 tentativas, `last_error = HTTP 400`,
  `sent_at` nulo. **Nunca foi entregue.**
- **Bônus com evidência — as "11 travadas":** a fila tem exatamente **11** `consorcio.venda.criada`
  com `status = 'failed'`, todos `HTTP 400` com 3 tentativas e `sent_at` nulo (de 03/05 a 22/08,
  incluindo o THIAGO, três do RODRIGO MOREIRA ROBERTO no grupo 7274 e o PAULO SERGIO). Contra 1.128
  `sent`. As 11 travadas são **falha de entrega no consumidor** (o endpoint devolve 400), não um campo
  faltando no nosso lado — não existe coluna `data_venda` em nenhum caminho do Consórcio. O *porquê*
  do 400 é do lado do Dash e ainda **não está diagnosticado**; nenhum "voltar etapa" deve mexer nisso.

## 3. Classificação refeita

**A pergunta direta — tirar o THIAGO da aba Cotas Cadastradas e devolver para Cotas a Fazer dispara
algo para fora do sistema?**

**Não.** No caso dele a cota já não existe, então não há `UPDATE` em `consortium_cards` para disparar
trigger nenhum; o único evento que existia falhou e nunca chegou ao Dash. O "voltar" dele é
puramente: cadastro `cota_aberta` → `aguardando_abertura` e limpar o ponteiro morto.

**No caso geral, com a cota viva, o voltar 5 → 4 é arriscado** — a cota já foi anunciada (`sent`) e a
reserva já pode estar feita na Embracon. Digo na cara: nesses casos a venda **já foi anunciada ao
Dash** e o sistema não pode fingir que não foi. Sua leitura do meu texto é a correta e é o desenho:
**a cota não é apagada.** Ela fica viva, marcada como revertida, fora do funil, para reconciliação
manual com o Dash e com a Embracon. Nenhum evento de cancelamento é enfileirado — cancelar é decisão
comercial, não consequência de um botão de correção.

**Seguras (nenhum efeito externo):**
- 1 → 2 (status do attendee) — já existe (`Voltar p/ Agendada`).
- **6 → 5** — desfazer "Parcela inicial paga": só `tipo_registro`/`data_contratacao`/marcador e
  parcelas `pendente` → `previsto`. Nenhum campo observado pelo trigger. Bloqueado se houver parcela paga.
- **5 → 4 quando a cota não existe ou o evento está `failed`/nunca enviado** — caso THIAGO.

**Arriscadas:**
- **5 → 4 com cota viva e evento `sent`** — divergência sistema × Dash × Embracon. Exige selo de
  revertida + fila de reconciliação, não só um botão.
- **4 → 3** — o aceite já disparou automação (e-mail/WhatsApp) e o webhook do Make; o cliente foi tocado.
- **3 → 2** — mexe em realizado/meta de Consórcio e em métrica de mês possivelmente fechado.

## 4. O que dá para entregar hoje, sem dívida

**Entrega 1 — "Voltar para Cotas a Fazer" na etapa 5.** Botão na linha, motivo obrigatório
(≥ 15 caracteres), disponível para **todo mundo que já usa a tela** (closer e SDR incluídos, sem
restrição de papel), com selo visível de revertido. O que ele faz:
- cadastro pendente → `status = 'aguardando_abertura'`, limpa `cota_aberta_at/by`, limpa
  `consortium_card_id` e o marcador `parcela_inicial_paga_em/_por`;
- **cota nunca é apagada**: se existir, é marcada como revertida e sai do funil (ver decisão abaixo);
- grava a reversão no histórico: quem, quando, de qual etapa para qual, motivo;
- preserva `webhook_carta_cadastrada_enviado_em` (zero reenvio) e não enfileira nenhum evento;
- **bloqueia** (botão não aparece) se houver parcela paga, contemplação, transferência ou mês fechado;
- quando existe `consorcio.venda.criada` com `status = 'sent'`, mostra um aviso explícito
  "já anunciada ao Dash — reconciliar" na linha revertida, sem tentar corrigir nada automaticamente.

**Entrega 2 — desfazer 6 → 5** já existe parcialmente; só falta liberá-lo quando não há `data_reserva`
(hoje ele desiste silenciosamente) e passar a gravar no mesmo histórico.

Fica fora de hoje: 4 → 3 e 3 → 2, e qualquer conserto do HTTP 400 do Dash.

### O que precisa da sua decisão (não assumo permissão)

1. **Tabela nova** `consorcio_funil_reversoes` (entidade, entidade_id, de_etapa, para_etapa, motivo,
   revertido_por, created_at) — migração nova, nenhum `ALTER` em tabela existente.
2. **Marcador de cota revertida:** preciso de coluna nova em `consortium_cards`
   (`revertida_em` / `revertida_por` / `revertida_motivo`, nullable, sem default — fora da lista do
   trigger, logo sem evento) **ou** uma tabela lateral. Recomendo as colunas; a tabela lateral evita o
   `ALTER` mas obriga todo hook de listagem a filtrar por ela.
3. **Consertar o caso THIAGO exige tocar dado existente** — limpar o `consortium_card_id` pendurado do
   cadastro `808473fd…` e devolvê-lo para `aguardando_abertura`. Não faço isso sem sua palavra. Vale
   avaliar depois, em rodada própria, se `consortium_card_id` deveria ter FK com `ON DELETE SET NULL`
   para impedir novos ponteiros mortos — isso também é `ALTER` em tabela existente.

**O que eu faria primeiro, se fosse só uma:** a Entrega 1. É o pedido literal do dono, resolve o caso
concreto que hoje só tem saída por exclusão, e no caso dele não produz nenhum efeito externo.
