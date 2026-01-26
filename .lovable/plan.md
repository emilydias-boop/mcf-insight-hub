
# Plano: Fase 3 - Definir Gestores e Hierarquia

## Objetivo

Estabelecer uma cadeia de comando formal, populando o campo `gestor_id` dos colaboradores e gerando automaticamente o organograma a partir dos dados do RH.

## Estado Atual

| Situação | Quantidade |
|----------|------------|
| Colaboradores ativos | 22 |
| Colaboradores **com** gestor definido | 4 |
| Colaboradores **sem** gestor definido | 18 |
| Registros no organograma | 0 |

### Gestores Identificados
- **Grimaldo** (CEO) - gestor de Emily Caroline e Emily Segundario
- **Jéssica Bellini** (Coordenadora) - gestora de Antony e Cristiane

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Admin → Organograma                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Tab: Estrutura]                    [Tab: Métricas]            │
│  ┌────────────────────────────────┐                             │
│  │ [Gerar do RH]  [Limpar]        │                             │
│  │                                │                             │
│  │  CEO                           │                             │
│  │  └── Coordenadora              │                             │
│  │      ├── SDR N1                │                             │
│  │      ├── SDR N2                │                             │
│  │      └── Closer                │                             │
│  └────────────────────────────────┘                             │
│                                                                 │
│  [Tab: Definir Gestores]  (NOVA)                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Colaboradores sem gestor (18)        Ação Rápida           │ │
│  │ ┌──────────────────────────────────────────────────────┐   │ │
│  │ │ Carol Correa (SDR Inside N2)    [Selecionar Gestor ▼]│   │ │
│  │ │ Carol Souza (SDR Inside N1)     [Selecionar Gestor ▼]│   │ │
│  │ │ ...                                                  │   │ │
│  │ └──────────────────────────────────────────────────────┘   │ │
│  │                                                            │ │
│  │ [Definir em lote: Todos SDR → Jéssica Bellini]             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Mudanças Necessárias

### 1. Nova Tab "Definir Gestores" na página Organograma

**Arquivo:** `src/pages/admin/Organograma.tsx`

Criar nova aba que exibe:
- Lista de colaboradores sem gestor
- Select inline para definir gestor rapidamente
- Ação em lote para definir gestor por cargo

**Componente: GestoresTab**

| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de pendentes | Colaboradores ativos sem `gestor_id` |
| Inline edit | Select para escolher gestor diretamente na lista |
| Bulk assign | Definir gestor para múltiplos colaboradores de uma vez |
| Filtros | Por cargo, squad, departamento |

### 2. Botão "Gerar Organograma do RH"

**Arquivo:** `src/pages/admin/Organograma.tsx` (EstruturaTab)

Adicionar botão que:
1. Busca todos os colaboradores ativos com `cargo_catalogo_id` e `gestor_id`
2. Cria nodes no `organograma` respeitando a hierarquia de gestores
3. Agrupa por squad

**Lógica:**
```text
Para cada colaborador:
  1. Verificar se já existe node no organograma para seu cargo_catalogo_id + squad
  2. Se não existir, criar node:
     - cargo_catalogo_id: do colaborador
     - squad: do colaborador
     - parent_id: buscar node do gestor (se gestor tiver cargo no organograma)
     - posicao_ordem: baseado no nível do cargo
```

### 3. Novo Hook: useGenerateOrganograma

**Arquivo:** `src/hooks/useOrganograma.ts`

Adicionar mutation para gerar organograma em lote:

```typescript
const generateFromHR = useMutation({
  mutationFn: async () => {
    // 1. Buscar employees ativos com cargo_catalogo_id
    // 2. Agrupar por squad + cargo_catalogo_id
    // 3. Criar nodes únicos
    // 4. Estabelecer parent_id baseado em gestor_id
  }
});
```

### 4. Visualização de Árvore Melhorada

**Arquivo:** `src/pages/admin/Organograma.tsx` (EstruturaTab)

Melhorar a visualização para mostrar hierarquia real:
- Linhas de conexão visuais
- Nomes dos colaboradores em cada posição
- Contador de pessoas por cargo

## Arquivos a Modificar/Criar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/Organograma.tsx` | Adicionar GestoresTab, melhorar EstruturaTab |
| `src/hooks/useOrganograma.ts` | Adicionar `useGenerateOrganograma` e `useBulkUpdateGestores` |
| `src/hooks/useEmployees.ts` | Adicionar query para colaboradores sem gestor |

## Detalhes Técnicos

### GestoresTab - Componente Principal

```typescript
function GestoresTab() {
  const { data: employees } = useEmployees();
  const { updateEmployee } = useEmployeeMutations();
  
  // Colaboradores sem gestor
  const semGestor = employees?.filter(e => 
    e.status === 'ativo' && !e.gestor_id
  ) || [];
  
  // Colaboradores que podem ser gestores (coordenadores, supervisores, diretores)
  const possiveisGestores = employees?.filter(e => 
    e.status === 'ativo' && 
    ['Coordenador', 'Supervisor', 'Gerente', 'Diretor', 'CEO'].some(c => 
      e.cargo?.includes(c)
    )
  ) || [];
  
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Colaboradores sem Gestor ({semGestor.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {semGestor.map(emp => (
            <div key={emp.id} className="flex items-center justify-between py-2">
              <div>
                <span>{emp.nome_completo}</span>
                <Badge>{emp.cargo}</Badge>
              </div>
              <Select onValueChange={(gestorId) => updateEmployee.mutate({
                id: emp.id,
                data: { gestor_id: gestorId }
              })}>
                {possiveisGestores.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.nome_completo}</SelectItem>
                ))}
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Geração de Organograma

```typescript
const generateOrganogramaFromHR = useMutation({
  mutationFn: async () => {
    // 1. Buscar employees com cargo_catalogo_id
    const { data: employees } = await supabase
      .from('employees')
      .select('id, cargo_catalogo_id, gestor_id, squad, departamento')
      .eq('status', 'ativo')
      .not('cargo_catalogo_id', 'is', null);
    
    // 2. Criar mapa de cargos únicos por squad
    const cargoSquadMap = new Map();
    for (const emp of employees) {
      const key = `${emp.cargo_catalogo_id}-${emp.squad || 'geral'}`;
      if (!cargoSquadMap.has(key)) {
        cargoSquadMap.set(key, {
          cargo_catalogo_id: emp.cargo_catalogo_id,
          squad: emp.squad,
          departamento: emp.departamento,
        });
      }
    }
    
    // 3. Inserir nodes no organograma
    const nodes = Array.from(cargoSquadMap.values()).map((n, i) => ({
      ...n,
      posicao_ordem: i + 1,
      ativo: true,
    }));
    
    await supabase.from('organograma').insert(nodes);
  }
});
```

## Fluxo de Implementação

```text
1. Adicionar GestoresTab no Organograma.tsx
          ↓
2. Implementar lista de colaboradores sem gestor
          ↓
3. Adicionar inline select para definir gestor
          ↓
4. Implementar ação em lote
          ↓
5. Criar hook useGenerateOrganograma
          ↓
6. Adicionar botão "Gerar do RH" na EstruturaTab
          ↓
7. Melhorar visualização da árvore
```

## Benefícios

1. **Gestão visual**: Ver todos colaboradores sem gestor em um lugar
2. **Agilidade**: Definir gestores inline, sem abrir formulário
3. **Organograma automático**: Gerado a partir dos dados existentes
4. **Hierarquia formal**: Cadeia de comando documentada
5. **Base para métricas**: Estrutura para calcular performance por equipe
