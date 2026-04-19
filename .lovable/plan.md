

## Reformular Relatório R2 — corte temporal por DATA DO CONTRATO

### Diagnóstico final (corrigido)

Eu estava errado nas duas tentativas anteriores. A regra real é mais simples e mais física:

**O que define se um Aprovado entra na safra é a DATA DO CONTRATO PAGO, não a data da R2 nem a data em que o status R2 virou "Aprovado".**

### Análise da lista do usuário (44 aprovados — safra Qui 09/04 → Qua 15/04, corte Sex 17/04 12:00)

Olhando os 44 nomes, vejo o padrão exato:

| Bucket | Qtd | Datas de contrato | Regra |
|---|---|---|---|
| **Contratos DENTRO da safra Qui 09 → Qua 15** | 31 | 09/04 a 15/04 | ✅ Entram na safra |
| **Contratos pré-safra (até Qua 08/04)** com R2 que finalmente aprovou aqui | 6 | 06/02, 16/03, 24/03, 31/03, 07/04, 08/04 | ✅ Entram (carry-over para trás de leads que rolaram) |
| **Contratos pós-Quarta (16/04) MAS antes do corte de Sex 17/04 12:00** | 7 | 16/04 (manhã) | ✅ Entram (corte ainda permite) |

**Total: 44.**

O painel mostra **56** porque hoje conta também:
- ~12 leads cujo contrato foi pago **depois** do corte de Sex 17/04 12:00 (já são da próxima safra)
- A regra de filtro é por `r2 scheduled_at` ou `audit_logs do status`, ambas erradas

### Regra correta (definitiva)

Um lead conta como "Aprovado da safra X" se:

```text
contract_paid_at >= safra_X_inicio (Qui 00:00)
  AND
contract_paid_at < safra_X_corte_proxima_sexta (Sex+1 12:00)
  AND
attendee.r2_status = 'Aprovado'
```

Ou seja: a janela é **Qui 00:00 da safra → próxima Sex no horário de corte**, mas aplicada sobre `meeting_slot_attendees.contract_paid_at` (não sobre `scheduled_at` da R2 nem sobre `audit_logs`).

Casos edge cobertos:
- Contrato pago Qui 09/04 + R2 Sex 10/04 11:00 (aprovado): ✅ entra (contract dentro da safra)
- Contrato pago Sex 17/04 11:00 + R2 mesma manhã: ✅ entra (antes do corte 12:00)
- Contrato pago Sex 17/04 13:00: ❌ próxima safra (depois do corte)
- Contrato pago 06/02 + R2 só agora aprovou: ✅ entra (closer recuperou um lead antigo nesta safra — confirmado pela lista)
- R2 realizada sem `r2_status`: card amarelo de alerta (não infla nem deflaciona)

### Implementação

**1. RPC `get_carrinho_r2_attendees`** (Postgres)
- Adicionar parâmetro `p_apply_contract_cutoff boolean` (default false)
- Quando true: filtrar por `meeting_slot_attendees.contract_paid_at` em vez de `scheduled_at`
- Janela: `[p_window_start, p_window_end)` aplicada sobre `contract_paid_at`
- Retornar campo extra `dentro_corte boolean` baseado nessa janela

**2. `src/lib/carrinhoWeekBoundaries.ts`**
- Renomear conceito: `r2Meetings` agora representa a janela do **contrato pago**
- Manter `start = Qui 00:00` e `end = próxima Sex no horário de corte`

**3. `src/hooks/useCarrinhoUnifiedData.ts`**
- Passar `p_apply_contract_cutoff = true` para a RPC
- Tipo `CarrinhoLeadRow` ganha `dentro_corte` e `pendente_status`

**4. `src/hooks/useR2MetricsData.ts`**
- Contar como aprovado apenas rows com `r2_status = Aprovado AND dentro_corte = true`
- Expor `tardios: number` (aprovados com contrato pago após o corte)
- Expor `pendentesStatus: number` (R2 realizada sem status R2)

**5. `src/components/crm/R2MetricsPanel.tsx`**
- Card "Selecionados" com legenda: *"Contratos pagos de Qui DD/MM 00:00 até Sex DD/MM 12:00"*
- Badge `+N tardios` ao lado (toggle "Mostrar tardios" expande lista)
- Card amarelo `⚠️ N R2 sem status` quando `pendentesStatus > 0`

### Validação esperada

Safra **09/04**: painel passa de **56 → 44 Aprovados** — exatamente a lista que o usuário enviou. Os ~12 tardios aparecem em badge, contam na safra **16/04**.

### Escopo

Apenas painel `/crm/agenda-r2 → Relatório`. Email continua intocado (alinhamos depois que validarmos o painel com a próxima safra).

