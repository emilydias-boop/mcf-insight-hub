
# Corrigir Validacao do Campo Fixo no Dialog de Edicao

## Problema Identificado

O campo "Fixo" no dialog `EditIndividualPlanDialog.tsx` esta configurado com `step="100"`, o que significa que o navegador so aceita valores multiplos de 100 (3000, 3100, 3200...).

Porem, o catalogo de cargos do RH possui valores como **R$ 3.150,00** que nao sao multiplos de 100, causando a validacao nativa do HTML5 "valor nao e valido".

### Evidencia

- Catalogo RH: `fixo_valor = 3150.00` para SDR Inside N2
- Campo HTML atual: `step="100"` (valores validos: 3000, 3100, 3200...)
- Resultado: Navegador bloqueia o valor 3150

## Solucao

Alterar o atributo `step` dos campos numericos de "100" para **"1"** ou simplesmente **remover o step** para permitir qualquer valor numerico inteiro.

### Alteracoes no Arquivo

**src/components/fechamento/EditIndividualPlanDialog.tsx**

Linhas a alterar:

| Campo | Linha | De | Para |
|-------|-------|-----|------|
| OTE Total | 141 | `step="100"` | `step="1"` |
| Fixo | 159 | `step="100"` | `step="1"` |
| Variavel | 179 | `step="100"` | `step="1"` |

### Codigo Antes

```jsx
<Input
  id="fixo_valor"
  type="number"
  min="0"
  step="100"  // <-- Problema aqui
  value={formData.fixo_valor}
  ...
/>
```

### Codigo Depois

```jsx
<Input
  id="fixo_valor"
  type="number"
  min="0"
  step="1"  // <-- Permite qualquer valor inteiro
  value={formData.fixo_valor}
  ...
/>
```

## Resultado Esperado

- Usuarios poderao salvar valores como 3150, 2750, etc.
- Compatibilidade total com os valores ja existentes no catalogo RH
- Nenhuma restricao artificial nos valores OTE/Fixo/Variavel

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/fechamento/EditIndividualPlanDialog.tsx` | Alterar step de "100" para "1" em 3 campos |
