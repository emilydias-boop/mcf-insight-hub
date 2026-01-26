
# Plano: Unificar Entidades do Sistema (Árvore Organizacional)

## Diagnóstico: O Que Está "Solto"

Após análise detalhada do banco de dados, identifiquei **7 desconexões críticas** que impedem o sistema de funcionar como uma árvore integrada:

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **Employees sem Profile** | 17 de 24 colaboradores no RH não têm vínculo com usuários do sistema |
| 2 | **Organograma Vazio** | Estrutura hierárquica não utilizada (0 registros) |
| 3 | **Cargo texto-livre** | Colaboradores usam texto livre em vez de `cargos_catalogo` |
| 4 | **Gestor indefinido** | 20 de 24 sem gestor direto definido |
| 5 | **CRM usa EMAIL** | `owner_id` usa emails como chave em vez de UUIDs |
| 6 | **Squads duplicados** | `profiles.squad` vs `employees.squad` desalinhados |
| 7 | **Sem Foreign Keys** | Nenhum FK entre profiles ↔ employees ↔ organograma |

## Visão da Árvore Unificada

```text
                    ┌────────────────────────┐
                    │      auth.users        │
                    │   (autenticação)       │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │       profiles         │
                    │  (identidade sistema)  │
                    │  email, squad, avatar  │
                    └───────────┬────────────┘
                                │ FK
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼───────┐     ┌─────────▼────────┐     ┌───────▼───────┐
│  user_roles   │     │    employees     │     │   crm_deals   │
│  (permissões) │     │  (dados RH/PJ)   │     │  (negócios)   │
└───────────────┘     └─────────┬────────┘     └───────────────┘
                                │ FK
                      ┌─────────▼────────┐
                      │  cargos_catalogo │
                      │  (cargo formal)  │
                      └─────────┬────────┘
                                │ FK
                      ┌─────────▼────────┐
                      │   organograma    │
                      │  (hierarquia)    │
                      └──────────────────┘
```

## Solução em 4 Fases

---

### FASE 1: Vincular Employees aos Profiles

**Objetivo:** Cada colaborador RH deve estar ligado a um usuário do sistema

**Implementação:**

1. Criar tela de "Vinculação" no formulário de colaborador com dropdown de profiles disponíveis
2. Adicionar botão "Vincular Usuário" na aba Geral do Employee
3. Ao vincular, sincronizar automaticamente:
   - `employees.profile_id` ← `profiles.id`
   - `employees.squad` ← `profiles.squad` (ou vice-versa)

**Arquivos a modificar:**

| Arquivo | Alteração |
|---------|-----------|
| `src/components/hr/tabs/EmployeeGeneralTab.tsx` | Adicionar seção "Usuário do Sistema" com Select de profiles |
| `src/hooks/useEmployees.ts` | Query para buscar profiles não-vinculados |
| `src/types/hr.ts` | Adicionar interface para profile vinculado |

**UI proposta:**
```text
┌─────────────────────────────────────────────────┐
│ 👤 Usuário do Sistema                           │
├─────────────────────────────────────────────────┤
│ Profile Vinculado: [___Emily Caroline Dias___▼] │
│ Email: emily.dias@minhacasafinanciada.com       │
│ Role: admin                                     │
│                          [Desvincular]          │
└─────────────────────────────────────────────────┘
```

---

### FASE 2: Normalizar Cargos com Catálogo

**Objetivo:** Substituir texto-livre por referência ao `cargos_catalogo`

**Implementação:**

1. Alterar campo "Cargo" para Select usando `cargos_catalogo`
2. Manter campo texto como fallback para cargos não catalogados
3. Migração: Script para sugerir mapeamento automático baseado em similaridade

**Arquivos a modificar:**

| Arquivo | Alteração |
|---------|-----------|
| `src/components/hr/tabs/EmployeeGeneralTab.tsx` | Select com `cargos_catalogo` em vez de texto |
| `src/hooks/useOrganograma.ts` | Exportar hook `useCargos` já existente |
| Schema DB | Criar FK `employees.cargo_catalogo_id` → `cargos_catalogo.id` |

---

### FASE 3: Definir Gestores e Hierarquia

**Objetivo:** Estabelecer cadeia de comando formal

**Implementação:**

1. Popular `employees.gestor_id` para todos
2. Gerar automaticamente registros no `organograma` baseado em:
   - Cargo catalogado do employee
   - Gestor definido (parent_id)
   - Squad
3. Criar botão "Gerar Organograma" na página admin

**Arquivos a modificar:**

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/Organograma.tsx` | Botão "Popular do RH" que cria nodes baseado em employees |
| `src/hooks/useOrganograma.ts` | Mutation para criação em lote |

---

### FASE 4: Migrar CRM owner_id para UUID

**Objetivo:** Padronizar referências usando UUIDs de profiles

**Implementação:**

1. Criar coluna `owner_profile_id UUID` em `crm_deals`
2. Edge function para migrar dados existentes:
   - Buscar profile por email
   - Popular `owner_profile_id`
3. Atualizar queries do CRM para usar nova coluna
4. Manter `owner_id` (email) para compatibilidade durante transição

**Arquivos a modificar:**

| Arquivo | Alteração |
|---------|-----------|
| Schema DB | Adicionar `crm_deals.owner_profile_id` com FK para profiles |
| Edge function | `migrate-crm-owners` para popular baseado em email |
| `src/hooks/useDeals.ts` | Usar `owner_profile_id` em queries |
| `src/components/crm/DealFilters.tsx` | Filtro por `owner_profile_id` |

---

## Ordem de Implementação Recomendada

| Fase | Prioridade | Esforço | Dependências |
|------|------------|---------|--------------|
| 1. Vincular Employees/Profiles | ALTA | Médio | Nenhuma |
| 2. Normalizar Cargos | MÉDIA | Baixo | Fase 1 |
| 3. Popular Organograma | MÉDIA | Médio | Fase 1 + 2 |
| 4. Migrar CRM owners | ALTA | Alto | Fase 1 |

---

## Benefícios Após Unificação

1. **Visão 360° do colaborador:** Dados RH + Permissões + CRM em uma tela
2. **Organograma automático:** Gerado a partir dos dados existentes
3. **Relatórios integrados:** Performance CRM por gestor/squad/departamento
4. **Consistência:** Uma fonte única de verdade para identidade de usuários
5. **Métricas de fechamento:** Vinculadas ao cargo formal do catálogo

---

## Detalhes Técnicos

### Fase 1 - Vincular Employees aos Profiles

**Novo componente ProfileLinkSection:**
```typescript
// Em EmployeeGeneralTab.tsx
function ProfileLinkSection({ employee }: { employee: Employee }) {
  const { data: availableProfiles } = useQuery({
    queryKey: ['available-profiles'],
    queryFn: async () => {
      // Buscar profiles que ainda não estão vinculados a nenhum employee
      const { data } = await supabase
        .from('profiles')
        .select(`id, email, full_name, squad, user_roles!inner(role)`)
        .eq('access_status', 'ativo');
      return data;
    }
  });
  
  const linkedProfile = availableProfiles?.find(p => p.id === employee.profile_id);
  
  // UI para vincular/desvincular
}
```

### Fase 4 - Migração de Owners

**Nova coluna:**
```sql
ALTER TABLE crm_deals 
ADD COLUMN owner_profile_id UUID REFERENCES profiles(id);
```

**Script de migração:**
```sql
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_profile_id IS NULL;
```

---

## Próximos Passos

Confirme qual fase você gostaria de implementar primeiro:

1. **Fase 1** - Vincular Employees aos Profiles (permite ver dados integrados)
2. **Fase 4** - Migrar CRM owners (corrige dados corrompidos do CRM)
3. **Todas as fases** - Implementação completa sequencial
