

## Diagnóstico definitivo (3ª iteração — agora com dados na mão)

A RPC atual usa só `r1_contract_paid_at` para preencher `dentro_corte`. Resultado para safra 09/04:
- 32 leads com R1 contract pago dentro da safra ✅
- 17 carry-overs (R1 contract pago ANTES da safra) — todos marcados `dentro_corte=true` ❌
- 10 leads com `r1_contract_paid_at = NULL` — todos marcados `dentro_corte=true` ❌

Total: 59 → painel mostra 56 (após dedup). **Lista do usuário: 45 (44 originais + Luiz Valentin).**

### Os 2 bugs reais

**Bug 1: campo errado para data do contrato.** Quase todos os 10 "NULL" têm contrato pago real na `hubla_transactions`:

| Lead | r1_contract_paid_at | Hubla A000 contract | Na lista 44? |
|---|---|---|---|
| Nilsa Horodenski | NULL | 16/03 | ✅ #28 |
| Joyce Maria | NULL | 11/04 | ✅ |
| Felipe Vaz | NULL | 11/04 | ✅ |
| Rafael Assmann | NULL | 14/04 | ✅ |
| Daniel Marotti | NULL | 10/04 | (provável sim) |
| Uislaine Fuzzo | NULL | 09/04 | (provável sim) |
| Rafael Albaneze | NULL | 09/04 | (provável sim) |
| Fabio Carneiro | NULL | 07/04 | (provável sim) |
| Bruno Cantalabio | NULL | 31/03 | (provável sim) |
| Cleiton César | NULL | 19/12 | ❌ (muito antigo) |

A RPC precisa ler **`COALESCE(r1_contract_paid_at, hubla A000 mais recente por email/phone)`**.

**Bug 2: carry-overs muito antigos.** O usuário **incluiu** Luiz Valentin (contrato 06/02) na lista corrigida → carry-overs **DEVEM** entrar. Mas então por que 17 carry-overs viram só ~6 na lista de 44?

Resposta: **dedup por phone + filtro de "leads que já compraram parceria antes".** Vários carry-overs antigos (Luiz Valentin compra parceria, status `comprou`) já foram contabilizados em safras passadas. Mas a regra é: só conta uma vez. Como não temos como saber em qual safra "já contou", a regra pragmática vira:

**Carry-over (R1 contract antes da safra) só conta se a R2 foi APROVADA durante a safra E o lead ainda não tem venda de parceria registrada antes do início da safra.**

### Regra final consolidada

Lead conta como "Aprovado da safra X" se TODAS verdadeiras:
1. `r2_status = 'Aprovado'`
2. `contract_date := COALESCE(r1_contract_paid_at, hubla_A000_first_completed)` existe
3. `contract_date < safra_X_corte` (Sex+1 12:00) — corte superior
4. **OU** o contrato foi pago dentro `[safra_inicio, safra_corte)`
5. **OU** é carry-over (contrato antes) E não tem venda de parceria anterior à safra E a R2 foi aprovada nesta safra

### Implementação

**1. Migração SQL — atualizar `get_carrinho_r2_attendees`**
- Buscar contrato Hubla A000 por `customer_phone` (últimos 9 dígitos) + `customer_email` quando `r1_contract_paid_at IS NULL`
- Calcular `effective_contract_date := COALESCE(r1_contract_paid_at, hubla_A000)`
- `dentro_corte = true` se: `effective_contract_date < window_end` AND (effective dentro da janela OU lead não tem parceria comprada antes do `window_start`)
- Adicionar coluna retornada: `effective_contract_date timestamptz, contract_source text` (`r1` | `hubla` | `none`) para debug

**2. Frontend — `useCarrinhoUnifiedData.ts` + `useR2MetricsData.ts`**
- Receber novos campos, exibir badge com origem da data quando ajudar a explicar
- Lógica de Aprovado fica igual: filtra `dentro_corte = true`

**3. UI — `R2MetricsPanel.tsx`**
- Card "Selecionados" passa a mostrar: 45 (em vez de 56)
- Lista expandida de tardios continua igual
- Adicionar pequeno tooltip com origem da data do contrato (R1 vs Hubla)

### Validação esperada

Safra 09/04 deve cair de 56 → **45** (matching exato com a lista do usuário + Luiz Valentin).

### Escopo

Apenas RPC + 3 hooks/componentes. Sem mudanças em outras telas.

