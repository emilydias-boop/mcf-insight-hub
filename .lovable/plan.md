

## Adicionar Filtro de Canal ao Funil Comercial

### O que será feito
Adicionar um seletor de **Canal** ao lado do seletor de período no "Funil Comercial" da Overview, permitindo filtrar os dados do funil por canal de origem do lead (A010, LIVE, ANAMNESE, ANAMNESE-INSTA, BIO-INSTAGRAM, LEAD-FORM, etc.) — usando a mesma lógica de classificação já existente nos relatórios de análise e vendas.

### Como funciona hoje
- O `useClintFunnel` busca todos os `crm_deals` da pipeline (`origin_id`) e conta por `stage_id`
- Não há nenhum filtro por canal/tag — mostra tudo junto
- A classificação de canal já existe na função `classifyDealChannel()` em `useCarrinhoAnalysisReport.ts`

### Implementação

#### 1. Extrair `classifyDealChannel` para utilitário compartilhado
- Mover a função de `useCarrinhoAnalysisReport.ts` para `src/lib/channelClassifier.ts`
- Reexportar nos hooks existentes para não quebrar nada

#### 2. Atualizar `useClintFunnel.ts` — aceitar filtro de canal
- Adicionar parâmetro `channelFilter?: string` ao hook
- Na query, buscar também `tags, custom_fields, data_source, origin:crm_origins(name)` (campos necessários para classificar)
- Após buscar os deals, aplicar `classifyDealChannel()` em cada um e filtrar apenas os que correspondem ao canal selecionado (ou todos se `channelFilter` for vazio)
- Manter o mesmo fluxo de contagem por stage após o filtro

#### 3. Atualizar `FunilDashboard.tsx` — adicionar UI do filtro
- Adicionar state `channelFilter` (string, default `''` = Todos)
- Buscar lista de canais disponíveis dinamicamente dos deals da pipeline (query leve)
- Renderizar `<Select>` ao lado do seletor de período com opções: "Todos os Canais", "A010", "LIVE", "ANAMNESE", "ANAMNESE-INSTA", etc.
- Passar `channelFilter` para `useClintFunnel` e para as queries de KPI
- KPIs também filtram por canal quando selecionado

#### 4. Atualizar queries de KPI no `FunilDashboard`
- Na query de "Novos Leads" e "Stage Distribution", aplicar o mesmo filtro de canal (buscar tags/custom_fields, classificar, filtrar client-side)

### Arquivos
1. `src/lib/channelClassifier.ts` — novo, função extraída
2. `src/hooks/useClintFunnel.ts` — aceitar `channelFilter`
3. `src/hooks/useCarrinhoAnalysisReport.ts` — importar de `channelClassifier`
4. `src/components/crm/FunilDashboard.tsx` — adicionar Select de canal + passar filtro

