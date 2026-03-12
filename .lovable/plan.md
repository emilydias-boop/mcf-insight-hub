

## Reorganizar tabela de Transações + adicionar Dt A010 e Stage Atual

### O que muda

A tabela "Transações no Período" será reorganizada com nova ordem de colunas e dois novos dados:

**Nova ordem:**
Data Atualização | Cliente | Produto | Canal | SDR | Closer R1 | Closer R2 | Dt A010 | Dt Contrato | Dt Parceria | Bruto | Líquido | Parcela | Stage Atual

**Novos dados:**
1. **Dt A010** — data da primeira compra com `product_category = 'a010'` do cliente (porta de entrada)
2. **Stage Atual** — estágio atual do deal no CRM (ex: "Agendado R1", "Contrato Pago"), obtido via `crm_deals` + `crm_stages`

### Implementação — `src/components/relatorios/SalesReportPanel.tsx`

**1. Nova query: A010 dates (similar às queries de contrato/parceria existentes)**
```typescript
const { data: a010Dates } = useQuery({
  queryKey: ['a010-dates'],
  queryFn: async () => {
    // Busca primeiro sale_date por email onde product_category = 'a010'
    // Retorna Map<email, date>
  },
});
```

**2. Nova query: Stage atual por email**
```typescript
const { data: stageByEmail } = useQuery({
  queryKey: ['deal-stage-by-email'],
  queryFn: async () => {
    // crm_deals JOIN crm_contacts (email) JOIN crm_stages (stage_name, color)
    // Pega o deal mais recente (updated_at desc) por email
    // Retorna Map<email, { stage_name, color }>
  },
});
```

**3. Atualizar `getEnrichedData`** — incluir `dtA010` e `stageAtual` (nome + cor)

**4. Reordenar colunas** no `<TableHeader>` e `<TableBody>`:
- "Data" passa a ser `sale_date` (data da transação / atualização)
- "Cliente" sobe para segunda posição
- "Status" (`sale_status`) é substituído por "Stage Atual" com badge colorida
- Remover coluna "Status" antiga

**5. Atualizar Excel export** — mesma nova ordem e novos campos (Dt A010, Stage Atual)

