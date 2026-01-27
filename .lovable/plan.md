

# Correção: Mostrar Todos os Usuários na Distribuição de Leads

## Problema Atual

O componente `WizardStepDistribution.tsx` tem duas restrições que limitam a exibição de usuários:

1. Usa `.eq('is_active', true)` - coluna inexistente
2. Filtra apenas usuários com roles `sdr` ou `closer`

## Correção Necessária

**Arquivo:** `src/components/crm/wizard/WizardStepDistribution.tsx`

### Mudanças:

1. **Corrigir filtro de status ativo** (linha 39):
   - De: `.eq('is_active', true)`
   - Para: `.eq('access_status', 'ativo')`

2. **Remover filtro de roles** (linhas 47-65):
   - Remover busca na tabela `user_roles`
   - Remover filtro `sdrCloserUserIds`
   - Mostrar todos os profiles ativos diretamente

### Código Simplificado:

```typescript
useEffect(() => {
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const client = supabase as any;
      
      // Buscar TODOS os usuários ativos
      const { data: profilesData } = await client
        .from('profiles')
        .select('id, email, full_name')
        .eq('access_status', 'ativo')
        .order('full_name');
      
      if (!profilesData) {
        setUsers([]);
        return;
      }
      
      // Mapear diretamente sem filtro de role
      const allUsers = profilesData.map((p: any) => ({
        id: p.id,
        email: p.email || '',
        full_name: p.full_name || p.email || '',
      }));
      
      setUsers(allUsers);
    } finally {
      setIsLoading(false);
    }
  };

  fetchUsers();
}, []);
```

## Resultado

Após a correção, o dropdown mostrará **todos os usuários ativos** do sistema (admins, managers, coordenadores, SDRs, closers, financeiro, RH, etc.), permitindo configurar distribuição de leads para qualquer pessoa.

