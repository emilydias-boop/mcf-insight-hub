

## Adicionar canais do Carrinho Analysis ao Relatório de Vendas

### Problema atual

O relatório de Vendas usa uma classificação simplificada de canal com apenas 3 opções: **A010, BIO, LIVE**. Já o relatório de Análise de Carrinho usa 6 canais normalizados: **A010, LIVE, ANAMNESE, ANAMNESE-INSTA, OUTSIDE, LANÇAMENTO**.

O filtro de canal no relatório de Vendas precisa usar a mesma classificação do Carrinho para permitir análise consistente de receita por canal.

### Solução

Atualizar a função `detectChannel` no `useAcquisitionReport.ts` para usar a mesma lógica de classificação do Carrinho Analysis (`classifyChannel` + `normalizeChannel`), e expandir o dropdown de canal no `SalesReportPanel.tsx`.

### Mudanças

#### 1. `src/hooks/useAcquisitionReport.ts` — Expandir `detectChannel`

Substituir a função simples (3 canais) por uma versão que consulta tags, origem e sale_origin do deal/transação para classificar nos 6 canais padronizados:

- **LANÇAMENTO**: `sale_origin = 'launch'` ou produto contém "contrato mcf"
- **A010**: `product_category = 'a010'` ou `product_name` contém "a010"
- **ANAMNESE-INSTA**: tags do contato contêm "ANAMNESE-INSTA"
- **ANAMNESE**: tags contêm "ANAMNESE"
- **OUTSIDE**: transação com `sale_date < scheduled_at` (já calculado como `isOutside`)
- **LIVE**: fallback para tudo que não se encaixa nas anteriores

Para isso, a função `detectChannel` receberá os dados extras da transação (sale_origin, tags via deal) e o flag `isOutside` já existente no fluxo de classificação.

#### 2. `src/components/relatorios/SalesReportPanel.tsx` — Expandir dropdown

Linhas 856-861: substituir as 3 opções do Select por 6 + "Todos":

```
Todos | A010 | LIVE | ANAMNESE | ANAMNESE-INSTA | OUTSIDE | LANÇAMENTO
```

A lógica de filtro (linhas 468-474) já compara `channel === selectedChannel.toUpperCase()`, então continuará funcionando.

#### 3. Tags do contato — buscar para classificação

O `useAcquisitionReport` precisa ter acesso às tags do contato (via `crm_deals → crm_contacts → tags`) para classificar ANAMNESE vs ANAMNESE-INSTA. Vou adicionar `tags` ao select de deals/contacts já existente no hook, e passar essa informação para o `detectChannel` expandido.

### Resultado

- Dropdown de canal no Vendas terá as 6 categorias do Carrinho
- KPIs e tabela "Faturamento por Closer" filtrarão corretamente por canal
- Excel exportado incluirá o canal normalizado
- Consistência total entre relatórios de Vendas e Análise de Carrinho

### Arquivos alterados
1. `src/hooks/useAcquisitionReport.ts` — expandir `detectChannel` com lógica de 6 canais
2. `src/components/relatorios/SalesReportPanel.tsx` — expandir dropdown de canal

