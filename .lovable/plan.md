
Objetivo: corrigir a divergência restante de 22 vs 23 no detalhe do closer sem mexer em backend/query, porque agora o problema está na classificação exibida no frontend.

Diagnóstico confirmado
- `src/hooks/useCloserDetailData.ts` já foi corrigido e hoje normaliza o status pelo período:
  - pagamento dentro do período => `status: 'contract_paid'`
  - pagamento fora do período => mantém o status original da reunião
- O problema restante está em `src/components/closer/CloserLeadsTable.tsx`, que continua ignorando esse status normalizado e reclassifica a lead com base em `contract_paid_at`:
```ts
const displayStatus = l.contract_paid_at ? 'contract_paid' : l.status;
```
- Isso afeta diretamente:
  - chips de contagem
  - filtro por status
  - badge da linha
  - status exportado no Excel
- Resultado: um lead com `contract_paid_at` histórico fora do período ainda aparece como “Contrato Pago” no front, mesmo que o hook já tenha marcado a linha como “Realizada” para abril.

Implementação
1. Ajustar `src/components/closer/CloserLeadsTable.tsx` para usar `lead.status` como fonte única de verdade.
2. Remover a inferência por `contract_paid_at` nestes pontos:
   - geração de `statuses`
   - `statusCounts`
   - filtro `statusFilter`
   - `handleExport`
   - `getStatusBadge`
3. Manter `contract_paid_at` apenas como dado da lead, sem usá-lo para decidir contagem ou badge.
4. Não alterar `useCloserDetailData`, Supabase nem a aba de Faturamento.

Impacto esperado
- O chip “Contrato Pago” deve cair de 23 para 22.
- O filtro “Contrato Pago” deve listar 22.
- O lead do Luiz Valentin deve continuar na aba, mas com badge “Realizada”.
- O caso do Caio reembolsado continua correto para o Mateus quando o pagamento estiver no período, porque o hook já converte esse caso para `status = 'contract_paid'`.

Validação
- Abrir `/crm/reunioes-equipe/closer/2396c873-a59c-4e07-bcd8-82b6f330b969?preset=month&month=2026-04`
- Confirmar:
  - KPI “Contratos Pagos” = 22
  - chip/filtro “Contrato Pago” = 22
  - Luiz Valentin aparece como “Realizada”
  - exportação Excel traz o mesmo status mostrado na tela
