# Auditoria: as 10 cotas residuais (Rodrigo e Rosangela) — só leitura

## 1) Busca ampla por reunião, ignorando o vínculo atual

Critérios aplicados sobre `meeting_slot_attendees` + `meeting_slots`, sem filtro de BU nem de status: CPF (dígitos), telefone pelos **últimos 9 dígitos** (attendee, contato do deal), e-mail exato em minúsculo, nome normalizado e busca parcial por sobrenome.

**RODRIGO MOREIRA ROBERTO** — CPF 38544638805, telefone 983647601, e-mail rodrigomoreira@harplapecas.com:
**nenhuma reunião encontrada por nenhum dos critérios.** Zero linhas. Não existe reunião na agenda para essa pessoa, presa a outro lead ou não.

**ROSANGELA MARIA DOS PASSOS FERREIRA** — CPF 03913842608, telefone 981087575, e-mail rosangelapassos7800@gmail.com:
nenhuma reunião casou por CPF, telefone ou e-mail. Casaram **apenas por sobrenome parcial** (`PASSOS FERREIRA`) duas reuniões que são de **outra pessoa**:

| data | closer | BU do closer | status | agendador | deal | lead | telefone/e-mail do lead | casou por |
|---|---|---|---|---|---|---|---|---|
| 2026-03-10 13:45 | João Pedro Martins Vieira | consorcio | completed | Cleiton Anacleto Lima | aeac4310… | Leandro Passos Ferreira | 62981161850 / leandropassos110@gmail.com | nome (sobrenome) |
| 2026-03-16 13:00 | João Pedro Martins Vieira | consorcio | completed | Ithaline Clara dos Santos | aeac4310… | Leandro Passos Ferreira | 62981161850 / leandropassos110@gmail.com | nome (sobrenome) |

Telefone, e-mail e CPF são diferentes dos da Rosangela. Tratar essas reuniões como dela seria atribuir a venda a uma R1 de outra pessoa — decisão de negócio, não de dado.

## 2) Como essas cotas nasceram — a hipótese do "Adicionar Carta" não se sustenta

Os 11 cadastros dessas duas pessoas (`consorcio_pending_registrations`) têm **`proposal_id` nulo em todos**. O caminho "Adicionar Carta" **sempre** cria uma `consorcio_proposals`, marca `status = 'aceita'` com `aceite_date`, e passa esse `proposal_id` para cada cadastro. Sem proposta nenhuma, esses cadastros não vieram de lá.

O que os dados mostram:

| criado em | origem | quem criou | status | deal vinculado |
|---|---|---|---|---|
| 2026-08-20 19:11:31–32 (7 linhas, mesmo segundo) | `reverter` | Antony Nicolas Gomes Rosa | cota_aberta | a28592fa (Rodrigo) em 6; 1 sem deal |
| 2026-08-21 19:23 (2 linhas) | `collab_diego_oliveira` | Grimaldo de Oliveira Melo Neto | vinculada | 6858e59a (Rosangela) |
| 2026-08-26 12:17 (2 linhas) | `reverter` | Grimaldo de Oliveira Melo Neto | vinculada (vinculada_by Grimaldo) | a28592fa (Rodrigo) |

Ou seja: nasceram por **reversão de etapa / recriação de cadastro** e por lançamento marcado como **collab (Diego Oliveira)** — este último é exatamente a marca de venda por fora do funil.

Única proposta existente entre os deals envolvidos: `7dc08195…`, do deal do **Leandro**, criada por João Pedro em 2026-03-11, status **pendente**, sem `aceite_date`. Não pertence a nenhuma dessas cotas.

Não determinei: a ordem exata de cota → termo (não consultei `consorcio_termos` nem `consortium_cards.created_at` nesta rodada), e o ponto de código que grava `origem = 'reverter'` — não aparece no frontend, é escrito por RPC do banco.

## 3) Classificação

- **A — nunca teve reunião de consórcio: 10 cotas, R$ 1.260.000.** Rodrigo 8 × R$ 120.000 = R$ 960.000; Rosangela 2 × R$ 150.000 = R$ 300.000. Desfecho previsto: **Reconhecer fora do funil**.
- **B — reunião com closer de outra BU: 0 cotas, R$ 0.**
- **C — reunião de consórcio sem agendador: 0 cotas, R$ 0.**

Caso que não cabe limpo em A/B/C: as **2 cotas da Rosangela**. Existe reunião de consórcio, com closer da BU e com agendador (Cleiton e Ithaline), no deal do **Leandro Passos Ferreira** — mesmo sobrenome, outro CPF/telefone/e-mail. Se for a mesma família e a negociação foi conduzida na R1 do Leandro, o desfecho correto é trocar o vínculo para aquele deal e creditar o SDR; se for coincidência de sobrenome, é A. O dado sozinho não decide isso.

## 4) O "Adicionar Carta" é cego por construção

Confirmado: em `src/components/consorcio/AddCartaModal.tsx` não existe **nenhuma** consulta a `meeting_slots` ou `meeting_slot_attendees`. A busca de lead consulta apenas `crm_contacts` e `crm_deals` restritos às origens da BU Consórcio; se nada casa, o fluxo cria contato e deal novos direto no pipeline Efeito Alavanca + Clube. Em nenhum momento a tela olha a agenda nem avisa "esse cliente tem R1 marcada — vincule ao lead da reunião".

Então: a tela deixa lançar por fora sem avisar. Só que, neste caso específico, não foi o "Adicionar Carta" — os cadastros nasceram por reversão e por lançamento collab.
