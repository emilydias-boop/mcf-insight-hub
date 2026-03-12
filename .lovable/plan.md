

## Reformular Cross-BU: Agrupar por Lead com colunas por categoria

### Problema
O relatório atual mostra uma linha por transação, duplicando o nome do lead. O usuário quer **uma linha por lead** com valores agregados separados por tipo de produto (A010, Contrato, Parceria, etc).

### Solução

**Arquivo: `src/components/relatorios/CrossBUReportPanel.tsx`**

1. **Adicionar `product_category`** à query de `hubla_transactions`

2. **Novo modelo de dados agrupado** — ao invés de `CrossBURow` (1 por transação), criar `CrossBULeadRow`:
```typescript
interface CrossBULeadRow {
  nome: string;
  email: string;
  telefone: string;
  grupoCota: string;       // todas as cotas do consórcio
  totalTx: number;         // qtd total de transações
  brutoA010: number;       // soma bruto categoria a010
  brutoContrato: number;   // soma bruto categoria contrato
  brutoParceria: number;   // soma bruto categoria parceria
  brutoOutros: number;     // soma bruto outras categorias
  brutoTotal: number;      // soma de tudo
  liquidoTotal: number;    // soma líquido
  primeiraCompra: string;  // data mais antiga
  ultimaCompra: string;    // data mais recente
}
```

3. **Lógica de agrupamento**: Após o join por nome, agrupar transações por `UPPER(TRIM(customer_name))` e somar valores por `product_category`:
   - `a010` → coluna A010
   - `contrato` → coluna Contrato  
   - `parceria` → coluna Parceria
   - Resto → coluna Outros

4. **Nova tabela com colunas**:
| Cliente | Email | Telefone | Grupo/Cota | Qtd Tx | Bruto A010 | Bruto Contrato | Bruto Parceria | Bruto Outros | Bruto Total | Líquido Total | 1ª Compra | Última Compra |

5. **KPIs atualizados**:
   - Total de Leads (linhas únicas)
   - Total Transações (soma de todas tx)
   - Faturamento Bruto Total
   - Ticket Médio (bruto total / leads)

6. **Ordenação padrão**: por `brutoTotal` desc (quem mais comprou primeiro)

7. **Export Excel**: adaptar para novo formato agrupado

