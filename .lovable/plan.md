

# Correção: Erro no Select.Item com Value Vazio

## Problema Identificado

No arquivo `src/components/crm/wizard/WizardStepIntegrations.tsx` (linha 174), existe um `SelectItem` com `value=""`:

```tsx
<SelectItem value="">Primeira etapa (padrão)</SelectItem>
```

O Radix UI Select reserva a string vazia para limpar a seleção e mostrar o placeholder, por isso não permite usar `value=""` em um SelectItem.

## Solução

Usar um valor especial como `"__default__"` ou `"first"` ao invés de string vazia, e tratar esse valor no handler `onValueChange`.

## Mudanças Necessárias

**Arquivo:** `src/components/crm/wizard/WizardStepIntegrations.tsx`

### 1. Alterar o value do SelectItem de opção padrão (linha 174):

```typescript
// De:
<SelectItem value="">Primeira etapa (padrão)</SelectItem>

// Para:
<SelectItem value="__default__">Primeira etapa (padrão)</SelectItem>
```

### 2. Ajustar o handler onValueChange (linhas 166-168):

```typescript
// De:
<Select
  value={data.integration.initial_stage_id}
  onValueChange={(value) => updateIntegration({ initial_stage_id: value })}
>

// Para:
<Select
  value={data.integration.initial_stage_id || '__default__'}
  onValueChange={(value) => updateIntegration({ 
    initial_stage_id: value === '__default__' ? '' : value 
  })}
>
```

## Resultado Esperado

Após a correção:
- O Select renderizará corretamente sem erros
- A opção "Primeira etapa (padrão)" funcionará como esperado
- Quando selecionada, o valor armazenado será string vazia (comportamento original mantido)

