

## Problema: Preço novo não aplica nas vendas de hoje

### Diagnóstico

O sistema está funcionando **tecnicamente correto**, mas não da forma que você espera. O problema:

- A venda do Marcio Dyego A001 aconteceu às **16:01 UTC** (13:01 BRT) de hoje
- Você alterou o preço de R$ 14.500 → R$ 16.500 às **21:34 UTC** (18:34 BRT) de hoje
- O `effective_from` do trigger é `NOW()` = o momento exato da alteração
- A função `get_effective_price` compara: `sale_date (16:01) < effective_from (21:34)` → retorna o preço **antigo** (14.500)

Ou seja, como a venda aconteceu **antes** da alteração de preço no mesmo dia, o sistema usa o preço anterior. O trigger grava o horário exato, não o início do dia.

### Solução: Campo "Vigência a partir de" no drawer

Adicionar um campo de data no `ProductConfigDrawer` que permite ao usuário definir **a partir de quando** o novo preço vale. Por padrão, será o início do dia atual (`00:00:00 de hoje`), mas o usuário pode escolher uma data passada (ex: "01/02/2026") para retroagir o preço até aquela data.

### Alterações

**1. Formulário do ProductConfigDrawer**
- Adicionar campo `effective_from` (date picker) que aparece somente quando o preço de referência foi alterado
- Valor padrão: início do dia atual (meia-noite de hoje, timezone São Paulo)
- O campo só aparece se o preço digitado for diferente do preço original do produto

**2. Hook `useUpdateProductConfiguration`**
- Após salvar o `reference_price`, se houve mudança de preço, atualizar o `effective_from` do registro de histórico recém-criado pelo trigger
- Isso é feito com um UPDATE na `product_price_history` logo após o save, ajustando o `effective_from` para a data escolhida pelo usuário

**3. Lógica do trigger (sem mudança)**
- O trigger continua criando o registro com `NOW()` automaticamente
- O frontend faz um UPDATE subsequente no `effective_from` se o usuário escolheu uma data diferente

### Fluxo do usuário

```text
1. Abre drawer do A001
2. Muda preço de 14.500 → 16.500
3. Aparece campo: "Vigência a partir de: [01/02/2026]" (padrão: hoje 00:00)
4. Usuário pode ajustar para qualquer data
5. Clica Salvar
6. Trigger cria histórico → frontend ajusta effective_from para a data escolhida
7. Transações de hoje agora usam 16.500
```

### Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `src/components/admin/ProductConfigDrawer.tsx` | Adicionar date picker de vigência condicional |
| `src/hooks/useProductConfigurations.ts` | Adicionar lógica para atualizar `effective_from` após save |

### Caso do Marcio Dyego (correção imediata)

Além da melhoria no formulário, o `gross_override` da transação do Marcio já está como `16500` (você provavelmente editou manualmente). Portanto a transação dele já mostra o valor correto via override. A mudança sistêmica vai garantir que futuras alterações de preço se apliquem corretamente sem precisar de override manual.

