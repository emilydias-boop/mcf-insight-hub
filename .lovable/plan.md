

## Plano: Corrigir filtro de Parceria com busca e lista completa de produtos

### Problemas
1. **Opções limitadas à página atual** — `partnerProductOptions` é derivado do `partnerMap` que só contém dados dos 50 contatos da página. Não mostra todos os produtos existentes.
2. **"Qualquer parceria" não filtra corretamente** — Está filtrando client-side sobre `partnerMap` da página, que só detecta parcerias dos emails carregados.
3. **Não é possível digitar/buscar** — O Select não tem campo de busca.

### Solução

**1. Novo hook `useAllPartnerProducts` em `src/hooks/usePartnerProductDetection.ts`**
- Query no Supabase: buscar `DISTINCT product_name` de `hubla_transactions` onde `sale_status = 'completed'`
- Aplicar a mesma lógica de `classifyProduct` (ignorar Contrato/P2/Suplemento, mapear A001→A001 etc.)
- Retornar lista única de labels ordenadas (ex: A001, A009, A010, Anticrise, ACESSO VITALÍCIO, Sócio MCF, etc.)
- Cache longo (5 min staleTime)

**2. Trocar Select por Popover+Command (searchable) em `ContactFilters.tsx`**
- Substituir o `<Select>` de Parceria por um `Popover` com `Command` (cmdk, já instalado) que permite digitar para buscar
- Listar: "Sem filtro", "🤝 Qualquer parceria", e todos os produtos do novo hook
- Ao digitar, filtra a lista de produtos em tempo real

**3. Atualizar `Contatos.tsx`**
- Passar `allPartnerProducts` (do novo hook) como `partnerProductOptions` em vez do `partnerProductOptions` derivado da página
- O filtro `__any__` e filtro por produto específico continuam funcionando client-side com `partnerMap`, que é adequado para a página atual

### Arquivos
- `src/hooks/usePartnerProductDetection.ts` — adicionar `useAllPartnerProducts`
- `src/components/crm/ContactFilters.tsx` — trocar Select de parceria por Command searchable
- `src/pages/crm/Contatos.tsx` — usar novo hook para opções

