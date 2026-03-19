

## Plano: Corrigir valor_original e valor_total_contrato (líquido nas parcelas 2+)

### Problema

O `valor_original` de todas as parcelas usa `product_price` (bruto), e `valor_total_contrato` = `product_price × total_parcelas`. Mas na Hubla, parcelas 2+ só geram o valor líquido (`net_value`), que é muito menor. Resultado: contratos e saldo devedor inflados (ex: Cléa mostra R$ 174k ao invés do valor real).

Dados reais: 1.034 de 1.189 parcelas 2+ têm `net_value = 0`, e as 155 restantes têm valores bem menores que `product_price`.

### Correção (2 partes)

**Parte 1: SQL (dados existentes)** — Corrigir ~18K parcelas e ~1.644 subscriptions

1. Atualizar `valor_original` das parcelas 2+ para usar o `net_value` da transação Hubla vinculada (ou 0 se não houver transação)
2. Para parcelas pendentes/atrasadas sem transação, usar o `net_value` da parcela 1 do mesmo subscription como referência
3. Recalcular `valor_total_contrato` = parcela1.valor_original + (total_parcelas - 1) × valor_liquido_referencia
4. Recalcular `status_quitacao` e `status`

**Parte 2: Sync function** — Mesma lógica para futuras sincronizações

No `sync-billing-from-hubla/index.ts`:
- Criar `valorLiquido = first.net_value || 0`
- `valorTotal = valorBruto + (totalInstallments - 1) * valorLiquido`
- `valor_original` usa `valorBruto` para parcela 1, `valorLiquido` para demais

### Arquivos

| Arquivo | Ação |
|---------|------|
| SQL via insert tool | Corrigir valor_original + valor_total_contrato + recalcular status |
| `supabase/functions/sync-billing-from-hubla/index.ts` | Lógica bruto/líquido no valor_original e valor_total_contrato |

### Resultado
- valor_original das parcelas 2+ mostrará o líquido real
- valor_total_contrato refletirá bruto + (N-1) × líquido
- KPIs "Saldo Devedor" e "Total Contratado" serão precisos

