
# Plano: Integrar Aba "Equipe" do Fechamento com RH (Employees)

## Contexto do Problema

A página de Configurações de Fechamento (`/fechamento-sdr/configuracoes`) possui **duas abas com fontes de dados diferentes**:

| Aba | Fonte de Dados | Problema |
|-----|---------------|----------|
| **Equipe** | Tabela `sdr` (sistema legado) | Mostra pessoas que não são do comercial do Incorporador |
| **Planos OTE** | Tabela `employees` + `cargos_catalogo` | Mostra apenas colaboradores com cargo do catálogo vinculado |

### Dados Encontrados

**Tabela `sdr`** (usada na aba Equipe):
- Claudia Carielo: squad=incorporador, role_type=closer
- Jessica Bellini: squad=incorporador, role_type=closer
- Thobson Motta: squad=incorporador, role_type=closer (mas na verdade é do Consórcio!)

**Tabela `employees`** (usada na aba Planos OTE):
- Claudia Carielo: departamento=NULL, cargo_catalogo_id=NULL
- Jessica Bellini R2: departamento=NULL, cargo_catalogo_id=NULL
- Thobson Motta: departamento=BU - Consórcio, cargo_catalogo_id=NULL
- Thaynar Tavares: departamento=BU - Incorporador 50K, cargo_catalogo_id=NULL

### Problema Central

1. A tabela `sdr` é um sistema **legado/antigo** usado apenas para fechamento SDR
2. A tabela `employees` é o **cadastro oficial de RH** com departamentos e cargos corretos
3. As duas abas mostram dados inconsistentes porque consultam tabelas diferentes
4. Thaynar não aparece em "Planos OTE" porque não tem `cargo_catalogo_id` (não está vinculada a um cargo do catálogo)

---

## Solução Proposta

Migrar a aba "Equipe" para usar a tabela `employees` (RH) como fonte única da verdade, mantendo compatibilidade com o sistema antigo.

### Etapa 1: Atualizar a Aba "Equipe" para usar `employees`

Modificar a aba "Equipe" na página de Configurações para:
1. Buscar dados da tabela `employees` em vez de `sdr`
2. Filtrar por departamentos de BU válidos (igual à aba "Planos OTE")
3. Manter funcionalidade de edição direcionando para o RH

### Etapa 2: Adicionar Filtro de BU na Aba "Equipe"

Adicionar seletor de BU para mostrar apenas colaboradores da BU selecionada (Incorporador, Consórcio, Crédito).

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/fechamento-sdr/Configuracoes.tsx` | Substituir `useSdrsAll()` por `useEmployeesWithCargo()` na aba Equipe; Adicionar filtro de BU |

---

## Detalhes Técnicos

### Antes (código atual):
```typescript
const { data: sdrs, isLoading: sdrsLoading } = useSdrsAll();
// Mostra todos os registros da tabela 'sdr' sem filtro de BU
```

### Depois (proposta):
```typescript
const { data: employees, isLoading: employeesLoading } = useEmployeesWithCargo();

// Filtrar colaboradores ativos que pertencem a uma BU válida
const filteredEmployees = useMemo(() => {
  if (!employees) return [];
  
  return employees.filter(emp => {
    // Apenas BUs comerciais válidas
    const validDepts = ['BU - Incorporador 50K', 'BU - Consórcio', 'BU - Crédito'];
    if (!emp.departamento || !validDepts.includes(emp.departamento)) {
      return false;
    }
    
    // Filtro por BU selecionada (se houver)
    if (selectedBU !== '__all__') {
      const buMapping = {
        'incorporador': 'BU - Incorporador 50K',
        'consorcio': 'BU - Consórcio',
        'credito': 'BU - Crédito',
      };
      if (emp.departamento !== buMapping[selectedBU]) {
        return false;
      }
    }
    
    return true;
  });
}, [employees, selectedBU]);
```

### Mudança na Interface da Tabela

| Antes (tabela `sdr`) | Depois (tabela `employees`) |
|---------------------|---------------------------|
| Nome | Nome Completo |
| Email | Email do Cargo ou Telefone |
| Nível (campo `nivel`) | Nível do cargo do catálogo |
| Status | Status de colaborador (ativo/inativo) |
| Ativo | Status de colaborador |
| Data Criação | Data de Admissão |
| Ações (Editar/Aprovar) | Link para página de RH |

---

## Benefícios da Mudança

1. **Fonte única da verdade**: Dados vêm do RH (employees), não de tabela legada
2. **Filtro por BU**: Cada gerente vê apenas sua equipe
3. **Dados consistentes**: Ambas as abas (Equipe e Planos OTE) mostram os mesmos colaboradores
4. **Menos duplicação**: Não precisa manter cadastros em duas tabelas

---

## Considerações Importantes

### Colaboradores que não aparecem na aba "Planos OTE"

Thaynar Tavares não aparece porque não tem `cargo_catalogo_id`. Para corrigir:
1. Acessar o RH (`/rh`)
2. Editar o cadastro de Thaynar
3. Vincular ao cargo do catálogo correto (ex: "Closer Inside N1")

### Migração de Dados (Opcional)

Se desejar, podemos criar uma ferramenta para sincronizar os dados da tabela `sdr` para `employees`, mas isso é uma tarefa separada de migração de dados.

---

## Resultado Esperado

**Aba Equipe (após mudança)**:
- Mostra apenas colaboradores do RH que pertencem a BUs comerciais
- Thobson, Claudia e Jessica Bellini NÃO aparecem (pois não têm departamento comercial correto no RH)
- Thaynar APARECE (pois está em BU - Incorporador 50K no RH)

**Aba Planos OTE**:
- Mantém comportamento atual
- Thaynar passará a aparecer quando for vinculada a um cargo do catálogo
