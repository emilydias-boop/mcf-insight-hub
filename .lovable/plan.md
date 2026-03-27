

## Relatorio de Analise de Carrinho — Novo tipo de relatorio

### Resumo
Criar um novo relatorio interativo na Central de Relatorios que mostra o aproveitamento real do carrinho ate a R2, com funil visual, KPIs, motivos de perda, analise por estado (inferido por DDD) e tabela detalhada filtravel dos leads perdidos.

### Arquitetura

O relatorio sera 100% frontend — sem migrations. Ele consulta dados existentes em `hubla_transactions`, `meeting_slots`, `meeting_slot_attendees`, `crm_deals`, `crm_contacts` e `r2_status_options`.

### Arquivos a criar/modificar

**1. `src/hooks/useCarrinhoAnalysisReport.ts`** (novo)
Hook principal que recebe um periodo (start/end dates) e retorna:
- Contratos pagos no periodo (A000, incorporador) de `hubla_transactions`
- Para cada email de contrato, buscar se existe R2 agendada, R2 realizada, reembolso, no-show, sem sucesso
- Cruzamento via `customer_email` → `crm_contacts.email` → `crm_deals` → `meeting_slot_attendees`
- Classificacao de motivo de perda para cada lead que nao chegou a R2 realizada
- Inferencia de estado via DDD do telefone (mapa hardcoded de DDD→UF)

Dados retornados:
```typescript
interface CarrinhoAnalysisData {
  kpis: { carrinhoInicio, novosContratos, totalElegivel, comunicados, r2Agendadas, r2Realizadas, perdidos, taxaAproveitamento, taxaPerda }
  funnelSteps: { label, count, pct }[]
  motivosPerda: { motivo, count, pct }[]
  analysisByState: { uf, contratos, carrinho, agendados, realizados, perdidos, taxaPerda }[]
  leadsDetalhados: { nome, telefone, estado, dataCompra, produto, statusAtual, r2Agendada, r2Realizada, motivoPerda, responsavel, ultimaInteracao, diasSemAndamento }[]
}
```

**2. `src/lib/dddToUF.ts`** (novo)
Mapa de DDD para UF brasileiro (11→SP, 21→RJ, etc). Funcao `getUFFromPhone(phone)` que extrai DDD e retorna a UF.

**3. `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`** (novo)
Componente principal com:
- **Seletor de periodo**: semana (qui-qua), mes, ano, personalizado
- **KPI cards**: 9 metricas em grid
- **Funil visual**: barras horizontais decrescentes (carrinho → elegivel → comunicados → agendadas → realizadas)
- **Motivos de perda**: tabela/grafico de barras horizontais
- **Analise por estado**: tabela com UF, metricas e taxa de perda
- **Tabela detalhada de leads perdidos**: com filtros por periodo, estado, motivo, responsavel e status
- **Exportar Excel**: botao para download da tabela detalhada

**4. Modificar `src/components/relatorios/ReportTypeSelector.tsx`**
- Adicionar novo `ReportType`: `'carrinho_analysis'`
- Card: icone `BarChart3` ou `TrendingDown`, titulo "Analise de Carrinho", descricao "Aproveitamento do carrinho ate R2"

**5. Modificar `src/components/relatorios/BUReportCenter.tsx`**
- Importar e renderizar `CarrinhoAnalysisReportPanel` quando `selectedReport === 'carrinho_analysis'`

**6. Modificar `src/pages/bu-incorporador/Relatorios.tsx`**
- Adicionar `'carrinho_analysis'` ao array `availableReports`

### Logica do periodo "semana do carrinho"
Quando o filtro for semana: quinta-feira a quarta-feira seguinte, usando `weekStartsOn: 4` (quinta) no `startOfWeek`. O usuario navega entre semanas com botoes ← →.

### Classificacao de motivos de perda
Para cada lead com contrato pago que NAO tem R2 realizada:
1. Verificar se tem reembolso em `hubla_transactions` (event_type = 'refund') → "Reembolso"
2. Verificar `r2_status_id` no attendee → mapear para nome do status (Desistente, Reprovado, etc.)
3. Verificar se tem R2 agendada mas status = no_show → "No-Show"
4. Verificar se tem attendee com status = sem_sucesso → "Sem Sucesso / Sem Contato"
5. Verificar se tem R2 agendada mas nao realizada → "Agendamento nao realizado"
6. Se tem deal mas nenhuma R2 → "Nao agendado"
7. Se nao tem deal no CRM → "Sem cadastro no CRM"
8. Fallback → "Outros"

### Inferencia de estado por DDD
Extrair os 2 primeiros digitos do telefone (apos +55) e mapear para UF via tabela hardcoded com os 67 DDDs brasileiros.

### Detalhes tecnicos
- Periodo custom com `DatePickerCustom` (ja existe no projeto)
- Funil visual com barras CSS (sem biblioteca de graficos adicional)
- Tabela com `Table` components existentes + filtros com `Select`
- Export Excel com `xlsx` (ja instalado)
- Sem novas tabelas no banco — tudo via queries nos dados existentes

