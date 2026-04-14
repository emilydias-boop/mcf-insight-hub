

## Plano: Corrigir números do relatório Incorporador (3 problemas raiz)

### Diagnóstico

Verifiquei os números diretamente no banco e identifiquei 3 causas raiz:

| Métrica | Relatório atual | Esperado | Causa |
|---------|----------------|----------|-------|
| Contratos | 33 (dedup email) | 38 (41 - 3 recorrências) | Deduplicação por email elimina transações válidas |
| R1 Agendadas | 320 | 293 | Sem filtro de BU — inclui Consórcio (73 extras) |
| R2 Agendadas | 47 | 52 | Período errado (Sáb-Sex) e sem carrinho config (horário de corte) |

Além disso, todas as datas estão em UTC, mas o dashboard usa BRT (UTC-3), causando diferenças de 1 transação nos limites.

### Correções em `supabase/functions/weekly-manager-report/index.ts`

**1. Timezone — aplicar offset BRT em todos os boundaries**

Todas as datas de início/fim precisam de +3h no ISO para representar meia-noite/fim-de-dia BRT:
- `00:00 BRT` = `03:00 UTC`
- `23:59 BRT` = `02:59 UTC do dia seguinte`

**2. Contratos — contar transações, não emails únicos**

Remover a deduplicação por `emailSet`. Contar:
- `totalComRecorrencia` = todos os registros válidos (41)
- `recorrencias` = `installment_number > 1` (3)
- `totalComReembolso` = total - recorrencias (38)
- `reembolsos` = refunded com installment <= 1 (11)
- `liquidos` = totalComReembolso - reembolsos (27)

**3. R1 — filtrar por BU incorporador**

Adicionar JOIN com tabela `closers` e filtro `bu = 'incorporador'` na query de R1 attendees. Isso reduz de 320 para os 293 corretos (que é o que o Fechamento Equipe mostra).

**4. R2 — usar boundaries do carrinho com horário de corte**

Substituir o range fixo Sáb-Sex por:
- Buscar `carrinho_config` da tabela `settings` para a semana atual e anterior
- Calcular: `previousFriday + horario_corte_anterior` → `currentFriday + horario_corte_atual`
- Incluir encaixados via `carrinho_week_start`
- Aplicar offset BRT nos horários de corte

Para a semana 02/04-08/04:
- Config anterior (26/03): corte 18:00 BRT → Fri 27/03 21:00 UTC
- Config atual (02/04): corte 12:00 BRT → Fri 03/04 15:00 UTC
- Resultado: 52 agendadas, 45 realizadas, 35 aprovados, 3 próx. semana, 2 fora ✓

**5. HTML — mostrar breakdown completo de contratos**

Atualizar os cards para mostrar a cadeia completa:
- Card 1: "41 TOTAL" (todas as transações)
- Card 2: "3 RECORRÊNCIAS" (installment > 1)
- Card 3: "38 COM REEMB." (total - recorrências)
- Card 4: "11 REEMBOLSOS" (vermelho)
- Card 5: "27 LÍQUIDOS" (verde)

### Resultado esperado

Números do email passarão a bater exatamente com os dashboards (Fechamento Equipe, Carrinho R2, Vendas).

