

## Fix: Lógica de Outside no Relatório de Análise de Carrinho

### Entendimento

Outside = lead que comprou o contrato (e curso) por conta própria, ANTES de ter a R1 agendada. Mas ele **continua no funil normalmente** — o SDR entra em contato, o closer faz a R1, passa pra R2, etc. Ou seja, o Outside NÃO é motivo para excluir o lead do funil nem para justificar ausência de R2.

### Alterações em `src/hooks/useCarrinhoAnalysisReport.ts`

**1. Fix query de deals (erro 400 atual)**
- Trocar `profiles:owner_id(name)` por `owner:profiles!crm_deals_owner_profile_id_fkey(name)` — corrige KPIs de Classificados e SDR que estão zerados.

**2. Lógica de Outside corrigida (linha 321)**
```
// Antes (errado):
const isOutside = r1?.date ? new Date(tx.sale_date) < new Date(r1.date) : !r1 && !deal;

// Depois (correto):
const isOutside = r1?.date ? new Date(tx.sale_date) < new Date(r1.date) : false;
```
Outside = contrato pago ANTES da R1. Se não tem R1 ainda, NÃO é outside — é lead aguardando andamento.

**3. Gap: Outside NÃO é motivo legítimo**
- Remover "Outside sem R2" da função `classifyGap` como motivo legítimo. Se o lead é Outside e não tem R2, é **falha operacional** (sem agendamento), porque o Outside ainda precisa passar pelo funil completo.
- Na prática: remover a condição `isOutside && !r2Agendada → "Outside sem R2" (legítima)` e deixar cair no caso padrão operacional.

**4. Fix leitura do SDR name**
- Trocar `(d as any).profiles?.name` por `(d as any).owner?.name` para alinhar com a nova query.

### Resultado esperado
- KPIs de Classificados e SDR voltam a funcionar
- Outside marcado apenas quando contrato foi antes da R1
- Leads Outside continuam no funil e são cobrados por R2 como qualquer outro lead
- Gap de Outside sem R2 = falha operacional (não legítima)

