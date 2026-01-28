
# Correção: Erro de SelectItem com value vazio

## Problema

O componente `ActiveMetricsTab.tsx` está usando `<SelectItem value="">` para as opções "Todos os cargos" e "Todas" (BU), o que viola uma regra do Radix UI Select:

> "A `<Select.Item />` must have a value prop that is not an empty string."

**Locais do erro:**
- Linha 239: `<SelectItem value="">Todos os cargos</SelectItem>`
- Linha 264: `<SelectItem value="">Todas</SelectItem>`

---

## Solução

Usar um valor especial (como `"all"` ou `"__all__"`) para representar "todos" e ajustar a lógica de verificação:

### Mudanças em `ActiveMetricsTab.tsx`

1. **Alterar os valores dos SelectItem de vazio para um valor especial:**

```tsx
// Antes
<SelectItem value="">Todos os cargos</SelectItem>
<SelectItem value="">Todas</SelectItem>

// Depois
<SelectItem value="__all__">Todos os cargos</SelectItem>
<SelectItem value="__all__">Todas</SelectItem>
```

2. **Ajustar a lógica nos handlers e queries para tratar `"__all__"` como vazio:**

```tsx
// Antes
const { data: savedMetrics } = useFechamentoMetricas(
  anoMes, 
  selectedCargoId || undefined, 
  selectedSquad || undefined
);

// Depois  
const { data: savedMetrics } = useFechamentoMetricas(
  anoMes, 
  selectedCargoId === '__all__' ? undefined : selectedCargoId || undefined, 
  selectedSquad === '__all__' ? undefined : selectedSquad || undefined
);
```

3. **Ajustar valor inicial dos estados:**

```tsx
// Antes
const [selectedCargoId, setSelectedCargoId] = useState<string>('');
const [selectedSquad, setSelectedSquad] = useState<string>('');

// Depois
const [selectedCargoId, setSelectedCargoId] = useState<string>('__all__');
const [selectedSquad, setSelectedSquad] = useState<string>('__all__');
```

4. **Ajustar handleSave para usar null quando for `"__all__"`:**

```tsx
const metricasToSave = localMetrics
  .filter(m => m.ativo)
  .map(m => ({
    ano_mes: anoMes,
    cargo_catalogo_id: selectedCargoId === '__all__' ? null : selectedCargoId,
    squad: selectedSquad === '__all__' ? null : selectedSquad,
    // ...resto
  }));
```

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/fechamento/ActiveMetricsTab.tsx` | Substituir `value=""` por `value="__all__"` e ajustar lógica |

---

## Resultado

| Situação | Antes | Depois |
|----------|-------|--------|
| Select "Todos os cargos" | Erro: value="" inválido | Funciona com value="__all__" |
| Select "Todas" (BU) | Erro: value="" inválido | Funciona com value="__all__" |
| Lógica de filtro | Usa string vazia | Trata "__all__" como undefined |

