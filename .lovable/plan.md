# Levantamento — o que sai daqui para o Make e o que falta para a mensagem

Somente leitura. Nada foi alterado, publicado ou disparado. **Nenhuma requisição de teste foi enviada ao Make** — os dados abaixo vêm do histórico gravado no banco (`bu_webhook_logs`, 217 envios entre 30/07 e 14/09/2026, todos com resposta OK).

---

## Achado principal, antes de tudo

**O gatilho está falhando, não o cenário do Make.** Nas 61 vendas lançadas nos últimos 60 dias, **todas** geraram cadastro de carta — mas **só 33 chegaram ao Make. 28 (46%) nunca saíram daqui.** E não é falta de dado: nas 28, nome, contato e crédito estavam todos preenchidos.

| Semana | Vendas | Chegaram ao Make | Não chegaram |
|---|---|---|---|
| 20/07 | 13 | 0 | 13 |
| 27/07 | 8 | 1 | 7 |
| 10/08 | 2 | 2 | 0 |
| 17/08 | 2 | 2 | 0 |
| 24/08 | 13 | 13 | 0 |
| 31/08 | 11 | 10 | 1 |
| 07/09 | 7 | 3 | **4** |
| 14/09 | 5 | 2 | **3** |

As de julho se explicam: o registro de log só existe a partir de 30/07. **As de setembro não.** Nos dias 08, 09, 15 e 16/09 há cadastros completos com a marca de envio vazia e nenhum log — o disparo simplesmente não aconteceu, enquanto no dia 10/09 sete cadastros seguidos saíram normalmente. Ou seja: **a sensação de "parou" do dono é real, e a causa está do nosso lado, não no Make.** A causa exata é `NÃO DETERMINADO` — o padrão sugere caminhos de cadastro que não chamam o disparo (cadastro feito por outra tela, fora do modal de lançamento) ou falha silenciosa na chamada, que é engolida por um `catch`. Para fechar isso falta olhar os registros da função no período.

---

## 1) O payload de hoje

Envio real mais recente (14/09/2026, cliente Liliane Pontes). Objeto inteiro, como sai:

```json
{
  "event": "consorcio.carta.cadastrada",
  "occurred_at": "2026-09-14T22:44:45.358Z",
  "lead": { "nome_completo": "Liliane Pontes da Silva", "email": "lipontes@hotmail.com",
            "telefone": "(12) 98888-1550", "cpf": "367.894.158-31", "tipo_pessoa": "pf",
            "razao_social": null, "cnpj": null },
  "carta": { "card_id": null, "valor_credito": 120000, "tipo_produto": "parcelinha",
             "produto_codigo": null, "categoria": null, "grupo": null, "cota": null,
             "prazo_meses": 240, "data_contratacao": null, "dia_vencimento": null,
             "condicao_pagamento": "50", "inclui_seguro": false,
             "empresa_paga_parcelas": "sim", "tipo_contrato": "normal",
             "parcelas_pagas_empresa": 2, "inicio_segunda_parcela": null,
             "vendedor_name": "Cleiton Anacleto Lima", "origem": null, "origem_detalhe": null,
             "origem_lead": null, "e_transferencia": false, "transferido_de": null,
             "valor_comissao": null,
             "observacoes": "Foi combinado da MCF pagar a 1° e a 2° Parcela" },
  "proposta": { "id": "171e84ac-…", "status": "aceita", "deal_id": "6787d6b4-…",
                "qtd_cartas": 1, "valor_credito": 120000, "prazo_meses": 240,
                "tipo_produto": "parcelinha", "aceite_at": "2026-09-14T22:44:43.553+00:00",
                "aceite_date": "2026-09-14", "proposal_date": "2026-09-14",
                "created_by": "16828627-…", "aceite_by": "16828627-…",
                "proposal_details": "Foi combinado da MCF pagar a 1° e a 2° Parcela",
                "origem_lead": null, "consortium_card_id": null, "carta_excluida": false, "…": null },
  "registration": { "id": "3ed8c78a-…", "status": "aguardando_abertura", "aceite_date": "2026-09-14" },

  "registration_id": "3ed8c78a-…", "card_id": null, "proposal_id": "171e84ac-…",
  "nome_completo": "Liliane Pontes da Silva", "email": "lipontes@hotmail.com",
  "telefone": "(12) 98888-1550", "cpf": "367.894.158-31", "cnpj": null, "tipo_pessoa": "pf",
  "valor_credito": 120000, "grupo": null, "cota": null, "produto": "parcelinha",
  "prazo_meses": 240, "vendedor": "Cleiton Anacleto Lima", "origem_lead": null
}
```

Quem monta: `src/lib/consorcioCartaWebhook.ts` (checa a marca de envio, chama a função, marca depois do sucesso, nunca levanta erro) e `supabase/functions/consorcio-carta-cadastrada-webhook/index.ts` (lê o cadastro, a proposta e o card, monta o objeto com prioridade cadastro → proposta → card, barra envio se faltar nome, contato ou crédito, posta no Make e grava o log).

### Item por item, para a mensagem que o dono quer

| Dado da mensagem | Vai hoje? | De onde |
|---|---|---|
| Nome do cliente | **Vai** | `nome_completo` |
| Crédito Total (soma de todas as cartas) | **Não vai** | O que vai é o crédito **daquela carta** (`valor_credito`). O total da venda está em `proposta.valor_credito`, que **coincide** com o da carta quando é uma só — em venda de 2+ cartas, o campo de topo mostra só uma parte |
| Quantidade de cartas | **Vai** | `proposta.qtd_cartas` (aninhado; não está no topo) |
| Valor de cada carta | **Não vai** | Cada chamada traz uma carta. Não existe lista das cartas da venda |
| Parcelas que a MCF paga | **Vai** | `carta.parcelas_pagas_empresa` (2, no exemplo) e `carta.empresa_paga_parcelas` ("sim") |
| Nome do closer | **Vai** | `vendedor` (texto do lançamento) |
| Nome do SDR | **Não vai** | Não existe nenhum campo de SDR no objeto |

Resumo: **4 de 7 já vão.** Faltam crédito total, lista de cartas e SDR. Com o payload de hoje, o cenário no Make **não consegue** montar a mensagem completa — e nas vendas de mais de uma carta ele montaria uma mensagem por carta, cada uma com um pedaço do crédito.

---

## 2) O momento do disparo

- **Uma chamada por carta cadastrada, não por venda.** Nas 38 vendas com aceite nos últimos 60 dias, 94 cartas geraram 95 cadastros e **19 dessas vendas têm mais de um cadastro**. Venda de 3 cartas = 3 chamadas ao Make. Houve uma venda com **10 chamadas** registradas (reenvios).
- **A distância entre lançar a venda e cadastrar a carta é praticamente zero.** Mediana: instantâneo (os dois acontecem no mesmo clique, o cadastro é gravado fração de segundo antes do aceite). Pior caso: 1 segundo. Não existe atraso a considerar.
- **O cadastro não é opcional na prática.** Das 61 vendas lançadas nos últimos 60 dias, **61 geraram cadastro pendente — nenhuma ficou sem.** O bloco é opcional no formulário, mas o time preenche sempre.

Conclusão: o "cadastro da carta" e o "lançamento da venda" são o **mesmo instante**. Mudar o momento do disparo não resolve nada. O problema real é (a) o disparo que falha em quase metade dos casos e (b) o payload incompleto e por carta em vez de por venda.

---

## 3) Desenho para um disparo por venda, com o payload completo

O que precisaria existir:

- **Um evento novo por venda, não por carta** — `consorcio.venda.lancada` —, disparado uma única vez ao aceitar a proposta, com a proposta como chave.
- **Uma nova função de envio** (ou um caminho separado na atual) que leia a proposta, **todas** as cartas dela, e monte: nome do cliente, crédito total (da própria proposta, não somado à mão), lista com valor de cada carta, parcelas que a MCF paga por carta, nome do closer e nome do SDR.
- **Disparo no servidor, não no navegador.** Hoje a chamada sai da tela: se o closer fecha o modal, perde conexão ou a chamada falha, ninguém reenvia — é exatamente o perfil das 28 vendas que não chegaram. Um gatilho de banco enfileirando o evento (a mesma fila que já existe para os webhooks de saída, com repetição automática a cada minuto) elimina essa classe de falha.
- **Onde entraria:** no aceite da proposta, sem tocar em nada do que já grava a venda, e sem mexer no webhook atual — ele continua servindo o cenário de cadastro do Make.

### O SDR

Consulta: da proposta pega-se o negócio (`deal_id`); do negócio, os participantes de reunião; de cada participante, quem agendou (`booked_by`); daí o nome no cadastro de usuários — usando o agendamento mais antigo, que é a R1.

**Medição: das 61 vendas, 60 resolvem o nome do SDR — 98,4%.** Apenas 1 ficaria em branco. O campo é confiável.

### Risco de disparo duplicado

- **Venda editada depois:** com trava por venda, não reenvia. Sem trava, cada salvamento vira mensagem nova.
- **Carta adicionada depois do lançamento:** hoje geraria uma chamada nova (uma mensagem a mais, com crédito parcial). Num evento por venda, precisaria de decisão explícita: ignorar, ou mandar uma segunda mensagem de complemento.
- **Reenvio manual:** o caminho atual aceita forçar reenvio ignorando a trava. É o que explica a venda com 10 chamadas.

---

## 4) Idempotência

- **Hoje:** a marca `webhook_carta_cadastrada_enviado_em` fica **no cadastro da carta**. Protege por carta, não por venda — por isso uma venda de 3 cartas manda 3 mensagens e cada uma é considerada legítima.
- **Editar a venda depois:** **não reenvia**, porque a marca já está gravada — a menos que alguém use o reenvio forçado, que ignora a marca de propósito.
- **Trava equivalente para um disparo por venda:** a marca teria que ficar **na proposta**, gravada pelo servidor no mesmo passo do envio (não pelo navegador depois, como hoje — se a tela cair entre o envio e a marcação, o próximo envio duplica). Com a fila de webhooks de saída, essa garantia já vem de fábrica.

---

## O que falta olhar

- **Registros da função `consorcio-carta-cadastrada-webhook` nos dias 08, 09, 15 e 16/09** para nomear a causa exata das vendas que não saíram. `NÃO DETERMINADO` até lá.
- **Painel do Make:** confirmar se o cenário monta mensagem e para onde manda (grupo, número, e-mail). Fora do sistema.

---

## Decisões que preciso antes de propor implementação

1. **Consertar o disparo atual** (46% de perda) é prioridade sobre qualquer campo novo — confirma?
2. **Uma mensagem por venda** (com a lista de cartas) em vez de uma por carta — é isso que o dono quer?
3. **Mensagem montada no Make** (mandamos o dado completo) **ou aqui** (mandamos o texto pronto)? A segunda dá controle sobre o formato exato; a primeira deixa o dono editando lá.
4. **Carta adicionada depois do lançamento:** silêncio ou segunda mensagem?

Nada será alterado até essas respostas.
