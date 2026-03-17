

## Exibir dados de `lead_profiles` no Drawer de Negócios

### O que falta

A tabela `lead_profiles` é populada pelo webhook com ~40 campos estruturados (dados pessoais, financeiros, patrimoniais), mas nenhum componente do `DealDetailsDrawer` consulta ou exibe esses dados.

### Implementação

| Arquivo | O que fazer |
|---|---|
| `src/hooks/useLeadProfile.ts` | **Novo** — hook `useLeadProfile(contactId)` que busca `lead_profiles` pelo `contact_id` |
| `src/components/crm/LeadProfileSection.tsx` | **Novo** — componente colapsável que exibe os campos do `lead_profiles` organizados por categoria (Pessoais, Financeiros, Patrimoniais) |
| `src/components/crm/DealDetailsDrawer.tsx` | Adicionar `<LeadProfileSection>` no drawer, logo abaixo do `SdrSummaryBlock` (seção 5), visível quando existem dados |

### Hook `useLeadProfile`

```
useQuery(['lead-profile', contactId], () =>
  supabase.from('lead_profiles').select('*').eq('contact_id', contactId).maybeSingle()
)
```

### Componente `LeadProfileSection`

- Usa `Collapsible` (começa fechado para não poluir)
- Título: "📋 Perfil do Lead" com badge indicando quantidade de campos preenchidos
- Categorias com grid 2 colunas:
  - **Pessoais**: nome_completo, data_nascimento, cpf, estado_civil, profissao, estado, cidade
  - **Financeiros**: renda_mensal, renda_familiar, patrimonio_estimado, faturamento_mensal
  - **Patrimoniais**: possui_imovel, ja_constroi, possui_terreno, valor_terreno
  - **Interesse**: objetivo, como_conheceu, tempo_conhece
- Campos vazios/null não são exibidos
- Valores monetários formatados (R$ X.XXX)
- Datas formatadas (dd/MM/yyyy)

### Posição no Drawer

Entre o `SdrSummaryBlock` e as `Tabs` — acessível mas colapsado por padrão para não sobrecarregar a view.

