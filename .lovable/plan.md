
# Plano: Sincronizar Roles de Usuário com Cargos do RH

## Problema Identificado

Atualmente o sistema tem duas estruturas separadas que não conversam:

| Conceito | Fonte | Exemplos | Uso |
|----------|-------|----------|-----|
| **Role (Sistema)** | Enum `app_role` no banco | admin, manager, sdr, closer | Controle de permissões e acesso |
| **Cargo (RH)** | Tabela `cargos_catalogo` | Gerente de Contas, SDR Crédito N1, Designer | Estrutura organizacional e salários |

Quando você vai adicionar um usuário como "Gerente de Contas" (GR), essa opção não existe porque o formulário mostra apenas os roles do sistema.

---

## Proposta de Solução

### Opção Recomendada: Mapeamento Cargo → Role

Cada **cargo_base** do RH deve ter um **role de sistema** associado:

| cargo_base | role_sistema |
|------------|--------------|
| SDR | sdr |
| Closer | closer |
| Coordenador | coordenador |
| Supervisor | coordenador |
| Gerente de Contas | manager |
| Diretor | admin |
| Designer | viewer |
| Desenvolvedor | viewer |
| Social Media | viewer |
| Filmmaker | viewer |
| Arquiteto | viewer |
| ADM | viewer |

### Alterações Necessárias

#### 1. Migração: Adicionar coluna `role_sistema` em `cargos_catalogo`

```sql
ALTER TABLE cargos_catalogo 
ADD COLUMN role_sistema TEXT DEFAULT 'viewer';

-- Preencher mapeamentos conhecidos
UPDATE cargos_catalogo SET role_sistema = 'sdr' WHERE cargo_base = 'SDR';
UPDATE cargos_catalogo SET role_sistema = 'closer' WHERE cargo_base = 'Closer';
UPDATE cargos_catalogo SET role_sistema = 'coordenador' WHERE cargo_base IN ('Coordenador', 'Supervisor');
UPDATE cargos_catalogo SET role_sistema = 'manager' WHERE cargo_base IN ('Gerente de Contas', 'Head de Relacionamento');
UPDATE cargos_catalogo SET role_sistema = 'admin' WHERE cargo_base IN ('Diretor', 'Diretora');
UPDATE cargos_catalogo SET role_sistema = 'financeiro' WHERE area = 'Financeiro';
UPDATE cargos_catalogo SET role_sistema = 'rh' WHERE area = 'RH';
```

#### 2. Atualizar `CreateUserDialog.tsx`

Modificar o diálogo para:
- Buscar cargos ativos do banco (`cargos_catalogo`)
- Mostrar dropdown de **Cargo** ao invés de Role
- Derivar o role automaticamente do cargo selecionado
- Permitir override de role para casos especiais

```text
Antes:
  [Role *] → Select de Admin, Manager, SDR, etc.
  [Business Unit] → A010, Consórcio, Crédito...

Depois:
  [Cargo *] → Select de "SDR Crédito N1", "Gerente de Contas Inside", etc.
  [Role de Acesso] → Auto-preenchido com base no cargo (editável para admins)
  [Business Unit] → Auto-preenchido com base na área do cargo
```

#### 3. Criar Hook `useCargosAtivos`

Hook para buscar cargos ativos com seu mapeamento de role:

```typescript
export function useCargosAtivos() {
  return useQuery({
    queryKey: ['cargos-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargos_catalogo')
        .select('id, nome_exibicao, cargo_base, area, role_sistema')
        .eq('ativo', true)
        .order('area')
        .order('nivel');
      
      if (error) throw error;
      return data;
    }
  });
}
```

#### 4. Atualizar `CargoFormDialog.tsx`

Adicionar campo para selecionar o role de sistema ao criar/editar cargo:

```text
[Cargo Base] → SDR, Closer, Gerente de Contas...
[Role de Sistema] → admin, manager, sdr, closer... (dropdown)
[Área] → Inside Sales, Crédito...
[Nível] → N1, N2, N3...
```

#### 5. Atualizar Edge Function `create-user`

Receber `cargo_id` e derivar o role automaticamente:

```typescript
// Buscar cargo para obter role
const { data: cargo } = await supabaseAdmin
  .from('cargos_catalogo')
  .select('role_sistema, area')
  .eq('id', cargo_id)
  .single();

// Usar role do cargo
const role = cargo?.role_sistema || 'viewer';
```

---

## Fluxo Corrigido

```text
Usuário clica "Adicionar Usuário"
    |
    +-- Seleciona Cargo: "Gerente de Contas Inside"
    |
    +-- Sistema preenche automaticamente:
    |     • Role: manager
    |     • BU: Inside Sales
    |
    +-- Confirma → Usuário criado com:
          • cargo_catalogo_id no employee
          • role = manager no user_roles
          • squad = inside_sales no profile
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Database | Migration | Adicionar `role_sistema` em `cargos_catalogo` |
| `src/hooks/useHRConfig.ts` | Modificar | Atualizar interface `Cargo` |
| `src/components/hr/config/CargoFormDialog.tsx` | Modificar | Adicionar campo role |
| `src/components/user-management/CreateUserDialog.tsx` | Modificar | Usar cargos do RH |
| `supabase/functions/create-user/index.ts` | Modificar | Derivar role do cargo |

---

## Resultado Esperado

1. Ao criar usuário, você seleciona o **cargo** (ex: "Gerente de Contas Crédito")
2. O sistema automaticamente define o **role de acesso** correto (manager)
3. Novos cargos cadastrados no RH terão campo para definir qual role devem usar
4. Mantém a segurança: roles continuam sendo um enum controlado
