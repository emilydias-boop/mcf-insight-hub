
# Plano: Fase 2 - Normalizar Cargos com Catálogo

## Objetivo

Substituir o campo de texto-livre "Cargo" por um Select que usa a tabela `cargos_catalogo`, permitindo padronização dos cargos e integração com métricas de fechamento.

## Estado Atual

| Situação | Qtd |
|----------|-----|
| Colaboradores com `cargo_catalogo_id` preenchido | 13 |
| Colaboradores usando texto-livre | 11 |
| Total de cargos no catálogo | ~30 |

## Mudanças Necessárias

### 1. Atualizar Interface Employee

**Arquivo:** `src/types/hr.ts`

Adicionar o campo `cargo_catalogo_id` na interface `Employee`:

```typescript
// Dados profissionais
cargo: string | null;
cargo_catalogo_id: string | null;  // NOVO
departamento: string | null;
```

### 2. Atualizar EmployeeGeneralTab.tsx

**Arquivo:** `src/components/hr/tabs/EmployeeGeneralTab.tsx`

Substituir o Select hardcoded de `CARGO_OPTIONS` por um Select dinâmico que usa `useCargos()`:

```text
┌─────────────────────────────────────────────────┐
│ Cargo / Função                                  │
├─────────────────────────────────────────────────┤
│ [____SDR Inside N1 - Inside Sales_________▼]    │
│                                                 │
│ Cargo Base: SDR                                 │
│ Área: Inside Sales                              │
│ OTE: R$ 3.500,00                                │
└─────────────────────────────────────────────────┘
```

**Comportamento:**
- Ao selecionar um cargo do catálogo:
  - Preenche `cargo_catalogo_id` com o ID
  - Preenche `cargo` com o `cargo_base` (para compatibilidade)
  - Exibe área e valores do catálogo como info adicional
- Opção "Outro" para cargos não catalogados (mantém texto-livre)

### 3. Atualizar EmployeeFormDialog.tsx

**Arquivo:** `src/components/hr/EmployeeFormDialog.tsx`

Mesmo tratamento do GeneralTab - usar `useCargos()` para popular o Select de cargo no formulário de novo colaborador.

### 4. Criar Componente CargoSelect

**Novo arquivo:** `src/components/hr/CargoSelect.tsx`

Componente reutilizável para seleção de cargo:

```typescript
interface CargoSelectProps {
  value: string | null;  // cargo_catalogo_id
  cargoTexto: string | null;  // cargo (texto)
  onChange: (cargoId: string | null, cargoTexto: string | null) => void;
  disabled?: boolean;
}
```

**Features:**
- Agrupa cargos por área (Inside Sales, Consórcio, Crédito, etc.)
- Mostra nível quando aplicável (ex: "SDR Inside N1", "SDR Inside N2")
- Opção "Outro" no final para texto personalizado
- Exibe badge com valores quando cargo selecionado

### 5. Sincronizar Valores do Catálogo

Quando um cargo é selecionado, auto-preencher opcionalmente:

| Campo Employee | Fonte no Catálogo |
|----------------|-------------------|
| `salario_base` | `fixo_valor` |
| `ote_mensal` | `ote_total` |
| `nivel` | `nivel` |

**Comportamento:** Sugerir ao usuário (não sobrescrever automaticamente)

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/types/hr.ts` | Adicionar `cargo_catalogo_id` na interface |
| `src/components/hr/CargoSelect.tsx` | **NOVO** - Componente reutilizável |
| `src/components/hr/tabs/EmployeeGeneralTab.tsx` | Usar CargoSelect |
| `src/components/hr/EmployeeFormDialog.tsx` | Usar CargoSelect |

## Fluxo de Implementação

```text
1. Atualizar tipo Employee
          ↓
2. Criar CargoSelect.tsx
          ↓
3. Integrar no EmployeeGeneralTab
          ↓
4. Integrar no EmployeeFormDialog
          ↓
5. Testar vinculação com fechamento
```

## Benefícios

1. **Padronização:** Todos usam os mesmos nomes de cargo
2. **Integração com Fechamento:** `cargo_catalogo_id` liga ao sistema de métricas
3. **Valores Sugeridos:** Salário e OTE do catálogo como referência
4. **Compatibilidade:** Campo `cargo` texto mantido para relatórios legados
5. **Flexibilidade:** Opção "Outro" para cargos especiais

## Detalhes Técnicos

### CargoSelect - Estrutura do Select Agrupado

```typescript
// Agrupar por área
const cargosByArea = useMemo(() => {
  return cargos?.reduce((acc, cargo) => {
    const area = cargo.area || 'Outros';
    if (!acc[area]) acc[area] = [];
    acc[area].push(cargo);
    return acc;
  }, {} as Record<string, CargoCatalogo[]>) || {};
}, [cargos]);

// Renderização
<SelectContent>
  {Object.entries(cargosByArea).map(([area, cargos]) => (
    <SelectGroup key={area}>
      <SelectLabel>{area}</SelectLabel>
      {cargos.map(cargo => (
        <SelectItem key={cargo.id} value={cargo.id}>
          {cargo.nome_exibicao}
          {cargo.nivel && ` - N${cargo.nivel}`}
        </SelectItem>
      ))}
    </SelectGroup>
  ))}
  <SelectSeparator />
  <SelectItem value="_outro">Outro (texto livre)</SelectItem>
</SelectContent>
```

### Info Card quando cargo selecionado

```typescript
{selectedCargo && (
  <div className="mt-2 p-2 bg-muted rounded text-xs">
    <div className="flex justify-between">
      <span>Base: {selectedCargo.cargo_base}</span>
      <span>Área: {selectedCargo.area}</span>
    </div>
    {selectedCargo.ote_total > 0 && (
      <div className="text-green-600">
        OTE: {formatCurrency(selectedCargo.ote_total)}
      </div>
    )}
  </div>
)}
```
