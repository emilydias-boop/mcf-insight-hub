
# Usar Meta Ajustada do Banco de Dados

## Problema Encontrado

O valor "171" está sendo **recalculado** a cada exibição, ignorando o campo `meta_agendadas_ajustada` que já existe no banco de dados.

| Componente | Lógica Atual | Deveria Ser |
|------------|--------------|-------------|
| DynamicIndicatorCard | `sdrMetaDiaria × diasUteisMes` | `payout.meta_agendadas_ajustada` |
| CloserIndicators | `payout.meta_agendadas_ajustada` | Já está correto |

## Solução

Modificar o `DynamicIndicatorCard` para usar o valor salvo no banco (`payout.meta_agendadas_ajustada`) como prioridade, igual ao `CloserIndicators`.

### Código Atual (linha 145-147)
```typescript
if (metrica.nome_metrica === 'agendamentos') {
  meta = sdrMetaDiaria;
  metaAjustada = compPlan?.meta_reunioes_agendadas || (sdrMetaDiaria * diasUteisMes);
}
```

### Código Novo
```typescript
if (metrica.nome_metrica === 'agendamentos') {
  meta = sdrMetaDiaria;
  // Prioridade: valor salvo no payout > compPlan > cálculo dinâmico
  metaAjustada = (payout as any).meta_agendadas_ajustada 
    || compPlan?.meta_reunioes_agendadas 
    || (sdrMetaDiaria * diasUteisMes);
}
```

## Resultado Esperado

Após essa mudança:
- O "Editar KPIs" salva `meta_agendadas_ajustada = 180` no banco
- O "Indicadores de Meta" exibe **180** (lido do banco)
- Ambos ficam sincronizados

## Arquivo a Alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Linha 147: adicionar prioridade para `payout.meta_agendadas_ajustada` |

## Resumo

Apenas **1 linha** precisa ser alterada para que o valor 180 (salvo pelo "Editar KPIs") apareça corretamente nos "Indicadores de Meta".
