

## Plano: Agrupar filtro de Parceria em categorias (Anticrise / Incorporador)

### Problema
"Qualquer parceria" mostra todos os contatos com qualquer produto, sem distinção. O usuário precisa filtrar por **categoria**: produtos Anticrise (A003, A004) vs produtos Incorporador (A001, A002, A009) vs outros (A010, etc).

### Alterações

**`src/hooks/usePartnerProductDetection.ts`**
- Adicionar mapeamento de **grupo/categoria** para cada produto:
  - **Incorporador**: A001, A002, A009
  - **Anticrise**: A003 (Anticrise), A004 (Anticrise Básico)
  - **Outros**: A010, e quaisquer produtos não classificados
- Exportar constante `PRODUCT_GROUPS` com essas categorias
- No `classifyProduct`, retornar também o grupo

**`src/components/crm/ContactFilters.tsx`**
- Substituir "🤝 Qualquer parceria" por duas opções de grupo:
  - "🏗️ Incorporador" (filtra A001, A002, A009)
  - "📉 Anticrise" (filtra A003, A004)
- Manter a lista individual de produtos abaixo, separada por grupo
- Manter campo de busca (Command/cmdk)

**`src/pages/crm/Contatos.tsx`**
- Ajustar lógica de filtro: quando `partnerProduct` é `__incorporador__` ou `__anticrise__`, filtrar pelo grupo de produtos correspondente no `partnerMap`

### Resultado
O filtro de parceria terá: Sem filtro → Incorporador → Anticrise → (produtos individuais searchable)

