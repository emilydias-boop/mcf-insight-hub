# Roadmap

- [x] Auditoria somente-leitura: ponte 69 x 44 do card "R1 Realizada" (BU Incorporador, set/2026) — diagnóstico registrado em `.lovable/plan.md`.
- [x] Criar edge function `webhook-quiz-mapa` (recebe leads de consultoriamcf.com/quiz-mapa e grava `qualification_answers` no caminho do gatilho de segmento).
- [x] Remover renderização do card "Metas da Equipe" do Painel Comercial do Incorporador (`src/pages/crm/ReunioesEquipe.tsx`), preservando componente, hook e tabelas de metas.
- [x] Ajustar `public.relatorio_diario_bu(date)`: remover linhas `bu='solar'` (15 linhas), ticket consórcio = efetivado/clientes, e nova coluna `agregacao` ('aditivo' | 'nao_somavel').
- [ ] Painel Comercial (/crm/reunioes-equipe): cards mostram A·B·C·Sem ICP; Contratos unificado no eixo SDR + Não atribuído; predicado de realizada (`completed`/`contract_paid`/`refunded`) replicado na edge function `ote-consorcio-metrics`. Taxa de conversão (bruta × líquida) segue pendente de decisão do dono.
- [x] Painel Comercial: acrescentar C e s/ICP na tabela de Closers, preservando A/B/Total e garantindo fechamento por linha e no Total.
- [x] Painel Comercial: Agenda R1 como verdade contada literalmente (sem cap 2/deal, sem else-if de no-show, pendentes contados direto) em useR1CloserMetrics — vale para cards do topo e aba Closers.
- [x] Painel Comercial: atribuição manual de contrato órfão no modal "Contratos não atribuídos" — RPC de leitura `sugerir_vinculo_contrato`, coluna Sugestão com força/critério, escolha de candidato em caso ambíguo, coluna Valor corrigida e rastro em `audit_logs` (`contrato_vinculo_atribuido`). Só preenche vínculo nulo, nunca sobrescreve.
- [x] Agenda/reuniões — Bug 1: troca/gravação de `meeting_slots.closer_id` valida `closers.meeting_type` vs `meeting_slots.meeting_type` (6 pontos + trigger de proteção `trg_validate_slot_closer_meeting_type`); Bug 2 (Opção A): reagendamento mantém registro único com status ativo (`invited`) e `is_reschedule = true`, gatilho de mesmo dia deixa de forçar `rescheduled`.
