# Roadmap

- [x] Faturamento Closer/SDR/Canal — carteira separada, ex-SDRs agrupados e P2/Outside conciliados; testes dos três modos e compilação automática OK; navegador com dados simulados confirmou carteira e detalhe. Verificação autenticada indisponível (Supabase externo); sem banco/publicação.

- [x] Abrir documentos da biblioteca em popup no fluxo Pós-venda; 21 testes e compilação automática OK; navegador com dados simulados confirmou popup, recarga e Ir para a tela em computador/celular, sem banco/publicação.

- [x] Academia MCF — aba Atribuir trilhas no Admin RH, trilhas adicionais por nome e todas as fases; 4 testes passaram, compilação OK; atribuição com login real não verificada (Supabase externo sem sessão disponível)

- [x] Inventário do fluxo de qualificação pré-R1 (entregue no plano)
- [x] Criar `src/components/crm/qualification/CreditoQualificationQuestions.ts` (novo, textos exatos)
- [x] Criar `src/components/crm/qualification/CreditoQualificationQuestionnaire.tsx` (novo, mesmo visual do QualificationQuestionnaire)
- [x] Validar: typecheck + build OK; nenhum arquivo existente alterado
- [ ] (próxima mensagem) Integração da qualificação de Crédito no fluxo
- [ ] Venda Consórcio: recompra — regra nova simulada (14 casos mudam, não 1); aguardando decisão do dono antes de aplicar
- [x] BU Pós Venda — Fase 1: BU, menu, pipeline "Relacionamento - Pós venda" (3 etapas), perfil Gerente de Relacionamento, entregáveis obrigatórios, tag HARVEY, discador
- [x] BU Pós Venda — Fase 2: entrada automática pelas vendas pagas A001/A003/A004/A009
- [x] BU Pós Venda — Fase 3: janela Crédito/Consórcio em Viabilidade Concluída
- [x] BU Pós Venda — recebimento próprio da anamnese (pos-venda-anamnese); falta habilitar envio no HARVEY
- [ ] BU Pós Venda — Agenda de Viabilidade 1/2 + gravações (PARADO: ~20 telas listam responsáveis de todas as BUs; aguarda decisão do dono)
- [x] Textos venda direta A003 / A001 (VincularVendaDiretaDialog, AgendaMeetingDrawer, useVendaDiretaR1)
- [x] Relatório de operações 14/10 — retorno jsonb_pretty completo colado (só leitura)
- [x] Agenda R2 — aba Pendentes via RPC r2_pendentes_agendar(): seções Recentes/Antigos, badge só com recentes (só front, sem publicar)

- [x] Relatório diário por BU de 15/10 (só leitura) — Grimaldo
- [x] Relatório de operações 15/10 — retorno jsonb_pretty completo colado (só leitura)
- [ ] Passar o card do Kawer (Pós Venda) da Karen para o William — aguardando nova aprovação

- [x] Leitura relatorio_diario_bu de 16/10, 17/10 e 18/10 (somente leitura)

- [x] Relatório diário por BU de 19/10 (somente leitura)

- [x] Painel do Negócio — etapa 2A: itens 1–10 implementados, players/notas compartilhados; 46 assertions passaram e navegador com dados simulados conferiu filtros, gravação sob demanda, qualificação e resumo IA em desktop/mobile. Compilação automática OK; fluxo autenticado real indisponível (Supabase externo); sem remover abas, banco ou publicação.
- [x] Visão geral CRM: perdas/ganhos por id da etapa; timelines escondem cópia UUID de movimento automático (só visual)
