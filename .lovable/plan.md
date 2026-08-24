# Diagnóstico: "Cotas com cadastro a ajustar" não sai da lista após "Trocar lead"

Sua leitura está **correta**. O alerta não pede lead vinculado — pede **reunião conduzida por closer da BU Consórcio**. "Trocar lead" grava o vínculo, mas nas 4 linhas atuais **nenhum** lead candidato tem reunião de consórcio, então a condição de saída não pode ser satisfeita por esse botão. O dono clicaria para sempre.

## A. Condição exata de entrada e de saída

Monta a lista: `src/hooks/useConsorcioCotasContratadas.ts` (100% leitura, sem RPC).

- Universo: `consortium_cards` com `tipo_registro = 'contratacao'` e `data_contratacao` no período (linhas 181-188).
- A linha entra no resíduo quando o **CLIENTE** (CPF/CNPJ, senão nome normalizado) não tem SDR atribuído: `clienteSdr.get(pessoa)` vazio (linhas 500-508, 555-566).
- `clienteSdr` só é preenchido a partir de `dealBooker`, que exige, para algum deal de alguma cota do cliente, um `meeting_slot_attendees` que satisfaça **todas** estas condições (linhas 283-334):
  1. `meeting_slot_id` → `meeting_slots.closer_id` pertencente a `closers` com `bu = 'consorcio'` (linhas 283-286);
  2. `status NOT IN ('cancelled','invited')` (linha 290);
  3. `booked_by NOT NULL` (linha 304);
  4. `profiles.email` do `booked_by` preenchido (linhas 310-317, 328).

Predicado de saída, literal: existe attendee de qualquer cota do mesmo cliente com slot de closer de BU consórcio, status ≠ cancelled/invited, `booked_by` não nulo e e-mail de perfil presente. Nada além disso tira a linha.

O motivo exibido vem do diagnóstico em cascata `diagnosticarCota` (linhas 402-462); `sem_reuniao_bu` é o ramo da linha 430-437, disparado por `!dealTemReuniaoBU.has(dealId)`.

## B. O selo `ajustado`

É **estado gravado**, e é **ortogonal ao alerta**. Colunas `deal_vinculo_ajustado_por` / `deal_vinculo_ajustado_em` / `deal_vinculo_anterior` em `consorcio_pending_registrations`, lidas em `useConsorcioCotasContratadas.ts` linhas 195-199 e montadas em `ajuste` (linhas 379-385). Renderizado por `SeloAutoria` em `src/components/sdr/ResiduoDetalheModal.tsx` (linhas 83-100).

Ele registra apenas **quem mexeu no vínculo e quando** — trilha de autoria. Não participa do predicado de saída em nenhum ponto. Não é a lista "ignorando o selo": é decisão de desenho — o selo documenta a intervenção, a saída depende da reunião. O efeito prático, porém, é o que o dono viu: selo verde de "ajustado" convivendo com linha pendente. O modal já tenta ser honesto nisso (aviso âmbar "Vínculo salvo, mas o caso continua na lista: …", linhas ~196-215 do modal), mas o botão continua sendo oferecido.

## C. O que "Trocar lead" faz

`CorrigirVinculoCotaModal` → RPC `consorcio_corrigir_vinculo_cota` (SECURITY DEFINER, auditada). Ela grava **um único campo funcional**: `consorcio_pending_registrations.deal_id` (+ `updated_at`), mais a trilha de autoria e um `audit_logs` de impacto. Não cria reunião, não toca `meeting_slots`, `meeting_slot_attendees` nem `booked_by`.

**Com todas as letras: trocar o lead só satisfaz a condição de saída se o lead novo (ou outra cota do mesmo cliente) já tiver R1 de Consórcio elegível com agendador.** Quando nenhum lead do cliente tem essa reunião, a ação é inócua para o alerta — grava o vínculo e a linha permanece.

## D. Os quatro casos reais (consulta ao banco)

| Cliente | Grupo/Cota | card_id | Deal vinculado hoje | Attendees do deal |
|---|---|---|---|---|
| RODRIGO MOREIRA ROBERTO (CPF 385.446.388-05) | 7274/57 | df8071bb… | `a28592fa-afca-4ecb-bcde-944a17c608b1` — "Rodrigo Moreira Roberto" (origem `00 - GERENTES DE RELACIONAMENTO`) | **zero** |
| RODRIGO MOREIRA ROBERTO | 7274/678 | cd5bd31c… | mesmo deal `a28592fa…` | **zero** |
| ROSANGELA MARIA DOS PASSOS FERREIRA (CPF 039.138.426-08) | 7272/2682 | d13d2931… | `6858e59a-b37e-4957-b928-5373825f893f` — "Rosângela Maria dos Passos Ferreira - Efeito Alavanca" | **zero** |
| ROSANGELA MARIA DOS PASSOS FERREIRA | 7272/4549 | 1abd6a9f… | mesmo deal `6858e59a…` | **zero** |

`select … from meeting_slot_attendees where deal_id in (a28592fa…, 6858e59a…)` retorna **conjunto vazio** — não é "reunião de outra BU", não é "sem agendador": não existe reunião nenhuma para esses leads.

Busca por telefone (sufixo 9 dígitos: `983647601`, `981087575`) sobre `crm_deals`/`crm_contacts` encontra **exatamente esses dois deals** e nenhum outro; ambos com `att_total = 0` e `r1_cons = 0`. Varredura por nome também não achou outro deal desses titulares com R1 de consórcio.

Conclusão por linha: **falta uma reunião de consórcio que não existe** — não falta vínculo, não falta agendador. Os dois selos `ajustado` do Rodrigo (21/08, 19:23 e 19:56) apenas registram que o vínculo foi (re)apontado para o mesmo deal sem reunião.

Contexto dos cadastros: ambos sem `proposal_id` (venda lançada direto), `aceite_date` 20/08 e 10/08, status `cota_aberta` / `vinculada`.

## E. Existe caminho de saída hoje?

**Não pela tela.** É esse o caso: vendas que entraram por fora do funil de R1 (Rodrigo via Gerentes de Relacionamento, Rosângela via Efeito Alavanca + Clube). Sem R1 de Consórcio, o alerta é **permanente por construção**.

"Informar quem agendou" existe (`InformarAgendadorModal`, disparado quando `problema === 'sem_agendador'`, modal linhas ~297-306) e resolve **outro** caso: reunião elegível que existe mas está sem `booked_by`. Ela não aparece nessas 4 linhas porque o diagnóstico parou antes — `sem_reuniao_bu` — e o hook só popula `agendamento` quando há attendee de consórcio (linhas 293-301). Não há attendee: não há o que informar.

## F. O texto do aviso

`src/components/sdr/CadastroSemLeadAlerta.tsx` linhas 82-85 e 103 descrevem dois casos: (1) reunião existe sem agendador; (2) cota aponta para lead sem reunião. As 4 linhas são o **caso 2** — mas o conselho do caso 2 ("troque para o lead que teve a R1") pressupõe que exista, em outro lugar, um lead **com** R1 de consórcio. Para esses dois clientes não existe. **Confirmado: o conselho é impossível de seguir nessas 4 linhas.**

## G. Impacto no número (R$ 540.000)

**Dentro dos dois números — o alerta não mexe em dinheiro.**

- **Consórcio Efetivado**: ancorado em `consortium_cards.tipo_registro='contratacao'` + `data_contratacao`. As 4 cotas têm contratação em 20/08 e 10/08/2026 e estão nesse universo — são, inclusive, as mesmas linhas que o hook do alerta leu (linhas 181-188). A ausência de SDR não remove a cota do total; ela cai na linha residual "Sem agendamento de consórcio", que soma no Total (linhas 525-528: `total++` e `totalCredito += credito` acontecem antes de qualquer diagnóstico).
- **Produção Gerada**: os cadastros têm `aceite_date` em agosto (20/08 e 10/08) e entram pela perna de cadastros sem proposta, com atribuição por `created_by`/vendedor — que está preenchido em todos (André Duarte, João Pedro).

Ou seja: o texto "o crédito da venda não está perdido" **está certo**, e agora por query. O que se perde é a **atribuição de SDR** — os R$ 540.000 aparecem sem SDR, não fora do total.

## Saídas possíveis (sem escolha minha)

1. **Esconder o botão quando ele não pode resolver.** Quando nenhum deal candidato do cliente tem R1 de consórcio, trocar "Trocar lead" por texto ("nenhum lead deste cliente tem R1 de Consórcio"). Prós: nenhuma migração, elimina o clique infinito. Contras: a linha continua na lista para sempre; não dá desfecho.
2. **Marcar como "venda fora do funil" (reconhecimento explícito).** Uma coluna/tabela de exceção que remove a linha do alerta mantendo trilha de quem reconheceu. Prós: dá desfecho e some do painel. Contras: exige migração e regra de quem pode marcar; risco de virar tapa-buraco para cadastro realmente ruim.
3. **Separar em duas caixas: "corrigível" vs "sem R1 nesta BU".** Mantém tudo visível, mas em blocos com ação diferente (segundo bloco sem botão, só CSV). Prós: só UI, honesto. Contras: continua acumulando linhas; não resolve o incômodo do dono.
4. **Permitir informar o agendador mesmo sem reunião** (atribuir o SDR manualmente à venda). Prós: fecha o caso e dá SDR à venda. Contras: cria atribuição sem reunião de lastro, o que fura a regra "SDR = quem agendou a R1" e pode contaminar métricas de agendamento; exige migração e auditoria forte.
5. **Excluir do alerta as origens que não passam por R1** (ex.: Gerentes de Relacionamento, Efeito Alavanca) por configuração. Prós: silencia a classe inteira sem tocar dado. Contras: esconde também casos legítimos dessas origens; depende de manter a lista de origens.

## Restrições respeitadas nesta rodada

Nenhum código, nenhuma migração, nenhum dado tocado. Todas as consultas foram `SELECT`.
