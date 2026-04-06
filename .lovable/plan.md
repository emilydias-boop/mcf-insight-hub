

# Propagar alteração do Fixo do Cargo para o Fechamento

## Problema

O fluxo de dados é: **Cargo (cargos_catalogo)** → **Comp Plan (sdr_comp_plan)** → **Payout (consorcio_closer_payout)**

Quando voce alterou o fixo do cargo de R$ 3.200 para R$ 3.150, isso so atualizou o `cargos_catalogo`. O `sdr_comp_plan` do Cleiton continua com R$ 3.200, e o payout (que lê do comp plan) tambem.

Para o valor chegar no fechamento, é preciso:
1. Sincronizar o comp plan com o novo valor do cargo
2. Recalcular o payout

## Solução

### Arquivo 1: `src/hooks/useConsorcioFechamento.ts`

Na funcao `useRecalculateConsorcioPayouts`, alem de buscar o comp plan, tambem buscar o cargo atualizado do `cargos_catalogo` como fallback. Se nao houver comp plan, usar os valores do cargo diretamente. Isso já acontece parcialmente (fallback para OTE_PADRAO), mas deveria buscar do cargo real.

### Arquivo 2: `src/components/fechamento/PlansOteTab.tsx`

O sistema de Planos OTE do Incorporador ja tem um botão "Sincronizar com Cargo" que detecta divergência entre comp plan e cargo e oferece atualização em massa. Esse mecanismo ja existe — o usuario precisa ir na aba "Planos OTE" da config do Consórcio e clicar "Sincronizar" para propagar o novo fixo do cargo para os comp plans.

### Arquivo 3: Alternativa mais direta — Auto-sync no recalculo

Modificar `useRecalculateConsorcioPayouts` para, quando o comp plan existir mas estiver desatualizado em relacao ao cargo, usar os valores do cargo. Adicionar busca ao `cargos_catalogo` via `cargo_catalogo_id` do employee:

```text
Fluxo atual:   comp_plan.fixo_valor → payout.fixo_valor (ignora cargo atualizado)
Fluxo novo:    cargo atualizado? → atualiza comp_plan → payout.fixo_valor
```

Concretamente:
- Buscar `cargos_catalogo` do employee (via `cargo_catalogo_id`)
- Se `comp_plan.fixo_valor !== cargo.fixo_valor`, atualizar o comp plan automaticamente no recalculo
- Isso garante que ao clicar "Recalcular" no fechamento, os valores do cargo mais recente são usados

## Arquivos alterados
1. `src/hooks/useConsorcioFechamento.ts` — buscar cargo atualizado e sincronizar comp plan no recalculo

## Resultado esperado
- Após alterar o cargo para R$ 3.150 e clicar "Recalcular" no fechamento, o fixo atualiza para R$ 3.150
- O comp plan tambem é atualizado automaticamente para manter consistência

