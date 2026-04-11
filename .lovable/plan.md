

# Fix: Valor Bruto incorreto nas parcelas de cobranca

## Problema raiz identificado

Existem **dois bugs** causando valores brutos incorretos:

### Bug 1: Variavel `valorBrutoPerInstallment` nao definida no loop de criacao de parcelas (Edge Function)

Na edge function `sync-billing-from-hubla`, a variavel `valorBrutoPerInstallment` e calculada no **primeiro loop** (criacao de subscriptions, linha 128), mas referenciada no **segundo loop** (criacao de installments, linhas 331 e 358) sem ser recalculada. Isso causa:

- Parcelas 2-12 recebem `valor_original` de outra subscription processada anteriormente
- Exemplo: Delbert Nickerson tem parcela 1 = R$14.500 (correto), mas parcelas 2-12 = R$17.324,28 (valor de OUTRO cliente)
- Resultado: sum(valor_original) = R$205.067 vs valor_total_contrato = R$174.000

Dados confirmados: 15+ subscriptions com divergencia entre `valor_total_contrato` e soma de `valor_original` das parcelas.

### Bug 2: Saldo Devedor mostra R$ 0,00 incorretamente (Detail Drawer)

No `CobrancaDetailDrawer.tsx`, o calculo:
```
saldoDevedor = (totalLiquido > 0 ? totalLiquido : totalBruto) - totalPago
```
Quando so a parcela 1 tem `valor_liquido` preenchido, `totalLiquido = 9.429,69` e `totalPago = 9.429,69`, resultando em saldo = 0. As 11 parcelas pendentes sao ignoradas.

## Correcoes

### 1. Edge Function `sync-billing-from-hubla/index.ts`

No segundo loop (linha 264), adicionar o calculo de `valorBrutoPerInstallment`:

```typescript
// Adicionar apos linha 271 (const valorBruto = ...)
const p2txBruto = txList.find(tx => (tx.installment_number || 1) > 1);
const valorBrutoPerInstallment = p2txBruto
  ? (p2txBruto.product_price || first.product_price || 0)
  : (first.product_price || 0);
```

Tambem corrigir a referencia `valorParcela` (linha 347) que nao esta definida - trocar por `paid.net_value || paid.product_price`.

### 2. `CobrancaDetailDrawer.tsx` - Saldo Devedor

Corrigir o calculo para usar o bruto quando o liquido nao esta disponivel para todas as parcelas:

```typescript
const saldoDevedor = totalBruto - totalPago;
```

Isso garante que o saldo devedor reflita o total bruto menos o que ja foi pago.

### 3. Re-sync para corrigir dados existentes

Apos o deploy da edge function corrigida, sera necessario rodar a sincronizacao novamente para recalcular os `valor_original` de todas as parcelas afetadas. Porem, como a sync so cria parcelas **novas** (verifica `existingNums`), precisaremos tambem atualizar as parcelas existentes. Vou adicionar logica na sync para atualizar `valor_original` de parcelas nao-pagas quando o valor esta incorreto.

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/sync-billing-from-hubla/index.ts` | Adicionar `valorBrutoPerInstallment` no segundo loop + corrigir `valorParcela` + atualizar valor_original de parcelas existentes |
| `src/components/financeiro/cobranca/CobrancaDetailDrawer.tsx` | Corrigir calculo do saldo devedor |

