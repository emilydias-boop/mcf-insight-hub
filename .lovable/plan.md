# Levantamento: leituras e gravações de stage_change em deal_activities

Levantamento só de leitura, nenhum arquivo do projeto foi alterado. Linha A = linha com UUIDs (manual_activity / contract_paid_trigger). Linha B = linha do gatilho log_deal_stage_change (NOMES + metadata.to_stage_id, source 'trigger').

## Leitores

| # | Arquivo / hook — tela | Como identifica a etapa | Conta ou pega uma? Deduplica? | Filtra source/auto? | Hoje conta em dobro? | Sem a linha A |
|---|---|---|---|---|---|---|
| 1 | useStageMovements — CRM > Movimentações de Estágio (resumo + detalhe) | resolveStage aceita UUID, clint_id ou nome (lower) | Conta: `passagens += 1` por linha; detalhe 1 linha por atividade; leads únicos por contact_id; snapshot pega a mais recente | Não | **Sim**: passagens e linhas do detalhe em dobro (leads únicos ok) | Passagens e detalhe corretos |
| 2 | useBUFunnelComplete — Movimentações / FunilDashboard | Não usa etapa; só coleta deal_ids | Set de deals | Não | Não | Nada muda |
| 3 | useCRMOverviewData — Visão geral CRM (Pipeline Health, Alertas, Ranking) | Compara to_stage com **Sets de UUID** (loss/terminal) | Set distinto por deal (Avançados, Perdidos) | Não | Não em dobro, mas linha B (nome) nunca casa com os UUIDs, então qualquer linha B conta como "Avançado", **mesmo perda/ganho** | Avançados quase não muda (B já conta); Perdidos/terminal deixam de ser vistos nas movimentações automáticas (só a linha A casava) |
| 4 | useSdrMeetings — Minhas Reuniões (SDR) | classifyStage pelo NOME | Pega a primeira "agendada" e a primeira linha (entrada) | Não | Não; A é ignorada (UUID não classifica), mas pode ser escolhida como "primeira entrada" | Primeira entrada passa a ser a B (mesmo horário) |
| 5 | useDealTimeline (useSdrMeetings.ts) — drawers de reunião SDR | to_stage como texto | Lista todas as linhas | Não | **Sim**: evento duplicado, um com UUID como nome | Some o duplicado com UUID |
| 6 | useSdrActivityMetrics — tabela de atividades SDR | Não usa etapa | Conta `stageChanges++` por linha, por user_id | Não | **Provável**, se as duas linhas tiverem user_id de SDR (não confirmado no banco) | Contagem cai para 1 |
| 7 | useLeadFullTimeline / LeadFullTimeline — aba Atividade do painel do negócio | from/to_stage ou metadata.from/to_stage; resolve UUID para nome | Lista todas; dedupe só da "Entrada" sintética (1 min) | Não (metadata só repassada) | **Sim**: duas linhas "Etapa X → Y" | Fica uma só |
| 8 | DealHistory (useDealActivities) — aba antiga, hoje fora do painel | Exibe from/to_stage cru | Lista todas | Não | Sim (uma com UUID em badge) | Fica uma só |
| 9 | weekly-manager-report (edge) — relatório semanal | UUID **ou** nome contendo ANAMNES | Set por deal | Não | Não | Nada muda |
| 10 | sync-sdr-kpis (edge) | to_stage = nome "Reunião 01 Agendada" ou UUID | find da mais recente (limit 100) | Lê metadata.deal_user/contact_email, não source | Não | Nada muda (auto-moves não são R1) |
| 11 | useR2VendasKPIs — Reuniões Equipe / Painel Equipe Consórcio | to_stage = 'Venda realizada' (nome) | Linhas no período (dedupe não verificado) | Não | Não (A ignorada) | Nada muda |
| 12 | useIncorporadorLeadJourney — drawer de transação Incorporador | to_stage ilike R1 Agendada (nome) | Primeira | Lê metadata.owner_email | Não | Nada muda |
| 13 | useContactsEnriched — Contatos | Só activity_type | Pega a mais recente por deal | Não | Não | Nada muda |
| 14 | usePosVendaOverview — Painel Pós-Venda | Só activity_type | Sets por deal | Não | Não | Nada muda |

Nenhum leitor encontrado filtra por metadata.source ou metadata.auto.

## Gravadores (front/edge)

| Arquivo | Tipo | Etapa gravada | metadata |
|---|---|---|---|
| supabase/functions/import-bubble-history | stage_change | to_stage = UUID | source 'bubble_import' |
| supabase/functions/reprocess-failed-webhooks | stage_changed | from/to = texto vindo do webhook | reprocessed: true |

Demais pontos (Kanban, Qualificação, Agenda, calendly, hubla, asaas, webhooks, move-partners, move-outside) têm comentário explícito de que o gatilho grava; não inserem.

## Resumo
- Conta em dobro hoje: #1 (passagens/detalhe), #5, #7, #8 e provavelmente #6.
- Sem a linha A: esses passam a contar 1; único efeito colateral é #3 deixar de marcar "Perdido"/terminal nas movimentações automáticas, porque ele só reconhece UUID (o defeito de comparar nome com UUID já existe hoje para movimentações manuais).
- Não verificado: user_id das linhas A e B no banco (afeta #6) e se #11 deduplica.
