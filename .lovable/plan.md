

## Plano: Filtro de parceria + Ação em massa para criar deals em pipeline/stage específica

### Resumo
Adicionar um filtro de "Parceria" nos filtros de contatos que permite selecionar por produto comprado, habilitar seleção múltipla de contatos, e uma ação em massa para criar/duplicar deals em uma pipeline e stage específica de qualquer BU, sem dono atribuído.

### Alterações

**1. Filtro de Parceria no `ContactFilters.tsx`**
- Adicionar campo `partnerProduct` ao `ContactFilterValues`
- Novo Select "Parceria" que lista os produtos detectados (A001, A009, A010, Anticrise, etc.)
- Opção especial "Qualquer parceria" para filtrar todos que são parceiros
- As opções serão derivadas do `partnerMap` passado como prop

**2. Filtro client-side em `Contatos.tsx`**
- Após aplicar os filtros existentes, filtrar por `partnerMap` quando filtro de parceria estiver ativo
- Se "Qualquer parceria" → mostrar todos que têm `isPartner: true`
- Se produto específico → filtrar por `productLabel` ou `productName`

**3. Seleção múltipla de contatos em `Contatos.tsx`**
- State `selectedContactIds: Set<string>`
- Checkbox em cada `ContactCard` (com `e.stopPropagation()` para não abrir o drawer)
- Botão "Selecionar todos filtrados" no header
- `BulkActionsBar` adaptada com botão "Enviar para pipeline..."

**4. Modal `SendToPipelineModal.tsx` (novo componente)**
- Select de BU (consorcio, incorporador, credito, etc.)
- Select de Pipeline/Origin (filtrado pela BU selecionada via `useBUPipelineMap`)
- Select de Stage (filtrado pela origin selecionada via `useCRMStages`)
- Ao confirmar:
  - Para cada contato selecionado, criar um `crm_deal` com:
    - `contact_id` do contato
    - `origin_id` e `stage_id` selecionados
    - `owner_id: null` e `owner_profile_id: null` (sem dono)
    - `name` = nome do contato
    - `tags: []`
    - `clint_id` gerado (prefixo `partner_` + timestamp + random)
  - Verificar duplicata: se já existe deal do contato na mesma origin, pular ou atualizar stage

**5. Arquivos envolvidos**
- `src/components/crm/ContactFilters.tsx` — adicionar filtro parceria
- `src/pages/crm/Contatos.tsx` — seleção múltipla, filtro parceria, ação em massa
- `src/components/crm/ContactCard.tsx` — checkbox de seleção
- `src/components/crm/SendToPipelineModal.tsx` — novo modal de destino
- `src/hooks/useBulkCreateDeals.ts` — novo hook mutation para criar deals em massa

### Fluxo do usuário
1. Filtra por "Parceria: Qualquer" ou produto específico
2. Seleciona os contatos desejados (ou "Selecionar todos")
3. Clica "Enviar para pipeline..."
4. Escolhe BU → Pipeline → Stage
5. Confirma → Deals criados sem dono, visíveis para todos na pipeline de destino

