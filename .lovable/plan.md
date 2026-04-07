

# Diagnóstico: Visibilidade do "Meu Fechamento" por SDRs/Closers

## Descobertas

A página `/meu-fechamento` funciona para a maioria dos casos, mas há **dois problemas de RLS** que afetam alguns colaboradores:

### Problema 1: `sdr_comp_plan` inacessível via email-only
A policy `SDRs podem ver seus próprios planos` usa apenas `sdr.user_id = auth.uid()`. Os **4 SDRs ativos sem `user_id`** (match por email) não conseguem ver seu comp plan. O hook `useOwnFechamento` busca o comp plan (linha 207), mas o banco retorna vazio.

**Impacto**: Comp plan não carrega para esses 4 SDRs. A view do fechamento ainda mostra valores do payout, mas informações do plano (OTE real, metas) ficam indisponíveis.

### Problema 2: `sdr_comp_plan` sem policy para `manager`
Managers não têm SELECT na `sdr_comp_plan`. Só `admin` e `coordenador` têm. Se um manager acessar a rota de fechamento de equipe, os comp plans não carregam.

### O que funciona corretamente
- **Tabela `sdr`**: Tem policy para `user_id = auth.uid()` **E** fallback para `email = auth.email()` -- OK
- **Tabela `sdr_month_payout`**: Usa `is_own_sdr(sdr_id)` que também checa email -- OK
- **Tabela `sdr_month_kpi`**: Usa `is_own_sdr(sdr_id)` -- OK
- **Tabela `closers`**: Qualquer autenticado pode ver -- OK
- **Tabela `consorcio_closer_payout`**: Qualquer autenticado pode ler -- OK
- **Tabela `rh_nfse`**: Vinculada a `employees.user_id` -- OK
- **Rota e sidebar**: Corretamente restritas a roles `sdr` e `closer` -- OK
- **DRAFT filtering**: Payouts DRAFT são ocultados corretamente -- OK

## Solução

### Migration SQL (1 arquivo)

1. **Atualizar policy de `sdr_comp_plan`** para SDRs -- usar `is_own_sdr()` em vez de check direto por `user_id`:

```sql
DROP POLICY "SDRs podem ver seus próprios planos" ON sdr_comp_plan;
CREATE POLICY "SDRs podem ver seus próprios planos"
  ON sdr_comp_plan FOR SELECT
  TO authenticated
  USING (is_own_sdr(sdr_id));
```

2. **Adicionar manager** à policy de SELECT do `sdr_comp_plan`:

```sql
DROP POLICY "Admins e coordenadores podem ver todos os planos" ON sdr_comp_plan;
CREATE POLICY "Admins coordenadores e managers podem ver todos os planos"
  ON sdr_comp_plan FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'coordenador') OR 
    has_role(auth.uid(), 'manager')
  );
```

### Nenhuma mudança de código necessária
O hook `useOwnFechamento` e os componentes de view já estão corretos. O problema é puramente de RLS.

## Resultado esperado
- Todos os SDRs/Closers (incluindo os 4 sem `user_id`) conseguem ver seu fechamento e comp plan
- Managers também conseguem acessar comp plans na visão de equipe

