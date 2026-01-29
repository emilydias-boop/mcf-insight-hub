
# Plano: Corrigir Relatório de Contratos Mostrando Zero Resultados

## Diagnóstico

Após análise, identifiquei que o relatório não está mostrando dados devido a um problema na lógica de permissões:

| Etapa | Comportamento Atual | Problema |
|-------|---------------------|----------|
| 1. `useGestorClosers('r1')` | Para viewer/sem role → retorna `[]` | OK (comportamento correto) |
| 2. `allowedCloserIds` | `closers.map(c => c.id)` → `[]` | **Não diferencia admin/manager** |
| 3. `useContractReport` | Se `allowedCloserIds.length === 0` → `return []` | Bloqueia todos os dados |

**Causa raiz:** A lógica no `ContractReportPanel` depende do array de closers retornado para definir `allowedCloserIds`, mas deveria usar o **role diretamente** para decidir se aplica filtro ou não.

**Fluxo correto:**
- **Admin/Manager**: `allowedCloserIds = null` → vê **todos** os contratos
- **Coordenador**: `allowedCloserIds = [ids dos closers do squad]` → vê apenas contratos do squad
- **Outros roles**: não deveriam nem acessar (RoleGuard bloqueia)

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/relatorios/ContractReportPanel.tsx` | **Modificar** - Ajustar lógica de `allowedCloserIds` |

---

## Alteração

### ContractReportPanel.tsx - Linha ~73

**Código atual (problemático):**
```typescript
const allowedCloserIds = useMemo(() => {
  if (role === 'admin' || role === 'manager') return null;
  return closers.map(c => c.id);  // Se closers = [], retorna []
}, [role, closers]);
```

**Código corrigido:**
```typescript
const allowedCloserIds = useMemo(() => {
  // Admin e manager veem TODOS os closers (null = sem filtro)
  if (role === 'admin' || role === 'manager') return null;
  
  // Coordenador vê apenas closers do squad
  // Se ainda está carregando, retorna undefined para aguardar
  if (loadingClosers) return undefined;
  
  // Se não há closers permitidos (coordenador sem equipe), retorna array vazio
  return closers.map(c => c.id);
}, [role, closers, loadingClosers]);
```

E atualizar o hook para tratar `undefined`:

```typescript
const { data: reportData = [], isLoading: loadingReport } = useContractReport(
  filters, 
  allowedCloserIds === undefined ? null : allowedCloserIds
);
```

**Alternativa mais simples (recomendada):**

Não usar o array de closers para filtrar - confiar apenas no role:

```typescript
const allowedCloserIds = useMemo(() => {
  // Admin e manager veem todos os closers
  if (role === 'admin' || role === 'manager') return null;
  
  // Coordenador: passa os IDs dos closers do squad quando carregados
  // Se lista vazia, query não retornará nada (comportamento correto)
  if (role === 'coordenador') {
    return closers.map(c => c.id);
  }
  
  // Outros roles (não deveriam chegar aqui devido ao RoleGuard)
  return [];
}, [role, closers]);
```

---

## Resultado Esperado

| Role | Comportamento |
|------|---------------|
| Admin | Vê todos os contratos de todos os closers R1 |
| Manager | Vê todos os contratos de todos os closers R1 |
| Coordenador | Vê apenas contratos dos closers do seu squad |
| Viewer/Outros | Bloqueado pelo RoleGuard |

---

## Impacto

- **Admin/Manager**: Relatório funcionará normalmente, mostrando todos os contratos
- **Coordenador**: Continuará vendo apenas seu squad
- **Segurança**: Mantida pelo RoleGuard que bloqueia acesso à página
