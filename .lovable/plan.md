
# Plano: Três Melhorias para Atribuição de Vendas e Diagnóstico

## 1. Análise Detalhada do "Sem Closer" com Diagnóstico de Produtos

### Objetivo
Mostrar composição das 194 transações "Sem closer" - quais produtos, quantos, por que não foram atribuídos.

### Implementação
- **Arquivo**: Criar novo componente `src/components/relatorios/UnassignedTransactionsDetailPanel.tsx`
- **Hook existente**: Reutilizar `useUnassignedTransactionsDiagnosis` que já categoriza falhas:
  - `both_missing`: Sem email E sem telefone
  - `missing_email`: Apenas email faltando
  - `missing_phone`: Apenas telefone faltando
  - `no_match`: Tem dados mas não encontra no CRM
- **Dados exibidos**:
  1. **KPI Cards**: Total, por categoria de falha
  2. **Tabela filtrável**: Lista de 194 transações com:
     - Produto (product_name, product_category)
     - Contato (email/telefone disponível)
     - Razão da falha
     - Closer sugerido (se contacto existe no CRM)
- **Integração**: Adicionar drawer/modal ao clicar em "Sem closer" na tabela principal

---

## 2. Categoria Automática de "Renovação" (Renovacao)

### Objetivo
Separar renovações como linha própria, similar a A010 e Vitalício, evitando que fiquem misturadas com parcerias.

### Implementação
- **Arquivo**: `src/components/relatorios/CloserRevenueSummaryTable.tsx`
- **Lógica**: Adicionar nova verificação no `useMemo` entre A010 e Vitalício:
  ```
  if (tx.product_category === 'renovacao') {
    renovacao.count++
    renovacao.gross += gross
    renovacao.net += net
    renovacaoTxs.push(tx)
    continue
  }
  ```
- **UI**: Adicionar ícone 🔄 e cor teal (como padrão de "categoria automática")
- **Ordem na tabela**: Launch → A010 → Renovacao → Vitalício → Closers → Sem closer
- **Observação**: Produto já identificado no `product_configurations` com `product_category = 'renovacao'`, basta interceptar no fluxo

---

## 3. Paginação na Query de Attendees para Evitar Limite de 1000 rows

### Problema
Query `attendees-for-sales-matching` em `SalesReportPanel.tsx` bate no limite padrão de 1000 rows do PostgREST. Para períodos longos (ex: Jan-Feb = 1.484 registros), dados são perdidos.

### Implementação
- **Arquivo**: `src/components/relatorios/SalesReportPanel.tsx`
- **Padrão**: Implementar "batch fetching" similar ao usado em `useCourseCRM` e outros hooks
  1. Detectar quando resultado tem 1000 linhas (indicativo de limite atingido)
  2. Dividir período em lotes (ex: 1 semana por vez) OU usar `.range(0, 1000)` + `.range(1000, 2000)` em sequência
  3. Concatenar resultados de todos os lotes em um único array
- **Código**:
  ```typescript
  // Ao invés de query única:
  const allAttendees: AttendeeMatch[] = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, count } = await query
      .range(offset, offset + pageSize - 1);
    
    if (!data || data.length < pageSize) hasMore = false;
    allAttendees.push(...data);
    offset += pageSize;
  }
  ```
- **Otimização**: Considerar dividir por data ao invés de offset (mais eficiente com índices)

---

## Sequência de Implementação

1. **Renovacao** (mais simples, apenas copiar padrão existente)
2. **Paginação de attendees** (afeta os dados base, fazer antes do diagnóstico)
3. **Diagnóstico "Sem Closer"** (depende dos dados de attendees estarem completos)

## Resultado Esperado

- ✅ Renovações isoladas em linha própria (visibilidade clara)
- ✅ Attendees completos (até 1.500+ registros) carregando sem truncamento
- ✅ Painel de diagnóstico mostrando: 194 "Sem closer" divididos por:
  - Quantos têm email missing (ex: 45)
  - Quantos têm telefone missing (ex: 67)
  - Quantos têm ambos (ex: 28)
  - Quantos têm dados mas sem match (ex: 54)
  - Sugestões de closer para cada

