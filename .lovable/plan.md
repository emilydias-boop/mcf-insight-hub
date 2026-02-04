

# Plano: Corrigir Vínculo user_id nos Employees e Adicionar Fallback por Email

## Problema Identificado

O card "Enviar NFSe" não aparece porque a condição na linha 177 do `MeuFechamento.tsx` exige `myEmployee && payout.status === 'APPROVED'`. 

O hook `useMyEmployee` busca na tabela `employees` por `user_id`, mas **a maioria dos funcionários PJ não tem `user_id` vinculado**.

### Funcionários PJ Afetados (com profile correspondente mas sem user_id)

| Funcionário | Email | Profile ID | Employee user_id |
|-------------|-------|------------|------------------|
| Cleiton Lima | cleiton.lima@... | 16828627-... | ❌ NULL |
| Angelina Maia | angelina.maia@... | 62411788-... | ❌ NULL |
| Antony Elias | antony.elias@... | 70113bef-... | ❌ NULL |
| Carol Correa | carol.correa@... | c7005c87-... | ❌ NULL |
| Carol Souza | caroline.souza@... | 4c947a4c-... | ❌ NULL |
| Cristiane Gomes | cristiane.gomes@... | c8fd2b83-... | ❌ NULL |
| Jessica Martins | jessica.martins@... | b0ea004d-... | ❌ NULL |
| Juliana Rodrigues | juliana.rodrigues@... | baa6047c-... | ❌ NULL |
| Julio Caetano | julio.caetano@... | dd76c153-... | ❌ NULL |
| Leticia Nunes | leticia.nunes@... | c1ede6ed-... | ❌ NULL |

## Solução em Duas Partes

### Parte 1: Migração SQL para Vincular user_id em Massa

Atualizar todos os registros da tabela `employees` onde existe um `profile` com email correspondente:

```sql
UPDATE employees e
SET user_id = p.id
FROM profiles p
WHERE LOWER(e.email_pessoal) = LOWER(p.email)
  AND e.user_id IS NULL
  AND e.email_pessoal IS NOT NULL;
```

### Parte 2: Fallback por Email no Hook useMyEmployee

Modificar o hook para buscar por email quando não encontrar por `user_id` (previne problemas futuros):

**Arquivo:** `src/hooks/useMyEmployee.ts`

```typescript
export function useMyEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-employee', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Primeiro tenta buscar por user_id
      let { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Fallback: buscar por email_pessoal se não encontrou
      if (!data && user.email) {
        const emailResult = await supabase
          .from('employees')
          .select('*')
          .eq('email_pessoal', user.email)
          .maybeSingle();
        
        if (emailResult.data) {
          data = emailResult.data;
          console.log('Employee encontrado via email fallback:', data.nome_completo);
        }
      }
      
      if (error) throw error;
      return data as Employee | null;
    },
    enabled: !!user?.id,
  });
}
```

## Fluxo Completo de Envio de NFSe

Após as correções, o fluxo funcionará assim:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE ENVIO DE NFSe                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  1. SDR/Closer acessa /meu-fechamento  │
         └────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  2. useOwnFechamento busca o payout    │
         │     (via user_id ou email no SDR)      │
         └────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  3. useMyEmployee busca employee       │
         │     (via user_id ou email_pessoal)     │
         └────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  4. Se status = APPROVED e             │
         │     myEmployee existe e nfse_id = NULL │
         │     → Exibe card amarelo "Enviar NFSe" │
         └────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  5. Usuário clica "Enviar NFSe"        │
         │     → Abre EnviarNfseFechamentoModal   │
         └────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  6. Upload do PDF para storage         │
         │     → Cria registro em rh_nfse         │
         │     → Atualiza payout.nfse_id          │
         └────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  7. Card verde "NFSe Enviada" aparece  │
         │     → Aguardando financeiro confirmar  │
         └────────────────────────────────────────┘
```

## Arquivos a Modificar

1. **Migração SQL** - Vincular user_id em massa
2. **`src/hooks/useMyEmployee.ts`** - Adicionar fallback por email

## Resultado Esperado

Após as correções:
- Cleiton Lima e todos os outros PJ poderão ver o card "Enviar NFSe"
- O botão aparecerá quando o fechamento estiver com status APPROVED
- Novos funcionários sem user_id também serão encontrados via email

