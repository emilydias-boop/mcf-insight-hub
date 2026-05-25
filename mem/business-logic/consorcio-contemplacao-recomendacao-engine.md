---
name: Consórcio Contemplação Recommendation Engine
description: Motor de 3 camadas (faixas por bem + histórico do grupo + ranking) na aba Contemplação
type: feature
---

Camadas:
1. **Faixas** (`consorcio_faixas_recomendacao`): editáveis por categoria (imovel/auto/moto/servicos). `percentual_lance NULL` = não compensa. Defaults: Imóvel 0–50→25, 51–100→50, >100→null; Auto/Moto/Serv 0–150→25, >150→50.
2. **Histórico** (`consorcio_assembleias_historico` + `consorcio_assembleia_contemplados`): manual. Média das últimas 5 assembleias define vagas. Sem histórico → fallback 2.
3. **Cálculo**: `calcularRecomendacoesPorFaixa()` em `src/lib/contemplacao.ts`. posição ≤ vagas → Alta; ≤ 2·vagas → Média; senão Baixa.

UI: `ContemplationTab` com Select de categoria, `FaixasConfigDialog`, `HistoricoAssembleiaPanel` + `RegistrarAssembleiaModal`. Número aplicado via fallback Embracon por redução de dígitos.
