# Varredura de candidatos — cotas de agosto/2026 sem agendador (só leitura)

Nenhum dado foi alterado. Nenhuma migration, nenhum UPDATE.

## 1) O universo do alerta

Cotas contratadas em agosto/2026 cujo deal vinculado não tem nenhum attendee de closer da BU Consórcio com `booked_by` preenchido e status não cancelado/convidado:

**10 cotas · R$ 1.260.000** — exatamente o que aparece na tela.

- 8 cotas de **RODRIGO MOREIRA ROBERTO** (grupo 7274, cotas 57/140/678/2210/3051/3272/3308/3397, R$ 120.000 cada = R$ 960.000), contratação 20/08/2026, vendedor **André Duarte**, deal atual `a28592fa…` com **0 attendees**.
- 2 cotas de **ROSANGELA MARIA DOS PASSOS FERREIRA** (grupo/cota conforme cadastro, R$ 150.000 cada = R$ 300.000), contratação 10/08/2026, vendedor **Joao Pedro Martins Vieira**, deal atual `6858e59a…` sem reunião de consórcio.

## 2) Candidatos encontrados

Sinal aplicado: attendee de closer da BU Consórcio, `booked_by` preenchido, status não cancelado/convidado, reunião entre 45 dias antes e 7 dias depois da contratação, cliente casando por CPF, telefone (9 dígitos), e-mail ou duas primeiras palavras do nome.

### Rodrigo — 8 cotas, candidato único

| item | valor |
|---|---|
| deal candidato | `5d988c40-a6a0-41b4-93f3-8878d5a8f9e6` — "Consórcio" |
| origem | Efeito Alavanca + Clube |
| estágio | R1 Realizada |
| reunião | 20/08/2026 16:00 |
| closer | Andre dos Santos Duarte (BU consorcio) |
| status attendee | completed |
| quem agendou | **Ithaline Clara dos Santos** |
| nome do attendee | "Rodrigo Moreira" |
| critério | nome (duas primeiras palavras) |
| candidatos | **1** para cada uma das 8 cotas |

Por que o deal atual falha: `a28592fa…` (origem GR) tem zero attendees — nunca houve reunião nele.

### Rosangela — 2 cotas, nenhum candidato

Nenhuma reunião casou por CPF, telefone, e-mail ou nome dentro da janela. As duas correspondências de sobrenome vistas antes são de **Leandro Passos Ferreira**, outra pessoa, outro CPF — e ficaram fora porque não casam pelas duas primeiras palavras do nome.

## 3) Classificação de confiança

- **ALTA** — 8 cotas · R$ 960.000. Casou por nome, o vendedor da cota (André Duarte) é o closer da reunião, a reunião caiu no mesmo dia da contratação (20/08) e o candidato é único. Crédito de agendamento iria para **Ithaline Clara dos Santos**.
- **MÉDIA** — 0 cotas · R$ 0.
- **BAIXA / NENHUM** — 2 cotas · R$ 300.000 (Rosangela). Nenhum SDR seria creditado; permanece decisão de negócio (reconhecer fora do funil ou apontar o lead certo manualmente).

## 4) Fora de agosto — não determinei um número comparável

A mesma consulta fora de agosto devolve 1.570 cotas "sem agendador", mas **1.566 delas não têm nenhum cadastro/deal vinculado** (base histórica anterior ao funil, de 04/2025 a 07/2026) — não são o mesmo padrão e não aparecem no alerta. Só **4 cotas** fora de agosto têm deal vinculado sem reunião de consórcio. O número de 618 cotas / R$ 106 M que a heurística de candidato produz vem quase todo da base histórica sem vínculo e **não deve ser lido como fila de correção**. Dimensionar isso exige antes definir se cota histórica sem cadastro entra ou não no escopo.

## 5) Como a correção é feita hoje

Botão "Trocar lead" → `src/hooks/useCorrigirVinculoCota.ts:334-366` → RPC:

```
consorcio_corrigir_vinculo_cota(
  p_card_id uuid,
  p_deal_id uuid,
  p_registration_id uuid default null,
  p_confirmar_duplicado boolean default false
) returns jsonb
```

`SECURITY DEFINER`, `search_path = public`. O que faz:

- `v_actor := auth.uid()`; se nulo, aborta com "Usuário não autenticado.".
- Exige papel admin, manager, coordenador, sdr, closer ou closer_sombra.
- Valida cota e deal, bloqueio do mês e duplicidade (`p_confirmar_duplicado`).
- Se existe cadastro: `UPDATE consorcio_pending_registrations SET deal_id = p_deal_id, updated_at = now()`.
- Se não existe: insere cadastro completo a partir da cota, com `vinculada_at = now()`, `vinculada_by = v_actor`, `created_by = v_actor`, status `vinculada`, `aceite_date` = data de contratação.
- Grava `audit_logs` com ação `cota_vinculo_impacto`, incluindo cotas e crédito arrastados.
- Retorna `{status, acao, registration_id, outras_cotas, cotas_arrastadas, credito_arrastado}`.

Os campos `deal_vinculo_anterior`, `deal_vinculo_ajustado_por` e `deal_vinculo_ajustado_em` **não** são escritos pela RPC: quem escreve é o trigger `trg_audit_pending_deal_link` (`tg_audit_pending_deal_link`), que também usa `auth.uid()` e registra `pending_deal_link_changed` em `audit_logs`.

### O ponto que decide a aplicação

**Sim: tanto a RPC quanto o trigger usam `auth.uid()`.** Executada por fora de uma sessão autenticada, a RPC nem roda (aborta em "Usuário não autenticado."), e o trigger gravaria autoria nula. Portanto a correção das 8 cotas do Rodrigo tem que sair **do clique do Grimaldo na tela** (ou de uma sessão autenticada dele) para que a autoria fique registrada. Não há caminho de escrita fora da sessão que preserve autoria.

## Próximo passo sugerido (nada executado)

Grimaldo abre o alerta e usa "Trocar lead" em uma das 8 cotas do Rodrigo apontando para `5d988c40-a6a0-41b4-93f3-8878d5a8f9e6`; o arraste por documento cobre as demais. As 2 cotas da Rosangela ficam para decisão dele.
