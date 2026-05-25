
## Diagnóstico

A tabela de parcelas mostra apenas `consortium_installments.valor_comissao` já persistido. A causa é a função `calcularComissao` em `src/lib/commissionCalculator.ts`:

- **Fallback hardcoded** já respeita o cap: 0% depois da parcela 8 (SELECT) ou 12 (PARCELINHA). OK.
- **Com `comissao_schedule` do produto cadastrado**: usa `schedule.find(parcela === i)` sem cap. Se o cadastro do produto tem entradas para parcelas > 8/12 (ou um valor flat), a comissão é aplicada nas 240 parcelas. Foi o que aconteceu — R$ 550 = 0,11% × R$ 500.000 em toda a vida do contrato.

A regra do negócio (sua planilha) é clara:
- **SELECT** → comissão somente nas parcelas **1 a 8**, total ≈ **5,5%** do crédito
- **PARCELINHA** → comissão somente nas parcelas **1 a 12**, total ≈ **4,46%** do crédito

## Correção

Aplicar o cap de parcelas no `commissionCalculator.ts` independentemente do `schedule` configurado, e propagar o conserto para as parcelas já geradas.

### 1. `src/lib/commissionCalculator.ts`
- Em `getPercentualFromContext`, adicionar guard antes do `find`:
  - `if (tipoProduto === 'select' && numeroParcela > 8) return { percentual: 0, usouCustom: false }`
  - `if (tipoProduto === 'parcelinha' && numeroParcela > 12) return { percentual: 0, usouCustom: false }`
- Isso torna o cap a **fonte da verdade**, mesmo que o cadastro do produto tenha entries extras (defensivo).

### 2. Backfill das cartas existentes
Migration única (apenas UPDATE):

```sql
UPDATE consortium_installments ci
SET valor_comissao = 0
FROM consortium_cards cc
WHERE ci.card_id = cc.id
  AND (
    (cc.tipo_produto = 'select'     AND ci.numero_parcela > 8)
    OR
    (cc.tipo_produto = 'parcelinha' AND ci.numero_parcela > 12)
  )
  AND ci.valor_comissao <> 0;
```

Após o UPDATE, o `valor_comissao_total` (somatório no `useConsorcio.ts`) também volta ao correto sem código adicional.

### 3. Sanitizar o cadastro de produto (opcional, recomendado)
No `Configuracoes`/cadastro de `consorcio_produtos`, validar que `comissao_schedule` não aceita `parcela > 8` para SELECT nem `parcela > 12` para PARCELINHA — evita o problema reaparecer via cadastro errado. (Posso fazer numa segunda etapa se você quiser.)

## Não está no escopo

- A coluna "Valor" da parcela (R$ 1.478,50) não muda — esse cálculo está em `consorcioCalculos.ts` e segue a tabela oficial.
- O `% taxa antecipada` (diferença entre 4,46% e 4,50%) é outro tópico (composição da parcela, não comissão).
