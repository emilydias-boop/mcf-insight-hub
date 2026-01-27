
# Plano: Consolidar Transações em Linhas Expansíveis

## Objetivo

Agrupar visualmente as transações de uma mesma compra (produto principal + order bumps) em uma única linha expansível na tela de "Vendas MCF Incorporador", mostrando totais consolidados e permitindo expandir para ver os detalhes de cada item.

## Lógica de Agrupamento

O agrupamento será feito pelo `hubla_id`:
- **Produto Principal**: hubla_id sem sufixo `-offer-`
- **Order Bumps**: hubla_id com sufixo `-offer-1`, `-offer-2`, etc.
- **Base ID**: Remove o sufixo `-offer-X` para agrupar transações relacionadas

### Exemplo Visual

| Antes (Atual) | Depois (Proposto) |
|---------------|-------------------|
| ACESSO VITALÍCIO - R$ 104 (Novo) | ▶ ACESSO VITALÍCIO + 2 bumps |
| ACESSO VITALÍCIO - R$ 57 (dup) | Bruto: R$ 208 / Líquido: R$ 163 |
| Comunidade Incorporador - R$ 47 | |

Ao expandir:

```text
▼ ACESSO VITALÍCIO + 2 bumps (R$ 208 bruto | R$ 163 líquido)
   ├─ ACESSO VITALÍCIO (Principal) - R$ 104 → R$ 81,70
   ├─ ACESSO VITALÍCIO (Bump 1) - R$ 57 → R$ 44,78
   └─ Comunidade Incorporador (Bump 2) - R$ 47 → R$ 36,92
```

## Arquitetura da Solução

### 1. Componente de Linha Expansível

Criar um novo componente `TransactionGroupRow` que:
- Exibe a linha principal com totais consolidados
- Mostra badge "+X order bump(s)" quando houver bumps
- Expande ao clicar para mostrar detalhes de cada transação
- Mantém as ações (Ver, Editar) na linha principal

### 2. Lógica de Agrupamento (Frontend)

Função `groupTransactionsByPurchase`:
- Agrupa por `baseId` (hubla_id sem `-offer-X`)
- Calcula totais de bruto e líquido
- Identifica qual é o produto principal vs order bumps

### 3. Ajuste nos Totais

O cálculo de totais já está correto (soma tudo). A mudança é apenas visual para consolidar a exibição.

## Alterações Técnicas

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/bu-incorporador/TransacoesIncorp.tsx` | Adicionar lógica de agrupamento e componente de linha expansível |

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/incorporador/TransactionGroupRow.tsx` | Componente de linha expansível com produtos agrupados |

## Detalhes de Implementação

### Interface de Dados Agrupados

```typescript
interface TransactionGroup {
  id: string;           // baseId (hubla_id sem -offer-X)
  main: HublaTransaction;
  orderBumps: HublaTransaction[];
  totalGross: number;   // Soma dos brutos
  totalNet: number;     // Soma dos líquidos
  isFirst: boolean;     // Se é primeira compra (para badge Novo/Recorrente)
}
```

### Função de Agrupamento

```typescript
const groupTransactionsByPurchase = (
  transactions: HublaTransaction[],
  firstIds: Set<string>
): TransactionGroup[] => {
  const groups = new Map<string, TransactionGroup>();

  transactions.forEach(tx => {
    const baseId = tx.hubla_id?.replace(/-offer-\d+$/, '') || tx.id;
    const isOrderBump = tx.hubla_id?.includes('-offer-');

    if (!groups.has(baseId)) {
      groups.set(baseId, {
        id: baseId,
        main: tx,
        orderBumps: [],
        totalGross: 0,
        totalNet: 0,
        isFirst: false
      });
    }

    const group = groups.get(baseId)!;

    if (isOrderBump) {
      group.orderBumps.push(tx);
    } else {
      group.main = tx;
      group.isFirst = firstIds.has(tx.id);
    }

    // Soma bruto e líquido
    const isFirst = firstIds.has(tx.id);
    group.totalGross += getDeduplicatedGross(tx, isFirst);
    group.totalNet += tx.net_value || 0;
  });

  return Array.from(groups.values());
};
```

### Componente TransactionGroupRow

O componente renderiza:
1. **Linha Principal** (sempre visível):
   - Data, Produto Principal, Cliente, Parcela
   - Bruto Total, Líquido Total
   - Badge "+X order bump(s)" se houver
   - Badge Novo/Recorrente
   - Ações (Ver, Editar, Excluir)

2. **Linhas Expandidas** (visíveis ao clicar):
   - Cada transação individual com seus valores
   - Indicador visual (├─ ou └─) para hierarquia

## Resultado Esperado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Linhas por compra | 3 linhas separadas | 1 linha consolidada + expandível |
| Visibilidade | Confuso, parece duplicado | Claro, mostra que são itens da mesma compra |
| Totais | Corretos, mas visualmente confusos | Corretos e consolidados visualmente |
| UX | Difícil entender relação entre linhas | Relação clara entre principal e bumps |

## Compatibilidade

- A paginação será por **grupos** (não por transações individuais)
- A exportação CSV mantém o formato atual (uma linha por transação)
- Os filtros continuam funcionando normalmente
- O Drawer de detalhes abre para o produto principal do grupo
