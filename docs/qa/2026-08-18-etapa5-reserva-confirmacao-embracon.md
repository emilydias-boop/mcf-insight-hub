# Etapa 5 — rotina de reserva e confirmação da Embracon

- **Data:** 18/08/2026
- **Solicitante:** Grimaldo Neto
- **Módulo/BU:** BU Consórcio — CRM Consórcio → Funil (etapa 5 "Cadastradas") / Abertura de Cota
- **Status:** implementado, aguardando conferência do gestor (não publicado)

## Contexto e objetivo

A etapa 5 do funil ("Cadastradas") era, na prática, um espelho da etapa 6 ("Cotas"):
a equipe abria a cota gravando `data_reserva` e `data_contratacao` no mesmo instante,
então a mediana "dias até contratar" vinha sempre 0 e não havia como enxergar o tempo
que um cadastro fica parado na administradora. A coluna `consortium_cards.tipo_registro`
('reserva' | 'contratacao') já existia e não era usada — é ela que passa a sustentar a
diferença entre os dois estados.

Nenhum cálculo de comissão, meta, BI ou fechamento foi alterado. As definições de
contagem das etapas 1 a 4 e 6 seguem as mesmas.

## Reserva x contratação

- **Reserva** (`tipo_registro = 'reserva'`): o cadastro foi enviado à Embracon e ainda
  não voltou confirmado. Grava `data_reserva` e mantém **`data_contratacao` nula**.
  O cronograma nasce a partir da data de reserva e as parcelas ficam com status
  **`previsto`** — é só previsão.
- **Contratação** (`tipo_registro = 'contratacao'`): a Embracon confirmou e o
  comprovante está em mãos. `data_contratacao` preenchida e parcelas pendente/pago
  normalmente (comportamento de sempre).

## Efeito na contagem da etapa 6 (Cotas)

A etapa "Cotas" filtra o período por `data_contratacao`. Como a cota aberta como
reserva não tem essa data, **ela não conta na etapa 6 enquanto não for confirmada**.
No dia da confirmação, a data de contratação informada é gravada e a cota entra na
etapa 6 naquele período. A etapa 5 continua no eixo `data_reserva`.

Consequência esperada e desejada: por um ou dois ciclos a etapa 6 pode exibir números
menores que antes, porque cotas que hoje entravam no ato do cadastro passam a entrar
só na confirmação.

## O que mudou na tela

**1. Abertura de Cota — duas ações explícitas, sem default.**
O rodapé do modal passa a ter "Abrir como reserva" e "Abrir já contratada", com o
texto: *Reserva = enviado à Embracon, aguardando confirmação. Já contratada = a
Embracon confirmou e você tem o comprovante em mãos.* Um aviso âmbar lembra que a
cota aberta como reserva só entra na etapa Cotas quando for confirmada. A data
informada no campo de data vale como data de reserva no primeiro caminho.

**2. Aba "Cadastradas" virou fila de trabalho.** Duas seções:
- *Aguardando confirmação da Embracon (N)* — reservas sem data de contratação,
  ordenadas da mais antiga para a mais nova, com coluna **Dias parados** (hoje −
  data de reserva) em semáforo: neutro até 7, âmbar de 8 a 15, vermelho acima de 15.
  Esta seção **ignora o filtro de período** de propósito (reserva parada há 40 dias
  tem que aparecer mesmo olhando o mês corrente) — o texto na seção diz isso.
- *Confirmadas no período (N)* — o que a aba mostrava antes, respeitando o período.
  A **mediana** agora só considera cotas que realmente passaram por reserva →
  confirmação (as duas datas em dias diferentes), e ao lado aparece quantas entraram
  no cálculo. Antes a mediana vinha 0 por causa das datas gravadas juntas.

**3. Confirmar contratação.** Cada linha da fila tem o botão "Confirmar contratação",
que abre um modal com: data de contratação (padrão hoje, editável), número do
contrato na Embracon (`consortium_cards.contrato_embracon`) e **upload obrigatório**
do documento **"Confirmação Embracon"**. Ao confirmar, o arquivo é anexado em
`consortium_documents` com `card_id` e `tipo = 'confirmacao_embracon'`, a
`data_contratacao` é gravada, `tipo_registro` vira `'contratacao'`, as datas das
parcelas são recalculadas a partir da nova base e as parcelas `previsto` passam a
`pendente`. A cota sai da fila.

**Saída de exceção:** o link discreto "Confirmar sem comprovante" exige **motivo
escrito** (mínimo 10 caracteres, mesmo padrão de no-show, recusa e declínio). O
motivo é registrado em linha própria no campo `observacoes` do card, com carimbo de
data e usuário, sem apagar o que já estava lá. Essas cotas recebem selo âmbar
**"sem comprovante"** na seção de confirmadas — dá para medir quantas confirmações
estão sem lastro.

**4. Novo tipo de documento.** `'confirmacao_embracon'` entrou em `TipoDocumento` e
em `TIPO_DOCUMENTO_OPTIONS` com o rótulo "Confirmação Embracon". A coluna `tipo` é
texto livre no banco, então não houve migration. **Não confundir** com o
"Comprovante de Cadastro" (`consorcio_termos`, tipo `comprovante_cadastro`, botão
"Gerar Comprovante" no drawer): aquele é o documento que a MCF **gera e envia ao
cliente**; este é o retorno que a **Embracon nos manda**.

## Duas correções que pegaram carona

- **Drawer da cota, aba Documentos:** o botão "Visualizar" era decorativo (sem
  `onClick`). Agora gera URL assinada na hora (bucket privado, mesmo padrão do
  upload) e abre o arquivo em nova aba, com `storage_url` como fallback.
- **GerarComprovanteModal:** lia `card.deal_id`, coluna que não existe em
  `consortium_cards`, então o vínculo com o negócio vinha sempre indefinido. Passou
  a buscar o `deal_id` pelo cadastro pendente vinculado à cota
  (`consorcio_pending_registrations.consortium_card_id`).

## O que a equipe passa a precisar fazer

1. Ao abrir a cota depois de enviar o cadastro à Embracon, usar **"Abrir como reserva"**.
   "Abrir já contratada" só quando o retorno da administradora já estiver em mãos.
2. Trabalhar a fila "Aguardando confirmação da Embracon" todos os dias, priorizando
   as linhas em âmbar e vermelho.
3. Quando a Embracon confirmar: clicar em "Confirmar contratação", informar a data
   real da contratação, o número do contrato e **anexar o retorno da administradora**.
4. Usar "Confirmar sem comprovante" só em exceção — o motivo fica registrado e a
   cota entra na conta das confirmações sem lastro.

## Como conferir

- Abrir uma cota nova como reserva: o card deve nascer com `tipo_registro = 'reserva'`,
  `data_contratacao` nula e parcelas em `previsto`; a cota aparece na fila da etapa 5
  e **não** na etapa 6.
- Confirmar essa cota com data de hoje e um arquivo qualquer: a cota sai da fila,
  aparece em "Confirmadas no período" com Dias = diferença real, sem selo âmbar, e
  passa a contar na etapa 6.
- Repetir usando "Confirmar sem comprovante": selo âmbar "sem comprovante" na lista e
  linha nova em `observacoes` com data, usuário e motivo.
- Aba Documentos do drawer: "Visualizar" abre o arquivo.

## Revisão do commit 4acc6a00 — 6 ajustes

1. **Enter não cria mais reserva silenciosa.** Os dois botões de abertura eram
   `type="submit"` e o de reserva vinha primeiro no DOM, então Enter em qualquer
   campo abria reserva. Ambos passaram a `type="button"`, cada um chamando
   `form.handleSubmit(onSubmit, onInvalid)()` após fixar o modo — só o clique decide.
2. **`data_reserva` não é mais enviada como `null` explícito.** Conferido no banco:
   `consortium_cards.data_reserva` não tem default nem trigger, e a constraint
   `consortium_cards_datas_consistencia_check` já aceita `tipo_registro='reserva'`
   com `data_contratacao` nula (nenhuma migration necessária). Mesmo assim, no
   caminho "abrir já contratada" a chave passou a ser **omitida** (undefined, que o
   insert filtra) em vez de mandar null, para não anular default/trigger futuros.
3. **Reserva não contamina dinheiro.** Parcelas com status `previsto` (cota ainda em
   reserva) ficaram fora de:
   - `useConsorcioPrevisaoMensal` (`.neq('status','previsto')`) — a Previsão de
     Recebimento Mensal não projeta mais comissão de cota não confirmada;
   - `useConsorcioPagamentos` (cálculo de `temAtraso`) — reserva parada não marca a
     cota como inadimplente nos KPIs de cobrança nem no alerta do drawer.
4. **Confirmação idempotente.** Antes de inserir o documento, o hook verifica se já
   existe `confirmacao_embracon` para o card (retentativa não duplica). O append do
   motivo em `observacoes` foi movido para **depois** da conversão bem-sucedida.
   `handleConfirm` ganhou try/catch (modal fica aberto para nova tentativa) e o toast
   duplicado saiu: sucesso é anunciado pela conversão, e o hook só avisa falhas
   anteriores a ela.
5. **Fila alinhada com a etapa 5.** `useConsorcioReservasAguardando` passou a
   restringir a fila às cotas com **origem no funil** (mesmo recorte da etapa) e a
   paginar com `.range()` de 1000 em 1000 — sem isso o PostgREST cortava em silêncio.
   A aba passou a exibir a reconciliação do período (total da etapa 5 = confirmadas +
   aguardando), deixando claro que a fila ignora o filtro de período de propósito.
6. **Selo "sem comprovante" só do fluxo novo.** Corte em `CONFIRMACAO_EMBRACON_DESDE`
   ('2026-08-18'): apenas cotas com `data_contratacao` a partir dessa data são
   elegíveis ao selo (helper `elegivelSeloComprovante`), e só essas entram na consulta
   de comprovantes. O histórico anterior deixa de nascer 100% marcado.
