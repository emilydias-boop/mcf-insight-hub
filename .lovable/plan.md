

# Separar SDRs e Closers no Config + Metas individuais de comissao

## Problema

1. **Aba SDRs mistura tudo**: A tab "SDRs" na config do consorcio mostra SDRs e Closers juntos, com coluna "Meta Diaria" que so faz sentido para SDRs. Closers precisam de meta de comissao consorcio (ex: Victoria = R$ 19M), nao meta diaria de reunioes.

2. **Meta de comissao hardcoded**: O recalculo usa `meta_comissao_consorcio = 2000` para todos os closers. Na planilha real, cada closer tem sua meta individual (ex: Victoria R$ 19.000 de comissao, Joao Pedro pode ter outro valor).

3. **Onde guardar a meta individual**: Hoje o `sdr_comp_plan` nao tem campo para `meta_comissao_consorcio`. A meta fica apenas no `consorcio_closer_payout` (por mes), mas sem lugar para configurar antecipadamente.

## Solucao

### 1. Migration: adicionar campos de meta ao sdr_comp_plan

Adicionar colunas opcionais ao `sdr_comp_plan`:
- `meta_comissao_consorcio NUMERIC` (meta de venda consorcio em R$)
- `meta_comissao_holding NUMERIC` (meta de venda holding em R$)

Isso permite que cada closer tenha sua meta individual configurada no plano de compensacao, junto com OTE/fixo/variavel.

### 2. Separar SDRs e Closers na aba de config

No `SdrConfigTab`, quando `squad = 'consorcio'`:
- Dividir a tabela em duas secoes: **SDRs** (role_type = 'sdr') e **Closers** (role_type = 'closer')
- SDRs mantem colunas atuais: Nome, Email, Nivel, Meta Diaria, Status, Ativo
- Closers mostram colunas diferentes: Nome, Email, Nivel, Meta Comissao Consorcio, Meta Comissao Holding, Status, Ativo
- Filtrar Supervisores/Coordenadores da secao de Closers (mesma logica do fechamento)

### 3. Formulario de edicao de Closer com campos de meta

No `EditSdrDialog`, quando o SDR for role_type = 'closer' e squad = 'consorcio':
- Mostrar campos de meta de comissao (consorcio e holding) em vez de meta diaria
- Salvar esses valores no registro do SDR ou no comp plan

### 4. Recalculo usa meta individual

No `useConsorcioFechamento.ts`, ao recalcular:
- Buscar `meta_comissao_consorcio` e `meta_comissao_holding` do `sdr_comp_plan` vigente
- Usar como meta individual em vez do hardcoded 2000/500
- Fallback para 2000/500 se nao configurado

## Arquivos alterados
1. **Migration SQL** — adicionar `meta_comissao_consorcio` e `meta_comissao_holding` ao `sdr_comp_plan`
2. `src/components/fechamento/SdrConfigTab.tsx` — separar tabelas SDR/Closer, colunas diferentes
3. `src/hooks/useConsorcioFechamento.ts` — buscar meta individual do comp plan no recalculo
4. `src/components/fechamento/EditIndividualPlanDialog.tsx` — adicionar campos de meta comissao para closers consorcio

## Resultado esperado
- Aba config mostra SDRs separados dos Closers
- Victoria aparece como Closer com meta R$ 19.000 (configuravel)
- Joao Pedro aparece como Closer com sua meta individual
- Luis Felipe/Thobson nao aparecem (filtrados por cargo)
- Recalculo do fechamento usa meta individual de cada closer

