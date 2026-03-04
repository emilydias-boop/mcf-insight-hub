

## Problema

O campo "Intermediações de Contrato" no formulário de KPIs não exibe a meta, enquanto os outros campos mostram (ex: "Meta: 74 (70% de 105 agendadas)"). O usuário quer que apareça algo como **"Meta: 28 (30% de 93 realizadas)"**.

## Correção

### Arquivo: `src/components/fechamento/DynamicKpiField.tsx`

**1. Adicionar caso 'contratos' em `getMetaDescription`** (linha 170-183):
```typescript
case 'contratos':
  const realizadas = formData.reunioes_realizadas || 0;
  return `Meta: ${Math.round(realizadas * 0.3)} (30% de ${realizadas} realizadas)`;
```

**2. Mostrar `metaDescription` no render do campo 'contratos'** (linhas 86-101):
Atualizar o bloco de renderização read-only para incluir a linha de meta acima do valor, igual aos outros campos. Adicionar `metaDescription` como texto descritivo entre o label e o valor.

### Resultado

O campo "Intermediações de Contrato" exibirá:
```
Intermediações de Contrato  ⚡ Auto
Meta: 28 (30% de 93 realizadas)
26 (calculado da Hubla)
```

Consistente com os demais campos do formulário de KPIs.

