

# Ajustar Nível e Meta de Contratos para Julio e Thayna - Março 2026

## Situação Atual

### Comp Plans
- **Julio** (21393c7b): N1 (fixo=4900, var=2100, ote=7000)
- **Thayna** (66a5a9ea): N2 com valores inconsistentes (fixo=6300, var=2700, ote=9000)

### Métricas de Contratos (fechamento_metricas_mes) - Março
- Closer N1: `meta_percentual = null` (fallback para 30% via genérico de Fev)
- Closer N2: `meta_percentual = null` (fallback para 35% via genérico de Fev)
- **Closer N3: NÃO EXISTE para Março** - precisa ser criado

### Problema
O `meta_percentual` dos contratos está null nas métricas de Março para closers. O sistema faz fallback para meses anteriores (genérico), mas para N3 não existe nenhum registro. Mesmo para N1/N2, o fallback depende de métricas genéricas (squad=null) de Fevereiro.

## Plano de Execução (2 partes)

### Parte 1: Dados nas métricas (fechamento_metricas_mes)

1. **Atualizar meta_percentual** nas métricas de Março existentes:
   - Closer N1 contratos (id: `19645a2a`): `meta_percentual = 30`
   - Closer N2 contratos (id: `5dd6255b`): `meta_percentual = 35`

2. **Criar métricas para Closer N3** (cargo `d7bdc06e`) em Março:
   - `contratos`: peso=50%, meta_percentual=40
   - `r2_agendadas`: peso=50% (copiar da N1/N2)

### Parte 2: Comp Plans (sdr_comp_plan)

**Julio → N2 somente em Março:**
- Fechar plano atual com `vigencia_fim = 2026-02-28`
- Criar plano N2 (cargo `fd8d5a86`): fixo=5600, var=2400, ote=8000, vigencia 2026-03-01 a 2026-03-31
- Criar plano N1 (cargo `c2909e20`): fixo=4900, var=2100, ote=7000, vigencia 2026-04-01 (restaurar)

**Thayna → N3 somente em Março:**
- Fechar plano atual com `vigencia_fim = 2026-02-28`
- Criar plano N3 (cargo `d7bdc06e`): fixo=6300, var=2700, ote=9000, vigencia 2026-03-01 a 2026-03-31
- Criar plano N2 (cargo `fd8d5a86`): fixo=5600, var=2400, ote=8000, vigencia 2026-04-01 (restaurar)

### Parte 3: Recalcular payouts

Chamar `recalculate-sdr-payout` para ambos em 2026-03. A Edge Function vai:
- Buscar o comp_plan vigente (agora N2 para Julio, N3 para Thayna)
- Buscar métricas do cargo correto (com meta_percentual preenchido)
- Calcular contratos como % das realizadas (35% e 40% respectivamente)

## Resultado

| Closer | Março | Meta Contratos | Abril+ |
|---|---|---|---|
| Julio | N2 (R$8.000 OTE) | 35% das Realizadas | N1 (R$7.000) |
| Thayna | N3 (R$9.000 OTE) | 40% das Realizadas | N2 (R$8.000) |
| Demais | N1 (R$7.000 OTE) | 30% das Realizadas | Sem alteração |

## Operações

Todas as alterações são de dados (INSERT/UPDATE), sem mudança de código. Serão executadas via tool de insert do Supabase.

