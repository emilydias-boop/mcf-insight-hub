
# Corrigir Visibilidade do Fechamento para Closers

## Diagnóstico

Os usuários **Julio** e **Thayna** não conseguem ver seus fechamentos porque:

| Usuário | user_id na tabela SDR | Email Coincide |
|---------|----------------------|----------------|
| Julio | NULL ❌ | ✅ julio.caetano@minhacasafinanciada.com |
| Thayna | NULL ❌ | ✅ thaynar.tavares@minhacasafinanciada.com |
| Cristiane | ✅ Vinculado | ✅ |

A política RLS atual na tabela `sdr` só permite acesso via `user_id = auth.uid()`. Como o `user_id` está NULL, a condição falha e o registro não é retornado.

## Solução Proposta

Adicionar fallback por email nas políticas RLS e na função helper `is_own_sdr`.

### Alteração 1: Atualizar RLS da tabela `sdr`

Modificar a policy "SDRs podem ver seus próprios dados" para também verificar por email:

```sql
-- Remover policy antiga
DROP POLICY IF EXISTS "SDRs podem ver seus próprios dados" ON public.sdr;

-- Criar nova policy com fallback por email
CREATE POLICY "SDRs podem ver seus próprios dados"
ON public.sdr FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    user_id IS NULL 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);
```

### Alteração 2: Atualizar função `is_own_sdr`

A função é usada nas policies de outras tabelas (sdr_comp_plan, sdr_month_payout, etc.):

```sql
CREATE OR REPLACE FUNCTION public.is_own_sdr(_sdr_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sdr
    WHERE id = _sdr_id 
      AND (
        user_id = auth.uid()
        OR (
          user_id IS NULL 
          AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      )
  )
$$;
```

### Alteração 3: Atualizar RLS da tabela `sdr_month_payout`

Garantir que a policy também funcione com o fallback:

```sql
DROP POLICY IF EXISTS "SDRs podem ver seus próprios payouts" ON public.sdr_month_payout;

CREATE POLICY "SDRs podem ver seus próprios payouts"
ON public.sdr_month_payout FOR SELECT
USING (is_own_sdr(sdr_id));
```

## Arquivo a Criar

**Arquivo:** `supabase/migrations/YYYYMMDDHHMMSS_fix_sdr_email_fallback_rls.sql`

```sql
-- Corrigir função is_own_sdr para fallback por email
CREATE OR REPLACE FUNCTION public.is_own_sdr(_sdr_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sdr
    WHERE id = _sdr_id 
      AND (
        user_id = auth.uid()
        OR (
          user_id IS NULL 
          AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      )
  )
$$;

-- Atualizar policy da tabela sdr
DROP POLICY IF EXISTS "SDRs podem ver seus próprios dados" ON public.sdr;

CREATE POLICY "SDRs podem ver seus próprios dados"
ON public.sdr FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    user_id IS NULL 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);
```

## Resultado Esperado

Após aplicar a migração:
- Julio, Thayna e Cristiane poderão acessar `/meu-fechamento`
- Cada um verá apenas seu próprio fechamento
- A segurança é mantida (usuários só veem dados onde email OU user_id coincide)
- Não requer vincular manualmente o user_id

## Seção Técnica

| Componente | Mudança |
|------------|---------|
| Função `is_own_sdr` | Adicionar OR com verificação de email |
| Policy `sdr` SELECT | Adicionar fallback por email quando user_id é NULL |
| Nova migração | 1 arquivo SQL com as alterações |

A solução é retrocompatível - registros com `user_id` preenchido continuam funcionando normalmente.
