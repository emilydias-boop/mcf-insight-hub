
# Plano: Fase 4 - Migrar CRM owner_id para UUID (com Profiles Inativos)

## Objetivo

Padronizar referências de responsáveis no CRM usando UUIDs de `profiles` em vez de emails, **criando profiles inativos** para ex-funcionários que possuem deals históricos, permitindo reativação futura.

## Estado Atual

| Situação | Quantidade | % |
|----------|------------|---|
| Deals com owner_id (email) | 2.893 | 100% |
| **Mapeáveis** para profiles existentes | 2.447 | 85% |
| **Ex-funcionários** (precisam de profile) | 446 | 15% |
| Profiles atuais | 41 | todos "ativo" |

### Ex-funcionários a Criar Profiles

| Email | Deals | Status Sugerido |
|-------|-------|-----------------|
| angelina.maia@... | 215 | desativado |
| thayna.tavares@... | 45 | desativado |
| victor.hugo@... | 33 | desativado |
| isadora.magri@... | 31 | desativado |
| jessica.bellini.r2@... | 31 | desativado |
| leticia.faustino@... | 23 | desativado |
| caroline.alves@... | 22 | desativado |
| deisiele.silva@... | 15 | desativado |
| matheus.garcia@... | 15 | desativado |
| emily.dias@... | 3 | desativado |

## Arquitetura da Solução

```text
ANTES:                              DEPOIS:
┌──────────────┐                   ┌──────────────┐
│  crm_deals   │                   │  crm_deals   │
├──────────────┤                   ├──────────────┤
│ owner_id     │──(email)──?       │ owner_id     │ (mantido legacy)
│              │                   │ owner_profile_id ├──FK──┐
└──────────────┘                   └──────────────┘        │
                                                           │
                                   ┌──────────────┐        │
                                   │   profiles   │◄───────┘
                                   ├──────────────┤
                                   │ access_status│
                                   │ ├─ ativo     │ (41 usuários)
                                   │ └─ desativado│ (10+ ex-func)
                                   └──────────────┘
```

## Implementação em 5 Etapas

---

### Etapa 1: Criar Profiles Inativos para Ex-funcionários

**Tipo:** Migração de dados

Criar profiles com `access_status = 'desativado'` para cada email único que:
- Existe em `crm_deals.owner_id`
- Não existe em `profiles.email`
- É um email válido (contém @)

```sql
-- Identificar emails sem profile
INSERT INTO profiles (id, email, full_name, access_status)
SELECT 
  gen_random_uuid(),
  d.owner_id,
  split_part(d.owner_id, '@', 1) as full_name,  -- "angelina.maia" 
  'desativado'
FROM (
  SELECT DISTINCT owner_id 
  FROM crm_deals 
  WHERE owner_id LIKE '%@%'
) d
LEFT JOIN profiles p ON d.owner_id = p.email
WHERE p.id IS NULL;
```

**Resultado:** ~10 novos profiles desativados

---

### Etapa 2: Adicionar Coluna owner_profile_id

**Tipo:** Migração de schema

```sql
-- Adicionar coluna
ALTER TABLE crm_deals 
ADD COLUMN owner_profile_id UUID REFERENCES profiles(id);

-- Criar índice
CREATE INDEX idx_crm_deals_owner_profile_id 
ON crm_deals(owner_profile_id);
```

---

### Etapa 3: Migrar Dados (Preencher owner_profile_id)

**Tipo:** Migração de dados

```sql
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_profile_id IS NULL;
```

**Resultado esperado:** ~2.893 deals atualizados (100%)

---

### Etapa 4: Atualizar Código Frontend

#### 4.1 DealFilters.tsx

Alterar filtro para usar UUID em vez de email:

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/DealFilters.tsx` | Linha 137: `value={user.email}` → `value={user.id}` |

Incluir também ex-funcionários (desativados) como opção no filtro, com indicador visual.

#### 4.2 useCRMData.ts

Alterar query para filtrar por `owner_profile_id`:

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useCRMData.ts` | Linha 360: `.eq('owner_id', ...)` → `.eq('owner_profile_id', ...)` |

#### 4.3 DealFormDialog.tsx

Ao criar deal, popular ambos os campos:

```typescript
const payload = {
  ...formData,
  owner_id: selectedProfile.email,        // legacy (para sync externo)
  owner_profile_id: selectedProfile.id,   // novo (para joins)
};
```

#### 4.4 OwnerChangeDialog.tsx

Atualizar transferência de deals para usar UUID.

---

### Etapa 5: Atualizar Relatórios

#### useContractReport.ts

Substituir busca por `owner_id` (email) por join com profiles via `owner_profile_id`.

#### useSDRR2Metrics.ts

Manter lógica atual de fallback que já usa `booked_by` (UUID) quando disponível.

---

## Arquivos a Modificar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| **Banco de dados** | Schema | Adicionar coluna `owner_profile_id` |
| **Banco de dados** | Dados | Criar profiles desativados + migrar dados |
| `src/components/crm/DealFilters.tsx` | Frontend | Usar UUID no Select, mostrar ex-funcionários |
| `src/hooks/useCRMData.ts` | Frontend | Filtrar por `owner_profile_id` |
| `src/components/crm/DealFormDialog.tsx` | Frontend | Salvar ambos campos |
| `src/components/crm/OwnerChangeDialog.tsx` | Frontend | Usar `owner_profile_id` |
| `src/hooks/useContractReport.ts` | Frontend | Join otimizado |

---

## Detalhes Técnicos

### DealFilters.tsx - Mostrar Ex-funcionários

```typescript
// Query atualizada para incluir desativados
const { data: dealOwners } = useQuery({
  queryKey: ['deal-owners-all'],
  queryFn: async () => {
    // Ativos com roles específicos
    const { data: activeUsers } = await supabase
      .from('profiles')
      .select(`id, full_name, email, access_status, user_roles(role)`)
      .eq('access_status', 'ativo')
      .in('user_roles.role', ['sdr', 'closer', 'admin', 'manager', 'coordenador']);
    
    // Desativados que têm deals
    const { data: inactiveUsers } = await supabase
      .from('profiles')
      .select('id, full_name, email, access_status')
      .eq('access_status', 'desativado');
    
    return {
      active: activeUsers || [],
      inactive: inactiveUsers || [],
    };
  }
});

// No Select, agrupar por status
<SelectGroup>
  <SelectLabel>Ativos</SelectLabel>
  {dealOwners.active.map(user => (
    <SelectItem key={user.id} value={user.id}>
      {user.full_name} ({user.role})
    </SelectItem>
  ))}
</SelectGroup>
<SelectGroup>
  <SelectLabel className="text-muted-foreground">Ex-funcionários</SelectLabel>
  {dealOwners.inactive.map(user => (
    <SelectItem key={user.id} value={user.id}>
      <span className="text-muted-foreground">{user.full_name}</span>
    </SelectItem>
  ))}
</SelectGroup>
```

### Possibilidade de Reativação

Quando um ex-funcionário retorna:
1. Admin vai em Gestão de Usuários
2. Busca pelo profile (agora visível como "desativado")
3. Altera `access_status` para "ativo"
4. Cria user em auth.users e vincula ao profile existente
5. Todos os deals históricos já estão conectados!

---

## Fluxo de Implementação

```text
1. Criar profiles inativos para ex-funcionários
          ↓
2. Adicionar coluna owner_profile_id
          ↓
3. Migrar dados (UPDATE em lote)
          ↓
4. Atualizar DealFilters.tsx (UUID + grupos)
          ↓
5. Atualizar useCRMData.ts 
          ↓
6. Atualizar DealFormDialog.tsx
          ↓
7. Atualizar OwnerChangeDialog.tsx
          ↓
8. Testar filtros, criação e transferência
```

---

## Benefícios

1. **Integridade Histórica:** Nenhum deal fica órfão
2. **Reativação Simples:** Ex-funcionário retorna com histórico intacto
3. **Performance:** Joins por UUID são mais eficientes
4. **Visibilidade:** Admin pode ver quem eram os responsáveis históricos
5. **Compatibilidade:** `owner_id` (email) mantido para sistemas externos
6. **Auditoria:** Rastreabilidade completa de responsabilidades

---

## Scripts SQL Completos

### 1. Criar Profiles Inativos

```sql
-- Identificar e criar profiles para emails sem correspondência
INSERT INTO profiles (id, email, full_name, access_status)
SELECT 
  gen_random_uuid() as id,
  owner_email,
  INITCAP(REPLACE(SPLIT_PART(owner_email, '@', 1), '.', ' ')) as full_name,
  'desativado' as access_status
FROM (
  SELECT DISTINCT owner_id as owner_email
  FROM crm_deals 
  WHERE owner_id LIKE '%@%'
    AND owner_id NOT IN (SELECT email FROM profiles WHERE email IS NOT NULL)
) orphan_emails;
```

### 2. Adicionar Coluna

```sql
ALTER TABLE crm_deals 
ADD COLUMN owner_profile_id UUID REFERENCES profiles(id);

CREATE INDEX idx_crm_deals_owner_profile_id 
ON crm_deals(owner_profile_id);
```

### 3. Migrar Dados

```sql
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_profile_id IS NULL;
```

### 4. Verificar Migração

```sql
SELECT 
  COUNT(*) FILTER (WHERE owner_profile_id IS NOT NULL) as migrated,
  COUNT(*) FILTER (WHERE owner_profile_id IS NULL AND owner_id IS NOT NULL) as still_orphan,
  COUNT(*) as total
FROM crm_deals;
-- Esperado: migrated = ~2893, still_orphan = 0
```
