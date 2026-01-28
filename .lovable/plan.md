

# Correção: Filtrar por BU válida E cargo do catálogo

## Problema Identificado

Mesmo com o filtro de BU em "Todas", aparecem colaboradores que:
- **Não pertencem a nenhuma BU válida** (ex: CEO, TI, departamento null)
- **Não têm cargo do catálogo** (sem valores OTE definidos)

### Colaboradores que aparecem indevidamente:

| Colaborador | Departamento | Cargo | cargo_catalogo_id |
|-------------|--------------|-------|-------------------|
| Claudia Carielo | null | Closer R2 | null? |
| Emily Caroline Dias | null | Outro | null? |
| Emily Segundario | TI | SDR | null? |
| Grimaldo de Oliveira Melo Neto | Diretoria | CEO | null? |
| Jessica Bellini R2 | null | Closer R2 | null? |
| Julio Caetano | null | Closer | null? |
| Matheus Rodrigeus | null | null | null |
| Thaynar Tavares | null | Closer | null? |
| Vinicius Motta Campos | null | null | null |

---

## Solução

Modificar o filtro `filteredEmployees` para aplicar **duas condições sempre**:

1. **BU válida**: O colaborador deve pertencer a uma das BUs mapeadas (Incorporador, Consórcio, Crédito)
2. **Cargo do catálogo**: O colaborador deve ter `cargo_catalogo_id` vinculado

### Código Atual (incorreto)

```tsx
const filteredEmployees = useMemo(() => {
  if (!employees) return [];
  
  return employees.filter(emp => {
    // Filtro por cargo
    if (selectedCargoId !== '__all__' && emp.cargo_catalogo_id !== selectedCargoId) {
      return false;
    }
    
    // Filtro por BU - só aplica quando != '__all__'
    if (selectedBU !== '__all__') {
      const expectedDept = BU_MAPPING[selectedBU];
      if (!expectedDept || emp.departamento !== expectedDept) {
        return false;
      }
    }
    
    return true;
  });
}, [employees, selectedCargoId, selectedBU]);
```

### Código Corrigido

```tsx
// Lista de departamentos válidos (todas as BUs)
const VALID_DEPARTMENTS = Object.values(BU_MAPPING);

const filteredEmployees = useMemo(() => {
  if (!employees) return [];
  
  return employees.filter(emp => {
    // OBRIGATÓRIO: Deve ter cargo do catálogo vinculado
    if (!emp.cargo_catalogo_id) {
      return false;
    }
    
    // OBRIGATÓRIO: Deve pertencer a uma BU válida (sempre, mesmo em "Todas")
    if (!emp.departamento || !VALID_DEPARTMENTS.includes(emp.departamento)) {
      return false;
    }
    
    // Filtro específico por cargo (quando selecionado)
    if (selectedCargoId !== '__all__' && emp.cargo_catalogo_id !== selectedCargoId) {
      return false;
    }
    
    // Filtro específico por BU (quando selecionado)
    if (selectedBU !== '__all__') {
      const expectedDept = BU_MAPPING[selectedBU];
      if (emp.departamento !== expectedDept) {
        return false;
      }
    }
    
    return true;
  });
}, [employees, selectedCargoId, selectedBU]);
```

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/fechamento/PlansOteTab.tsx` | Adicionar filtros obrigatórios de BU válida e cargo catálogo |

---

## Resultado Esperado

| Filtro | Antes | Depois |
|--------|-------|--------|
| BU: Todas, Cargo: Todos | 23 colaboradores (inclui CEO, TI, etc) | ~14 colaboradores (apenas BUs válidas + cargo catálogo) |
| BU: Incorporador | 12 colaboradores | 12 colaboradores (sem mudança) |
| BU: Consórcio | 2 colaboradores | 2 colaboradores (sem mudança) |

### Quem será filtrado:

| Colaborador | Motivo da exclusão |
|-------------|-------------------|
| Claudia Carielo | Departamento null |
| Emily Caroline Dias | Departamento null |
| Emily Segundario | Departamento TI (não é BU) |
| Grimaldo de Oliveira Melo Neto | Departamento Diretoria (não é BU) |
| Jessica Bellini R2 | Departamento null |
| Julio Caetano | Departamento null |
| Matheus Rodrigeus | Departamento null + sem cargo catálogo |
| Thaynar Tavares | Departamento null |
| Vinicius Motta Campos | Departamento null + sem cargo catálogo |

