
# Correção: Erro de Select.Item com value vazio

## Problema Identificado

O erro ocorre porque o componente Radix Select não permite que `SelectItem` tenha `value=""`. Na página `/premiacoes/Index.tsx`, há dois locais com este problema:

| Linha | Código Problemático |
|-------|---------------------|
| 94 | `<SelectItem value="">Todas as BUs</SelectItem>` |
| 108 | `<SelectItem value="">Todos os status</SelectItem>` |

---

## Solução

Substituir os valores vazios por um valor especial (ex: `"all"`) e ajustar a lógica de filtragem.

### Alterações no Index.tsx

1. Mudar o estado inicial de `selectedBU` e `selectedStatus` de `''` para `'all'`
2. Mudar os `value` dos SelectItem de `""` para `"all"`
3. Ajustar a chamada do hook `usePremiacoes` para tratar `"all"` como undefined

---

## Detalhes Técnicos

### Antes (com erro)
```typescript
const [selectedBU, setSelectedBU] = useState<string>(activeBU || '');
const [selectedStatus, setSelectedStatus] = useState<string>('');

// ... no JSX
<SelectItem value="">Todas as BUs</SelectItem>
<SelectItem value="">Todos os status</SelectItem>
```

### Depois (corrigido)
```typescript
const [selectedBU, setSelectedBU] = useState<string>(activeBU || 'all');
const [selectedStatus, setSelectedStatus] = useState<string>('all');

// ... no JSX
<SelectItem value="all">Todas as BUs</SelectItem>
<SelectItem value="all">Todos os status</SelectItem>

// Ajuste na chamada do hook
const { data: premiacoes, isLoading } = usePremiacoes(
  selectedBU !== 'all' ? selectedBU : undefined,
  selectedStatus !== 'all' ? selectedStatus : undefined
);
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/premiacoes/Index.tsx` | Trocar valores vazios por "all" e ajustar lógica |
