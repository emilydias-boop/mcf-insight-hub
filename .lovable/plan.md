
# Corrigir RLS para Usar auth.email() em Vez de Subquery

## Diagnóstico

A política RLS atual na tabela `sdr` usa uma subquery para buscar o email do usuário autenticado:

```sql
email = (SELECT email FROM auth.users WHERE id = auth.uid())
```

O problema é que a tabela `auth.users` tem **RLS habilitada**, o que bloqueia a subquery quando executada por usuários normais. Resultado: a condição sempre falha e Closers com `user_id = NULL` não conseguem ver seus dados.

## Solução

Substituir a subquery pela função `auth.email()` que lê o email diretamente do token JWT, sem acessar tabelas:

| Antes | Depois |
|-------|--------|
| `(SELECT email FROM auth.users WHERE id = auth.uid())` | `auth.email()` |

## Alterações Necessárias

### 1. Atualizar função `is_own_sdr`

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
        OR (user_id IS NULL AND email = auth.email())
      )
  )
$$;
```

### 2. Atualizar policy "SDRs podem ver seus próprios dados"

```sql
DROP POLICY IF EXISTS "SDRs podem ver seus próprios dados" ON public.sdr;

CREATE POLICY "SDRs podem ver seus próprios dados"
ON public.sdr FOR SELECT
USING (
  user_id = auth.uid()
  OR (user_id IS NULL AND email = auth.email())
);
```

## Resultado Esperado

Após a migração:
- Julio, Thayna e Cristiane poderão ver seus fechamentos
- A verificação por email funcionará corretamente (lê do JWT, não da tabela)
- Performance melhorada (sem subquery em tabela bloqueada)

## Seção Técnica

| Componente | Mudança |
|------------|---------|
| Função `is_own_sdr` | Trocar subquery por `auth.email()` |
| Policy `sdr` SELECT | Trocar subquery por `auth.email()` |
| Nova migração | 1 arquivo SQL |

A função `auth.email()` extrai o email diretamente do JWT claim, o que é:
- Mais rápido (sem query adicional)
- Mais seguro (não depende de RLS de outras tabelas)
- Garantido funcionar para qualquer usuário autenticado
