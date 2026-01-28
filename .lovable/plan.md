
# Simplificar Campos de Qualificação R2

## Resumo das Alterações

| Campo | Estado Atual | Novo Formato |
|-------|--------------|--------------|
| **Profissão** | Select com ~15 opções | Input de texto livre |
| **Tem terreno?** | Select com 4 opções | Select com apenas "Sim" / "Não" |
| **Tem imóvel?** | Select com 3 opções | Select com apenas "Sim" / "Não" |
| **Já constrói?** | Select com 3 opções | Select com apenas "Sim" / "Não" |

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/types/r2Agenda.ts` | Simplificar `TERRENO_OPTIONS`, `IMOVEL_OPTIONS` e `JA_CONSTROI_OPTIONS` |
| `src/components/crm/r2-drawer/R2QualificationTab.tsx` | Trocar Profissão de Select para Input |

---

## Detalhes Técnicos

### 1. Alterações em `src/types/r2Agenda.ts`

**Antes:**
```typescript
export const JA_CONSTROI_OPTIONS = [
  { value: 'sim', label: 'Sim, já construiu' },
  { value: 'nao', label: 'Não' },
  { value: 'pretende', label: 'Pretende começar' },
];

export const TERRENO_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao_pretende', label: 'Não, mas pretende comprar' },
  { value: 'nao', label: 'Não e não pretende' },
  { value: 'nao_informou', label: 'Não informou' },
];

export const IMOVEL_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
  { value: 'nao_informou', label: 'Não informou' },
];
```

**Depois:**
```typescript
export const JA_CONSTROI_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];

export const TERRENO_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];

export const IMOVEL_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];
```

### 2. Alterações em `R2QualificationTab.tsx`

Trocar o campo **Profissão** de `Select` para `Input`:

**Antes:**
```tsx
<Select
  value={localProfissao}
  onValueChange={(v) => handleFieldUpdate('profissao', v, setLocalProfissao)}
>
  <SelectTrigger>
    <SelectValue placeholder="Selecione" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="__none__">— Não informado —</SelectItem>
    {PROFISSAO_OPTIONS.map(opt => (
      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Depois:**
```tsx
<Input
  value={localProfissao}
  onChange={(e) => setLocalProfissao(e.target.value)}
  onBlur={handleProfissaoBlur}
  placeholder="Ex: Engenheiro, Advogado..."
/>
```

Adicionar handler para salvar no blur:
```typescript
const handleProfissaoBlur = () => {
  if (!dealId || localProfissao === (customFields.profissao || '')) return;
  
  updateCustomFields.mutate({
    dealId,
    customFields: { profissao: localProfissao || null }
  });
};
```

---

## Resultado Visual Esperado

```text
+---------------------------+---------------------------+
| 👤 Profissão              | 📍 Estado                 |
| [________________]        | [Dropdown: AM, SP...]     |
+---------------------------+---------------------------+
| 💰 Renda                  | 🎂 Idade                  |
| [Dropdown: faixas]        | [40]                      |
+---------------------------+---------------------------+
| 🏗️ Já constrói?           | 🏡 Tem terreno?           |
| [Sim ▼] [Não]             | [Sim ▼] [Não]             |
+---------------------------+---------------------------+
| 🏠 Tem imóvel?            | ⏱️ Conhece MCF?           |
| [Sim ▼] [Não]             | [Dropdown: tempo]         |
+---------------------------+---------------------------+
```

---

## Compatibilidade

Os valores antigos continuarão funcionando:
- Se um lead tinha "Sim, já construiu" no campo `ja_constroi`, ele mostrará normalmente
- As novas seleções salvarão apenas "sim" ou "nao"
- O campo profissão texto livre aceita qualquer valor existente

