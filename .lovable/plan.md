

## Diagnóstico: por que o "Funil por Canal" diverge do Painel Comercial

### As duas telas medem coisas diferentes — nenhuma das duas é "BU Incorporador" no sentido estrito

Validei cada número contra o banco para abril/2026:

| Métrica | Funil por Canal (relatório) | Painel Comercial (CRM) | Banco |
|---|---|---|---|
| R1 Agendada | 895 | 774 | — |
| R1 Realizada | 564 | 334 | — |
| No-Show | 296 | 197 | — |
| Contratos | 136 | 112 | — |

### Por que cada tela dá um número diferente

#### 1. **Funil por Canal: NÃO filtra attendees pela BU do deal** ❌

No `useChannelFunnelReport.ts` linhas 154-180, a query `funnel-attendees` busca **TODOS os R1/R2 do banco no período**, sem nenhum filtro de origin/BU. Confirmado em SQL:

- Total de deals únicos R1 abril (todas as BUs): **895** ← bate com a tela
- Apenas deals com `origin_id` da Inc: **685**
- Deals de outras BUs (Consórcio, Marketing, etc.): **210**

Então **210 R1 de outras BUs estão entrando no relatório da Inc**. Isso acontece porque:
- Os attendees são carregados sem filtro de origem
- O hook usa `fullDealChannelMap` para classificar canal, mas se um deal de Consórcio for classificado como "ANAMNESE" ou "OUTROS", ele **entra no funil da Inc** mesmo sem ser da BU.

A coluna **Entradas** está correta (filtra por `origin_id` da Inc → 2615 ✅), mas as colunas R1/R2/No-Show estão **inflando com leads de outras BUs**.

#### 2. **Painel Comercial: filtra por squad do SDR, não por origem do deal**

A RPC `get_sdr_metrics_from_agenda(bu_filter='incorporador')` agrupa por **SDR** e mostra **apenas SDRs cujo `squad='incorporador'` no momento do agendamento** (via `sdr_squad_history`). Além disso:

- Tem cap de 2 movimentos por deal (`LEAST(COUNT(DISTINCT meeting_day), 2)`).
- Filtra `is_partner = false`.
- Não filtra por origem do deal — então um SDR Inc que agendar um R1 num deal de Consórcio também conta aqui.

Por isso os 11 SDRs listados no painel somam **774**, não 685 (origem) nem 895 (todas BUs).

#### 3. **Resumo da causa raiz**

| Tela | Filtra por | Resultado |
|---|---|---|
| Funil por Canal | nada (todos R1 do banco) | 895 — infla com Consórcio/Marketing |
| Painel Comercial | squad do SDR + cap 2 movs | 774 — visão "trabalho do time Inc" |
| BU Incorporador real (origem) | `origin_id` da Inc | 685 — visão "leads que pertencem à Inc" |

**Nenhuma das três é "errada"**, mas a do Funil por Canal está **definitivamente quebrada** porque o nome da tela ("Relatórios da BU Incorporador") implica filtro por BU, e ela não filtra.

### Correção proposta

**Arquivo único: `src/hooks/useChannelFunnelReport.ts`**

1. **Filtrar attendees por origem da BU** na query `funnel-attendees`. Adicionar JOIN com `crm_deals` e `WHERE d.origin_id IN buOriginIds`. Isso vai trazer R1 só dos deals da BU correta.

2. **Aplicar o mesmo filtro na query `funnel-extra-deals`** (já filtra por `id IN (...)`, mas precisa garantir que esses IDs sejam só da BU — o filtro do passo 1 já garante isso indiretamente, mas vou validar).

3. **Manter a regra atual de classificação por canal** — depois do fix, deals de Consórcio sumirão e o funil ficará coerente com a coluna "Entradas".

### Resultado esperado pós-fix (Abril 2026)

| Métrica | Antes | Depois | Bate com |
|---|---|---|---|
| R1 Agendada | 895 | **685** | origens Inc no banco ✅ |
| R1 Realizada | 564 | ~430 | (a recalcular após fix) |
| No-Show | 296 | ~210 | idem |

A tela passa a representar **deals que são da BU Incorporador** (consistente com a coluna Entradas). A diferença que ainda vai existir vs. Painel Comercial (685 vs 774) é **legítima**: o Painel mede "trabalho do time SDR Inc" (incluindo agendamentos que o SDR fez em deals de outras BUs), e o Funil mede "deals da BU Inc" (incluindo R1 agendados por SDRs de outras BUs em leads Inc).

### Vou adicionar uma nota explicativa no header da tabela

Pequeno tooltip: "Métricas filtradas por origem do deal (BU = Inc). Para visão por SDR, ver Painel Comercial."

### Fora do escopo

- Não vou reescrever a RPC `get_sdr_metrics_from_agenda` nem mudar o Painel Comercial.
- Não vou unificar as duas visões (são úteis para perspectivas diferentes).

### Reversibilidade

Mudança em ~10 linhas de 1 arquivo (adicionar JOIN+WHERE na query de attendees). Reverter = remover o filtro.

