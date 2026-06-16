# QA — Drill-down de ligações por lead no Painel de Atividades por SDR

## 1. Metadados
- Data: 2026-06-16
- Autor da feature: thobson.motta@minhacasafinanciada.com
- Áreas afetadas: BU Incorporador MCF, BU Consórcio — Painel da Equipe → "Atividades por SDR"
- Tipo: Feature (drill-down + export)

## 2. Contexto
Hoje a tabela "Atividades por SDR" mostra ligações classificadas por duração (ring drop, caixa postal, efetiva, qualificada), mas não permite saber se 200 ligações foram para 200 leads diferentes ou para apenas 4 leads (50 tentativas cada). Essa visão é necessária para identificar padrões de viés (insistência excessiva no mesmo número, falta de cobertura da base, etc.).

## 3. Escopo
- Agrupar as ligações outbound de cada SDR pelo telefone do destinatário (`calls.to_number`, normalizado pelos 9 últimos dígitos).
- Para cada lead/telefone, mostrar tentativas totais e quebra por classificação (não atendida, ring drop, caixa postal, efetiva, qualificada), tempo total e última tentativa.
- Exportar o relatório por SDR em CSV (UTF-8 com BOM, separador `;`).
- Disponível em ambas as BUs (Incorporador e Consórcio) sem mudar a tela base.

## 4. Arquivos / Rotas
- `src/hooks/useSdrCallsByLead.ts` (novo) — hook + helper de export CSV.
- `src/components/sdr/SdrLeadCallsDialog.tsx` (novo) — modal de drill-down.
- `src/components/sdr/SdrActivityMetricsTable.tsx` — nova coluna "Detalhes" com botão por SDR.
- `src/hooks/useSdrActivityMetrics.ts` — agora expõe `sdrUserId` em cada linha.
- Rotas: `/incorporador/painel-equipe`, `/consorcio/painel-equipe`.

## 5. Critérios de Aceite
1. Para cada SDR listado na tabela, existe um botão "Detalhes" (ícone `ListTree`) na nova coluna.
2. O botão fica desabilitado quando o SDR não tem `user_id` mapeado ou possui 0 ligações no período.
3. O modal abre carregando apenas as ligações daquele SDR no período/filtro vigente.
4. A listagem é agrupada por telefone normalizado (9 últimos dígitos); ligações sem telefone caem em grupos por `deal_id`.
5. Cada linha apresenta: nome do lead (via `crm_deals.name`), telefone, tentativas, não atendidas, ring drop, caixa postal, efetivas, qualificadas, tempo total, última ligação.
6. A linha de totais soma corretamente todas as colunas exibidas.
7. A exportação gera um CSV `ligacoes-por-lead_<SDR>_<inicio>_<fim>.csv` com todas as colunas + Deal ID + primeira ligação.

## 6. Roadmap de Testes
### Funcionais
- F1: Abrir o modal para um SDR com >0 ligações e validar que `Σ tentativas = totalCalls` da tabela.
- F2: Confirmar agrupamento — dois `to_number` com mesmo final de 9 dígitos viram um único lead.
- F3: Lead com `deal_id` válido exibe o nome vindo de `crm_deals.name`.
- F4: Lead sem `deal_id` aparece como "(sem nome)" e ainda é agrupado pelo telefone.
- F5: CSV abre corretamente em Excel (separador `;`, acentos preservados via BOM).

### Edge cases
- E1: SDR sem ligações no período → botão desabilitado, modal nunca abre.
- E2: Ligação com `to_number` nulo cai em grupo `__deal:<id>` (não some).
- E3: Período de 1 dia vs. mês completo — paginação >1000 funciona.
- E4: SDR com `sdr.email` válido mas sem `profiles.id` correspondente → `sdrUserId = null`, botão desabilitado.
- E5: Telefones internacionais (com DDI) — comparados pelos 9 últimos dígitos.

### Regressão
- R1: Totais por SDR na tabela principal continuam batendo com o período anterior.
- R2: Coluna "Lig/Lead" não foi afetada.
- R3: Configuração de faixas (CallThresholdsConfig) ainda altera as colunas e o drill-down de forma consistente.

### RLS / Permissões
- P1: Usuário sem permissão de leitura em `calls` recebe lista vazia (sem erro 500).
- P2: Liderança vê drill-down de qualquer SDR do squad.
- P3: SDR não pode acessar drill-down de outro SDR via UI (tabela já é restrita por papel).

### UI/UX
- U1: Modal não ultrapassa 85vh; tabela rola dentro do dialog.
- U2: Botão "Exportar CSV" fica desabilitado quando não há linhas.
- U3: Tooltip explica a finalidade do botão na coluna Detalhes.
- U4: Cores das classificações batem com a tabela principal (ring drop âmbar, efetiva azul, qualificada verde).

## 7. Riscos / Rollback
- Volume alto de ligações por SDR pode aumentar tempo de abertura do modal (paginação 1000). Mitigação: query lazy (`enabled: open`), cache 2 min.
- Rollback: remover a coluna "Detalhes" e o dialog; hook e helpers são isolados e podem ser deletados sem impacto na tabela base.

## 8. Checklist final
- [ ] F1–F5 executados em Incorporador e Consórcio.
- [ ] Export CSV validado em Excel + LibreOffice.
- [ ] Spot-check com 1 SDR top + 1 SDR baixo volume.
- [ ] Confirmar que QA Docs Viewer (`/admin/documentacao-qa`) lista este arquivo.