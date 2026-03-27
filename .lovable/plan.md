

## Fix: Contagem de Contratos no Relatório de Análise de Carrinho

### Problemas identificados

1. **Recorrências inflando a contagem**: A query não filtra por `installment_number = 1`, então P2, P3, etc. são contadas como novos contratos
2. **Outsides sem R2 agendada contam como perdidos**: Leads que compraram ANTES da R1 (outside) e nunca agendaram R2 estão inflando "perdidos", mas nem todos deveriam estar no funil do carrinho
3. **Leads que fizeram R1 e compraram ali** deveriam fluir naturalmente para R2 — se compraram durante/após R1, a R2 é o próximo passo esperado

### Correções no `src/hooks/useCarrinhoAnalysisReport.ts`

**1. Filtrar apenas primeira parcela**
- Adicionar `.eq('installment_number', 1)` ou filtro client-side `installment_number === 1 || installment_number === null` na query de `hubla_transactions`
- Isso remove recorrências (P2, P3...) da contagem

**2. Detectar outsides**
- Para cada contrato, verificar se o lead tem R1 agendada/realizada
- Buscar `meeting_slot_attendees` com `meeting_type = 'r1'` para os mesmos `contact_id`/email
- Se `sale_date < scheduled_at` da R1 → outside
- Outsides que NÃO agendaram R2 devem ter motivo de perda específico: "Outside sem R2"
- Outsides que agendaram R2 continuam no funil normalmente

**3. Leads que compraram via R1**
- Se `sale_date >= scheduled_at` da R1 (ou não tem R1) → comprou no fluxo normal
- Estes são os leads que DEVEM virar R2 agendada
- Se não viraram, é falha operacional real

**4. Novo campo no LeadDetalhado**
- Adicionar `isOutside: boolean` para sinalizar na tabela
- Adicionar coluna "Outside" na tabela detalhada

### Resultado esperado
- Os 99 devem cair para ~70-80 (removendo recorrências)
- Outsides ficam classificados separadamente
- O funil mostra apenas leads que realmente deveriam ter virado R2

