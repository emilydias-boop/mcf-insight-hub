# Roadmap

- [x] Auditoria somente-leitura: ponte 69 x 44 do card "R1 Realizada" (BU Incorporador, set/2026) — diagnóstico registrado em `.lovable/plan.md`.
- [x] Criar edge function `webhook-quiz-mapa` (recebe leads de consultoriamcf.com/quiz-mapa e grava `qualification_answers` no caminho do gatilho de segmento).
- [x] Remover renderização do card "Metas da Equipe" do Painel Comercial do Incorporador (`src/pages/crm/ReunioesEquipe.tsx`), preservando componente, hook e tabelas de metas.
- [x] Ajustar `public.relatorio_diario_bu(date)`: remover linhas `bu='solar'` (15 linhas), ticket consórcio = efetivado/clientes, e nova coluna `agregacao` ('aditivo' | 'nao_somavel').
