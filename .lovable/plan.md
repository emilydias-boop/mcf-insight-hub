

# Corrigir Fechamento Consorcio: Fixo errado e coordenadores aparecendo

## Problemas identificados

**1. Valor fixo diferente do planejado**
O recalculo usa `OTE_PADRAO_CONSORCIO` fixo (OTE=5000, fixo=3500, variavel=1500) para TODOS os closers, ignorando os planos individuais em `sdr_comp_plan`. Exemplo:
- Joao Pedro: plano real OTE=7000, fixo=4900. Recebe fixo=3500 (errado)
- Victoria: plano real OTE=7000, fixo=4900. Recebe fixo=3500 (errado)

**2. Luis Felipe e Thobson aparecem**
A query busca `closers WHERE bu='consorcio' AND is_active=true` sem filtrar cargo. Luis Felipe e Supervisor e Thobson e Closer R2 — nenhum dos dois deveria aparecer no fechamento de closers.

## Solucao

### Arquivo: `src/hooks/useConsorcioFechamento.ts`

Na funcao `useRecalculateConsorcioPayouts`:

**Filtrar coordenadores:**
- Apos buscar closers, buscar o `sdr` correspondente (via email) para cada closer
- Com o `sdr_id`, buscar o `employee` vinculado
- Excluir closers cujo cargo no `employees` seja `Supervisor`, `Closer R2`, `Coordenador` ou `ADMIN`

**Usar OTE do comp plan individual:**
- Para cada closer, buscar o `sdr_comp_plan` vigente (via sdr_id vinculado por email)
- Se existir plano aprovado/pending para o mes, usar OTE/fixo/variavel dele
- Se nao existir, usar `OTE_PADRAO_CONSORCIO` como fallback

Fluxo revisado do recalculo:
1. Buscar closers ativos do consorcio
2. Para cada closer, encontrar o `sdr` correspondente (match por email)
3. Com o `sdr_id`, buscar employee para verificar cargo
4. Filtrar Supervisores e Closer R2
5. Buscar `sdr_comp_plan` vigente para obter OTE real
6. Calcular com os valores corretos

## Resultado esperado
- Joao Pedro e Victoria: fixo=4900 (correto, do comp plan)
- Luis Felipe e Thobson: removidos da lista de closers
- Closers sem comp plan individual: usam OTE padrao como fallback

## Arquivo alterado
1. `src/hooks/useConsorcioFechamento.ts` — recalculo com OTE individual e filtro de cargo

