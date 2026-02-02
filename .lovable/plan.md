
# Plano: Criar Página de Configuração de BU → Origens

## Problema Atual

O mapeamento de **Business Unit → Origins/Groups** está hardcoded no arquivo `NegociosAccessGuard.tsx`. Para adicionar uma nova BU (ex: Leilão) ou modificar quais pipelines aparecem para cada BU, é necessário alterar o código manualmente.

## Solução

Criar uma **tabela no banco de dados** e uma **página de administração** para gerenciar o mapeamento BU → Origins dinamicamente.

---

## Arquitetura da Solução

```text
┌───────────────────────────────────────────────────────────────────────┐
│                     PÁGINA DE ADMINISTRAÇÃO                           │
│               /admin/configuracao-bu                                  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────────┐                                                 │
│   │ Selecione a BU  │  ▼ Consórcio                                    │
│   └─────────────────┘                                                 │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐ │
│   │ GRUPOS/FUNIS VINCULADOS                                         │ │
│   ├─────────────────────────────────────────────────────────────────┤ │
│   │ ☑ Perpétuo - Construa para Alugar    [b98e3746...]             │ │
│   │ ☑ Hubla - Viver de Aluguel           [267905ec...]             │ │
│   │ ☑ Hubla - Construir Para Alugar      [35361575...]             │ │
│   │ ☐ Hubla - A010                       [b9888270...]             │ │
│   │ ☐ Perpétuo - X1                      [a6f3cbfc...]             │ │
│   └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐ │
│   │ ORIGENS AVULSAS (sem grupo definido)                            │ │
│   ├─────────────────────────────────────────────────────────────────┤ │
│   │ ☑ PIPELINE INSIDE SALES - VIVER     [4e2b810a...]              │ │
│   └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│                                      [Salvar Configuração]            │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Alterações Necessárias

### 1) Criar Tabela `bu_origin_mapping`

**SQL Migration:**

```sql
CREATE TABLE bu_origin_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bu TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('group', 'origin')),
  entity_id UUID NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bu, entity_type, entity_id)
);

-- Índices para performance
CREATE INDEX idx_bu_origin_mapping_bu ON bu_origin_mapping(bu);
CREATE INDEX idx_bu_origin_mapping_entity ON bu_origin_mapping(entity_type, entity_id);

-- RLS
ALTER TABLE bu_origin_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar bu_origin_mapping"
ON bu_origin_mapping FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Todos podem ler bu_origin_mapping"
ON bu_origin_mapping FOR SELECT
USING (TRUE);
```

---

### 2) Criar Página de Administração

**Arquivo:** `src/pages/admin/ConfiguracaoBU.tsx`

Componentes:
- **Select de BU** - Dropdown com todas as BUs disponíveis
- **Lista de Grupos** - Checkboxes para vincular grupos à BU
- **Lista de Origins Avulsas** - Origins sem grupo para vincular diretamente
- **Botão Salvar** - Persiste as alterações

**Hook:** `src/hooks/useBUOriginMapping.ts`

```typescript
// Buscar mapeamento atual de uma BU
export function useBUOriginMapping(bu: string) {
  return useQuery({
    queryKey: ['bu-origin-mapping', bu],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bu_origin_mapping')
        .select('*')
        .eq('bu', bu);
      if (error) throw error;
      return data;
    },
    enabled: !!bu,
  });
}

// Salvar mapeamento
export function useSaveBUOriginMapping() {
  return useMutation({
    mutationFn: async ({ bu, mappings }: { 
      bu: string; 
      mappings: { entity_type: string; entity_id: string; is_default?: boolean }[] 
    }) => {
      // Deletar mapeamentos antigos
      await supabase.from('bu_origin_mapping').delete().eq('bu', bu);
      
      // Inserir novos
      if (mappings.length > 0) {
        const { error } = await supabase.from('bu_origin_mapping').insert(
          mappings.map(m => ({ bu, ...m }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bu-origin-mapping'] });
      toast.success('Configuração salva com sucesso!');
    },
  });
}
```

---

### 3) Atualizar `NegociosAccessGuard.tsx`

Substituir os maps hardcoded por uma função que busca do banco:

**Arquivo:** `src/hooks/useBUPipelineMap.ts`

```typescript
export function useBUPipelineMap(bu: BusinessUnit | null) {
  return useQuery({
    queryKey: ['bu-pipeline-map', bu],
    queryFn: async () => {
      if (!bu) return { origins: [], groups: [], defaultOrigin: null, defaultGroup: null };
      
      const { data, error } = await supabase
        .from('bu_origin_mapping')
        .select('entity_type, entity_id, is_default')
        .eq('bu', bu);
      
      if (error) throw error;
      
      const origins = data
        .filter(d => d.entity_type === 'origin')
        .map(d => d.entity_id);
      const groups = data
        .filter(d => d.entity_type === 'group')
        .map(d => d.entity_id);
      
      const defaultOrigin = data.find(d => d.entity_type === 'origin' && d.is_default)?.entity_id;
      const defaultGroup = data.find(d => d.entity_type === 'group' && d.is_default)?.entity_id;
      
      return { origins, groups, defaultOrigin, defaultGroup };
    },
    enabled: !!bu,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
}
```

---

### 4) Atualizar Componentes Dependentes

**Arquivos a modificar:**

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/PipelineSelector.tsx` | Usar `useBUPipelineMap` em vez de `BU_GROUP_MAP` |
| `src/components/crm/QuickScheduleModal.tsx` | Usar `useBUPipelineMap` em vez de `BU_PIPELINE_MAP` |
| `src/pages/crm/Negocios.tsx` | Usar hook para filtrar deals por BU |

---

### 5) Adicionar Rota no App.tsx

```typescript
import ConfiguracaoBU from "./pages/admin/ConfiguracaoBU";

// Dentro das rotas de administração
<Route path="admin/configuracao-bu" element={
  <RoleGuard allowedRoles={['admin', 'manager']}>
    <ConfiguracaoBU />
  </RoleGuard>
} />
```

---

### 6) Adicionar Link na Sidebar

**Arquivo:** `src/components/layout/sidebar/SidebarConfig.tsx` ou equivalente

Adicionar item no menu de Administração:
```typescript
{
  name: 'Configuração BU',
  path: '/admin/configuracao-bu',
  icon: Building2,
}
```

---

## Migração de Dados Inicial

Após criar a tabela, inserir os mapeamentos existentes do código:

```sql
-- Incorporador
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default) VALUES
  ('incorporador', 'group', 'a6f3cbfc-0567-427f-a405-5a869aaa6010', TRUE),
  ('incorporador', 'origin', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', TRUE);

-- Consórcio
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default) VALUES
  ('consorcio', 'group', 'b98e3746-d727-445b-b878-fc5742b6e6b8', TRUE),
  ('consorcio', 'group', '267905ec-8fcf-4373-8d62-273bb6c6f8ca', FALSE),
  ('consorcio', 'group', '35361575-d8a9-4ea0-8703-372a2988d2be', FALSE),
  ('consorcio', 'origin', '4e2b810a-6782-4ce9-9c0d-10d04c018636', TRUE);

-- Leilão
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default) VALUES
  ('leilao', 'group', 'f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c', TRUE),
  ('leilao', 'origin', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', TRUE);
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| **SQL Migration** | Criar tabela `bu_origin_mapping` |
| `src/pages/admin/ConfiguracaoBU.tsx` | **Criar** página de configuração |
| `src/hooks/useBUOriginMapping.ts` | **Criar** hooks para CRUD |
| `src/hooks/useBUPipelineMap.ts` | **Criar** hook para consumo |
| `src/App.tsx` | Adicionar rota `/admin/configuracao-bu` |
| `src/components/layout/sidebar/SidebarConfig.tsx` | Adicionar link no menu |
| `src/components/auth/NegociosAccessGuard.tsx` | Manter fallback hardcoded para compatibilidade |
| `src/components/crm/PipelineSelector.tsx` | Usar novo hook |
| `src/components/crm/QuickScheduleModal.tsx` | Usar novo hook |

---

## Resultado Esperado

1. **Página de Administração** em `/admin/configuracao-bu` para gerenciar mapeamentos
2. **Novas BUs** podem ser configuradas sem alterar código
3. **Origens/Grupos** podem ser adicionados ou removidos de cada BU dinamicamente
4. **Fallback hardcoded** mantido para garantir funcionamento caso a tabela esteja vazia
5. **Performance** otimizada com cache de 5 minutos nos hooks
