# Resíduos de atribuição — Consórcio: o que resta depois do "Trocar lead"

## 1) A regra, no código

**Onde o texto nasce:** `src/hooks/useConsorcioCotasContratadas.ts:526-533`, dentro de `diagnosticarCota`:

```
if (!dealTemReuniaoBU.has(dealId)) {
  return { problema: "sem_reuniao_bu",
    motivo: "Lead vinculado, mas sem nenhuma reunião conduzida por closer da BU Consórcio — a venda não passou por R1 desta BU.",
    agendamento: null };
}
```

`dealTemReuniaoBU` é preenchido em `:373-379`: attendees do deal cujo `meeting_slot.closer_id` pertence a um closer com `bu = 'consorcio'` (qualquer status).

**Predicado que tira a cota do alerta** (`:704-705`):

```
const temBookerProprio = !!(dealId && dealBooker.get(dealId));
if (!temBookerProprio) { ...entra no alerta... }
```

`dealBooker` (`:393-424`) só recebe attendees que cumprem, ao mesmo tempo: closer da BU Consórcio, `booked_by IS NOT NULL`, `status NOT IN ('cancelled','invited')` e o `booked_by` tem `email` em `profiles`. Vence o mais recente por `booked_at`/`created_at`.

**Confirmação:** correto. O vínculo cota↔lead, por si só, nunca credita SDR. O crédito vem do `dealBooker` — quem agendou a última reunião de consórcio daquele deal. A atribuição do painel é por **cliente** (`clienteSdr`, `:596-604`): basta uma cota do cliente ter `dealBooker` para todas serem creditadas.

## 2) Os 10 casos de agosto/2026

Só dois clientes, dois deals, e **nenhum dos dois deals tem qualquer attendee** (`meeting_slot_attendees` = 0 linhas).

| Cliente | Grupo/Cota | Crédito | Contratação | Vendedor | deal_id (lead) | Reunião? | Agendador |
|---|---|---|---|---|---|---|---|
| RODRIGO MOREIRA ROBERTO (CPF 38544638805) | 7274/57, 678, 140, 3397, 3308, 3051, 3272, 2210 (8 cotas) | R$ 120.000 cada = R$ 960.000 | 2026-08-20 | André Duarte | `a28592fa…` — "Rodrigo Moreira Roberto", origem **00 - GERENTES DE RELACIONAMENTO**, criado 06/02/2026 | **sem reunião** (0 attendees) | n/a |
| ROSANGELA MARIA DOS PASSOS FERREIRA (CPF 03913842608) | 7272/4549 e 7272/2682 (2 cotas) | R$ 150.000 cada = R$ 300.000 | 2026-08-10 | Joao Pedro Martins Vieira | `6858e59a…` — "Rosângela Maria dos Passos Ferreira - Efeito Alavanca", origem **Efeito Alavanca + Clube**, criado 07/08/2026 | **sem reunião** (0 attendees) | n/a |

Total: 10 cotas · R$ 1.260.000 — bate com a tela.

Trilha do "Trocar lead": 6 das 8 cotas do Rodrigo têm `deal_vinculo_ajustado_em` por Grimaldo (2 em 21/08, 4 em 26/08 12:17), `deal_vinculo_anterior` nulo em todas (antes não havia vínculo). As 2 cotas da Rosângela nunca foram ajustadas — já vinham vinculadas.

## 3) Classificação

- **A — nunca teve reunião de consórcio: 10 cotas · R$ 1.260.000** (os dois clientes). Desfecho previsto: "Reconhecer fora do funil".
- **B — reunião com closer de outra BU: 0 cotas · R$ 0.** Não existe reunião alguma, de nenhuma BU.
- **C — reunião de consórcio sem agendador: 0 cotas · R$ 0.**

**O caso que não cabe redondo em A — Rosângela.** Existe no CRM o deal `aeac4310…` "Leandro Passos Ferreira" (origem Efeito Alavanca + Clube) com duas R1 de consórcio **completed** com o closer João Pedro Martins Vieira, agendadas por Cleiton Anacleto Lima (10/03) e Ithaline Clara dos Santos (16/03), e duas cotas contratadas em março no nome do Leandro (CPF 201.862.868-21). Rosângela é CPF diferente — logo, cliente diferente para a atribuição. Se as cotas de agosto forem do mesmo núcleo familiar/mesma negociação, "Trocar lead" para o deal do Leandro creditaria Ithaline; se são venda nova sem R1 própria, é fora do funil. Não determinei qual é o caso — é decisão de negócio, não de dado.

Rodrigo é A sem ambiguidade: o único deal dele veio da origem GR, criado em fevereiro, sem nenhuma reunião no histórico.

## 4) O que a tela mostra hoje depois do vínculo

Conferido em `src/components/sdr/ResiduoDetalheModal.tsx:296-358`. A prioridade do botão é `permitirForaFunil && i.semSaidaPorVinculo`, e `semSaidaPorVinculo` (hook `:626-630, 708`) é verdadeiro quando **nenhuma** cota do cliente tem lead com reunião de consórcio elegível — exatamente o estado dos 10 casos. Portanto, em cada uma das 10 linhas aparece:

- botão **em destaque**: "Reconhecer fora do funil";
- abaixo, link discreto (ghost): "Trocar lead".

Ou seja, a hierarquia já está invertida a favor do desfecho correto. O que continua ruim é o resto da moldura: o título da caixa ("cotas apontando para o lead sem reunião — alerta de cadastro"), o texto do banner verde/âmbar ("Vínculo salvo, mas o caso continua na lista…") e a coluna "Motivo" seguem falando a língua de "cadastro a ajustar", quando o caso já virou "venda que não passou pelo funil". Os dois estados moram na mesma lista com o mesmo título — é a mistura que o dono percebeu, não o botão.

## Proposta (se quiser que eu implemente depois)

Separar a caixa `semAgendador` em duas, por `semSaidaPorVinculo`:
1. "cotas com reunião a ajustar" — `sem_agendador`, `reuniao_nao_elegivel`, `perfil_sem_email`: ação principal "Informar agendador".
2. "vendas sem R1 de Consórcio" — `sem_reuniao_bu` com `semSaidaPorVinculo`: ação principal "Reconhecer fora do funil", texto dizendo que não há SDR a creditar e que trocar o lead só faz sentido se outro lead do mesmo cliente teve a R1.

E trocar a mensagem pós-ação: quando o vínculo salvo leva a `sem_reuniao_bu` com `semSaidaPorVinculo`, dizer "vínculo salvo — o cadastro está correto; esta venda não passou por R1 de Consórcio, o desfecho é reconhecer fora do funil" em vez do texto atual de pendência.

Só frontend: nenhuma migration, nenhuma função SQL, nenhum UPDATE.
