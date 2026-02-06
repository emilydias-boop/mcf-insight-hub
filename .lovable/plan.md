
# Corrigir Foreign Key para exibir carteiras de GRs

## Problema Identificado

A query que busca as carteiras está falhando com erro HTTP 400:

```
Could not find a relationship between 'gr_wallets' and 'gr_user_id' in the schema cache
```

Isso acontece porque:
1. A coluna `gr_user_id` referencia `auth.users(id)`
2. O hook tenta fazer join com `profiles` usando `profiles:gr_user_id`
3. PostgREST nao encontra essa relacao porque nao ha FK direta entre `gr_wallets.gr_user_id` e `profiles.id`

## Solucao

Duas abordagens possiveis:

### Opcao 1: Adicionar FK explícita para profiles (Recomendada)
Adicionar uma constraint de foreign key apontando para `profiles(id)` em vez de `auth.users(id)`, ou adicionar uma segunda FK.

### Opcao 2: Alterar hook para fazer JOIN manual
Buscar carteiras e profiles separadamente e fazer o merge no frontend.

Vou usar a **Opcao 2** pois e mais rapida e evita migracoes adicionais:

## Alteracoes

### Arquivo: src/hooks/useGRWallet.ts

Modificar `useAllGRWallets` para buscar carteiras e depois enriquecer com dados dos profiles:

```typescript
export const useAllGRWallets = () => {
  return useQuery({
    queryKey: ['all-gr-wallets'],
    queryFn: async () => {
      // Buscar carteiras sem JOIN
      const { data: wallets, error: walletsError } = await supabase
        .from('gr_wallets')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (walletsError) throw walletsError;
      if (!wallets || wallets.length === 0) return [];
      
      // Buscar profiles dos GRs
      const grUserIds = wallets.map(w => w.gr_user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', grUserIds);
      
      if (profilesError) throw profilesError;
      
      // Merge dos dados
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return wallets.map(w => ({
        ...w,
        gr_name: profileMap.get(w.gr_user_id)?.full_name,
        gr_email: profileMap.get(w.gr_user_id)?.email,
      })) as GRWallet[];
    },
  });
};
```

## Resultado Esperado

Apos a correcao:
- A carteira do William Ferreira aparecera na tabela
- O nome e email serao exibidos corretamente
- Nenhum erro 400 nas requisicoes

## Informacao Adicional

A carteira ja existe no banco:
- ID: `26c2cb7e-5862-4db9-8d7b-d6c6d2a1b5ee`
- GR: William Ferreira (`a3a75942-b550-4102-af6d-d5885b4ba370`)
- BU: credito
- Capacidade: 700
- Status: Aberta
