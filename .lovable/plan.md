

# Plano: Prazo Editavel com Taxa do Prazo Mais Proximo

## Resumo

Transformar o campo "Prazo (meses)" de um Select fixo (200/220/240) para um Input numerico livre. A taxa de administracao sera obtida do produto conforme o prazo mais proximo (200, 220 ou 240).

## Logica de Selecao de Taxa

Para prazos personalizados, a taxa sera selecionada pelo prazo referencia mais proximo:

| Prazo Digitado | Prazo Referencia | Taxa Usada |
|----------------|------------------|------------|
| 100-209 | 200 | taxa_adm_200 (20%) |
| 210-229 | 220 | taxa_adm_220 (22%) |
| 230+ | 240 | taxa_adm_240 (25%) |

Exemplo pratico para um produto Select:
- 239 meses → usa taxa de 240 (25%)
- 215 meses → usa taxa de 220 (22%)
- 205 meses → usa taxa de 200 (20%)

## Alteracoes Tecnicas

### 1. Arquivo: `src/types/consorcioProdutos.ts`

**Linha 57 - Alterar tipo PrazoParcelas:**

```typescript
// ANTES
export type PrazoParcelas = 200 | 220 | 240;

// DEPOIS
export type PrazoParcelas = number;
```

### 2. Arquivo: `src/lib/consorcioCalculos.ts`

**Linhas 6-17 - Atualizar getTaxaAdm para prazo mais proximo:**

```typescript
// ANTES
export function getTaxaAdm(produto: ConsorcioProduto, prazo: PrazoParcelas): number {
  switch (prazo) {
    case 200:
      return produto.taxa_adm_200 || 20;
    case 220:
      return produto.taxa_adm_220 || 22;
    case 240:
      return produto.taxa_adm_240 || 25;
    default:
      return 25;
  }
}

// DEPOIS
export function getTaxaAdm(produto: ConsorcioProduto, prazo: number): number {
  // Seleciona taxa do prazo referencia mais proximo
  if (prazo < 210) {
    return produto.taxa_adm_200 || 20;
  } else if (prazo < 230) {
    return produto.taxa_adm_220 || 22;
  } else {
    return produto.taxa_adm_240 || 25;
  }
}
```

**Linha 24 - Atualizar assinatura:**

```typescript
// ANTES
prazo: PrazoParcelas,

// DEPOIS
prazo: number,
```

**Linha 102 - Atualizar assinatura:**

```typescript
// ANTES
prazo: PrazoParcelas,

// DEPOIS
prazo: number,
```

### 3. Arquivo: `src/components/consorcio/ConsorcioCardForm.tsx`

**Linha 371 - Remover validacao de prazo fixo:**

```typescript
// ANTES
const prazoValido = [200, 220, 240].includes(prazoMeses) 
  ? prazoMeses as PrazoParcelas : 240;

// DEPOIS
const prazoValido = prazoMeses > 0 ? prazoMeses : 240;
```

**Linhas 937-963 - Trocar Select por Input numerico:**

```tsx
// ANTES
<FormField
  control={form.control}
  name="prazo_meses"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Prazo (meses) *</FormLabel>
      <Select 
        onValueChange={(v) => field.onChange(Number(v))} 
        value={field.value?.toString() || '240'}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o prazo" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {PRAZO_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value.toString()}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>

// DEPOIS
<FormField
  control={form.control}
  name="prazo_meses"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Prazo (meses) *</FormLabel>
      <FormControl>
        <Input 
          type="number" 
          min={1}
          max={300}
          placeholder="Ex: 239"
          value={field.value || ''}
          onChange={(e) => field.onChange(Number(e.target.value) || 240)}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Comportamento Esperado

Para um produto Parcelinha (taxa_adm: 200→20%, 220→22%, 240→25%):

| Prazo | Taxa Adm | Fundo Comum (R$200.000) | Parcela Base |
|-------|----------|-------------------------|--------------|
| 200 | 20% | R$ 1.000,00 | Calculo normal |
| 220 | 22% | R$ 909,09 | Calculo normal |
| 239 | 25% | R$ 836,82 | Calculo com taxa 240 |
| 240 | 25% | R$ 833,33 | Calculo normal |

## Limitacoes

- Valores tabelados oficiais (tabela consorcio_creditos) so existem para 200, 220 e 240 meses
- Para prazos personalizados (ex: 239), sera exibida a mensagem "Calculado" em vez de "Tabela Oficial"
- A formula de calculo permanece a mesma, apenas aceita prazo livre

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/types/consorcioProdutos.ts` | Alterar tipo PrazoParcelas para number |
| `src/lib/consorcioCalculos.ts` | Usar taxa do prazo mais proximo |
| `src/components/consorcio/ConsorcioCardForm.tsx` | Trocar Select por Input |

