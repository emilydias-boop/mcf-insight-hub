
# Plano: Liberar CRM Negócios para Todas as Roles com Filtro por BU

## Objetivo

Permitir que **todos os usuários** acessem a aba Negócios, mas cada usuário verá apenas as pipelines associadas à sua Business Unit (BU).

| BU | Pipelines/Origens Visíveis |
|----|-----------------------------|
| **incorporador** | PIPELINE INSIDE SALES (Perpétuo - X1) |
| **consorcio** | PIPELINE - INSIDE SALES - VIVER DE ALUGUEL, Perpétuo - Construa para Alugar |
| **credito** | A definir (padrão: PIPELINE INSIDE SALES) |
| **projetos** | A definir (padrão: PIPELINE INSIDE SALES) |

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Negocios.tsx                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Buscar BU do usuário (useMyBU)                              │
│  2. Obter pipelines permitidas para essa BU (BU_PIPELINE_MAP)   │
│  3. Selecionar automaticamente a primeira pipeline da BU        │
│  4. Filtrar sidebar para mostrar apenas origens permitidas      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mudanças Necessárias

### 1. NegociosAccessGuard.tsx

**Antes:** Acesso restrito a `['admin', 'manager', 'coordenador', 'sdr']`

**Depois:** Acesso liberado para TODAS as roles, pois o filtro será baseado na BU

| Arquivo | Alteração |
|---------|-----------|
| `NegociosAccessGuard.tsx` | Remover restrição de roles, criar mapeamento BU → Pipelines |

**Novo código:**
```typescript
// Mapeamento BU → Pipelines/Origens permitidas
export const BU_PIPELINE_MAP: Record<string, string[]> = {
  incorporador: ['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'], // PIPELINE INSIDE SALES
  consorcio: [
    '4e2b810a-6782-4ce9-9c0d-10d04c018636', // PIPELINE - INSIDE SALES - VIVER DE ALUGUEL
    'b98e3746-d727-445b-b878-fc5742b6e6b8', // Perpétuo - Construa para Alugar (grupo)
  ],
  credito: ['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'], // Padrão
  projetos: ['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'], // Padrão
};

// Grupo padrão para cada BU (para selecionar ao abrir)
export const BU_DEFAULT_GROUP_MAP: Record<string, string> = {
  incorporador: 'a6f3cbfc-0567-427f-a405-5a869aaa6010', // Perpétuo - X1
  consorcio: 'b98e3746-d727-445b-b878-fc5742b6e6b8', // Perpétuo - Construa para Alugar
  credito: 'a6f3cbfc-0567-427f-a405-5a869aaa6010',
  projetos: 'a6f3cbfc-0567-427f-a405-5a869aaa6010',
};
```

---

### 2. Negocios.tsx

**Mudanças:**
- Importar `useMyBU` para obter a BU do usuário
- Usar `BU_PIPELINE_MAP` para determinar origens visíveis
- Pré-selecionar a pipeline/grupo padrão da BU

**Lógica:**
```typescript
const { data: myBU } = useMyBU();

// Origens autorizadas baseadas na BU
const buAuthorizedOrigins = useMemo(() => {
  if (!myBU) return []; // Sem BU = vê tudo (admin)
  return BU_PIPELINE_MAP[myBU] || [];
}, [myBU]);

// Pipeline padrão baseada na BU
useEffect(() => {
  if (myBU && !hasSetDefault.current) {
    hasSetDefault.current = true;
    const defaultGroup = BU_DEFAULT_GROUP_MAP[myBU];
    if (defaultGroup) {
      setSelectedPipelineId(defaultGroup);
    }
  }
}, [myBU]);
```

---

### 3. CRM.tsx

**Mudança:** Liberar aba Negócios para todos

```typescript
// Verificar se usuário tem permissão para Negócios
// ANTES: canUserAccessNegocios(role) verificava role
// DEPOIS: Sempre true (baseado em BU, não role)
const canViewNegocios = true;
```

---

### 4. OriginsSidebar.tsx

**Mudança:** Receber e aplicar filtro por BU

```typescript
interface OriginsSidebarProps {
  // ... props existentes
  allowedOriginIds?: string[]; // IDs das origens permitidas pela BU
}

// Na renderização, filtrar origens
const filteredOrigins = allowedOriginIds && allowedOriginIds.length > 0
  ? origins.filter(o => allowedOriginIds.includes(o.id))
  : origins;
```

---

## Resumo dos Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/auth/NegociosAccessGuard.tsx` | Adicionar mapeamento BU → Pipelines |
| `src/pages/crm/Negocios.tsx` | Usar BU para filtrar pipelines e pré-selecionar |
| `src/pages/CRM.tsx` | Liberar aba Negócios para todos |
| `src/components/crm/OriginsSidebar.tsx` | Filtrar origens baseado na BU |

---

## Resultado Esperado

1. **Todos os usuários** podem acessar a aba Negócios
2. Usuários de **Incorporador** veem apenas `PIPELINE INSIDE SALES`
3. Usuários de **Consórcio** veem `PIPELINE - INSIDE SALES - VIVER DE ALUGUEL` e `Perpétuo - Construa para Alugar`
4. Usuários **sem BU** (admins) veem todas as pipelines
5. A pipeline padrão é selecionada automaticamente ao abrir
