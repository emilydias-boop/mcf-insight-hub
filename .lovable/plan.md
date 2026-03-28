

## Refazer Relatório de Análise de Carrinho — Funil Completo A010 → Parceria

### Conceito

O relatório atual ancora nos contratos pagos e rastreia apenas Contrato → R2. O novo relatório mantém o foco nos **contratos pagos na semana do carrinho** mas mostra a jornada completa: de onde o lead veio (A010, classificação, R1) até o desfecho final (R2, status, parceria).

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useCarrinhoAnalysisReport.ts` | Reescrever por completo |
| `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx` | Reescrever por completo |
| `src/lib/dddToUF.ts` | Adicionar função `getClusterFromUF` |

### Estrutura de dados — `useCarrinhoAnalysisReport.ts`

**Âncora**: Contratos pagos (`A000 - Contrato`) na semana do carrinho (qui-qua).

Para cada contrato, buscar retroativamente e prospectivamente:

```text
Dados por lead:
├── A010: hubla_transactions (product_category='a010', mesmo email)
│   └── dataA010, produtoA010
├── Classificação: crm_deals (deal existe para o contact = classificado)
│   └── sdrName (deal.owner ou booked_by da R1)
├── R1: meeting_slot_attendees → meeting_slots (meeting_type='r1')
│   └── dataR1Agendada, dataR1Realizada, closerR1
├── Contrato: hubla_transactions (A000 - Contrato)
│   └── dataContrato, valorContrato
├── R2: meeting_slot_attendees → meeting_slots (meeting_type='r2')
│   └── dataR2, r2Realizada, closerR2, statusR2
├── Parceria: hubla_transactions (product_category='parceria')
│   └── comprouParceria, dataParceria
├── Reembolso: sale_status='refunded'
└── Geo: DDD → UF → Cluster
```

**Interface `LeadCarrinhoCompleto`**:
```typescript
{
  nome, telefone, email, estado, cluster,
  // A010
  dataA010: string | null,
  // Classificação
  classificado: boolean, sdrName: string | null,
  // R1
  r1Agendada: boolean, dataR1: string | null,
  r1Realizada: boolean, closerR1: string | null,
  // Contrato
  dataContrato: string, valorContrato: number,
  // R2
  r2Agendada: boolean, dataR2: string | null,
  r2Realizada: boolean, closerR2: string | null,
  statusR2: string | null, // aprovado, reprovado, próxima semana, etc.
  // Desfecho
  comprouParceria: boolean, dataParceria: string | null,
  reembolso: boolean,
  isOutside: boolean,
  // Gap
  motivoGap: string | null, // motivo de não ter R2
  tipoGap: 'operacional' | 'legitima' | null,
  observacao: string | null,
}
```

**KPIs expandidos**:
```typescript
{
  entradasA010, classificados,
  r1Agendadas, r1Realizadas,
  contratosPagos,
  r2Agendadas, gapContratoR2,
  r2Realizadas,
  aprovados, reprovados, proximaSemana,
  reembolsos, parceriasVendidas
}
```

**Queries (em paralelo onde possível)**:

1. Buscar contratos pagos da semana (âncora) — `hubla_transactions`
2. Com os emails dos contratos:
   - Buscar compras A010 (retroativo, sem filtro de data) — `hubla_transactions`
   - Buscar contacts no CRM — `crm_contacts`
   - Buscar reembolsos — `hubla_transactions`
   - Buscar parcerias — `hubla_transactions`
3. Com os contact_ids:
   - Buscar deals (classificação + SDR via owner) — `crm_deals`
   - Buscar R1 attendees — `meeting_slot_attendees` com `meeting_type='r1'`
   - Buscar R2 attendees — `meeting_slot_attendees` com `meeting_type='r2'`
4. Buscar R2 status options — `r2_status_options`

### UI — `CarrinhoAnalysisReportPanel.tsx`

**Filtros**:
- Período: Semana (Qui-Qua) | Semana 1-4 do mês | Mês | Ano | Personalizado
- Navegação semanal com setas (já existe)

**KPI Cards** (linha superior): 13 cards compactos
- A010 | Classificados | R1 Agendadas | R1 Realizadas | Contratos | R2 Agendadas | Gap C→R2 | R2 Realizadas | Aprovados | Reprovados | Próx. Semana | Reembolsos | Parcerias

**Bloco "Auditoria Contrato → R2"** (Card destacado):
- Contratos pagos na semana
- Com R2 agendada (count + %)
- Sem R2 agendada (count + %)
- Gap operacional
- Mini-tabela de motivos do gap com badge tipo (operacional/legítima)

**Funil Visual** (8 etapas com barras proporcionais):
A010 → Classificação → R1 Agendada → R1 Realizada → Contrato Pago → R2 Agendada → R2 Realizada → Parceria Vendida

**Análise Geográfica**:
- Mapa do Brasil (reutilizar `BrazilMap` existente)
- Adicionar coluna "Cluster" (Alto/Médio/Menor potencial) baseado em UF
- Tabela cruzada: UF × Contratos × R2 Agend. × R2 Real. × Aprovados × Reembolsos × Parcerias

**Tabela Detalhada** (tab única, sem divisão avançaram/perdidos):
Todas as colunas solicitadas, com filtros por: Closer R1, Closer R2, Estado, Cluster, Status R2, Motivo Gap, R2 Agendada (sim/não), Parceria (sim/não).

Export Excel com todas as colunas.

### Clusters regionais — `dddToUF.ts`

```typescript
const UF_CLUSTER: Record<string, string> = {
  'SP': 'Alto', 'RJ': 'Alto', 'MG': 'Alto', 'PR': 'Alto',
  'SC': 'Médio', 'RS': 'Médio', 'DF': 'Médio', 'GO': 'Médio',
  'BA': 'Médio', 'PE': 'Médio', 'CE': 'Médio', 'ES': 'Médio',
  // demais: 'Menor'
};
export function getClusterFromUF(uf: string): string {
  return UF_CLUSTER[uf] || 'Menor';
}
```

### Motivos de gap (Contrato sem R2)

Para leads com contrato pago mas sem R2 agendada, classificar:
- **Reembolso** → legítima
- **Outside sem R2** → legítima
- **Próxima semana** (status R2 = próxima semana) → legítima
- **Sem contato no CRM** → operacional
- **Contato existe mas sem R2** → operacional (falha de agendamento)
- **Sem retorno do lead** → operacional
- **Cadastro incompleto** → operacional (deal sem contact linkado)
- **Outro** → operacional

