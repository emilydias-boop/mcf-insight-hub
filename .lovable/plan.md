
# Plano: Arredondar Pesos dos Indicadores no Fechamento

## Situação Atual

Os pesos dos indicadores na tabela `fechamento_metricas_mes` estão com valores decimais "quebrados" que dificultam a visualização e compreensão:

| Cargo | Métrica | Peso Atual | Peso Sugerido |
|-------|---------|------------|---------------|
| SDR N1 Incorporador | R1 Realizadas | 35.19% | **35%** |
| SDR N1 Incorporador | Agendamentos R1 | 35.19% | **35%** |
| SDR N1 Incorporador | Tentativas | 14.81% | **15%** |
| SDR N1 Incorporador | Organização | 14.81% | **15%** |
| SDR N2 Incorporador | R1 Realizadas | 38.89% | **40%** |
| SDR N2 Incorporador | Agendamentos R1 | 38.89% | **40%** |
| SDR N2 Incorporador | Organização | 11.11% | **10%** |
| SDR N2 Incorporador | Tentativas | 11.11% | **10%** |

Obs: Consórcio e Closer já possuem pesos arredondados (55%, 35%, 45%, 40%, 10%, 5%).

---

## Alterações Necessárias

### 1. Atualizar dados no banco via SQL Migration

Criar uma migration para atualizar os pesos na tabela `fechamento_metricas_mes`:

```sql
-- Arredondar pesos para SDR N1 Incorporador (cargo_catalogo_id = '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad')
UPDATE fechamento_metricas_mes 
SET peso_percentual = 35.00 
WHERE cargo_catalogo_id = '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad' 
  AND nome_metrica IN ('agendamentos', 'realizadas')
  AND peso_percentual = 35.19;

UPDATE fechamento_metricas_mes 
SET peso_percentual = 15.00 
WHERE cargo_catalogo_id = '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad' 
  AND nome_metrica IN ('tentativas', 'organizacao')
  AND peso_percentual = 14.81;

-- Arredondar pesos para SDR N2 Incorporador (cargo_catalogo_id = '997d5d36-cd94-4365-a5c1-85824c18c38d')
UPDATE fechamento_metricas_mes 
SET peso_percentual = 40.00 
WHERE cargo_catalogo_id = '997d5d36-cd94-4365-a5c1-85824c18c38d' 
  AND nome_metrica IN ('agendamentos', 'realizadas')
  AND peso_percentual = 38.89;

UPDATE fechamento_metricas_mes 
SET peso_percentual = 10.00 
WHERE cargo_catalogo_id = '997d5d36-cd94-4365-a5c1-85824c18c38d' 
  AND nome_metrica IN ('tentativas', 'organizacao')
  AND peso_percentual = 11.11;
```

### 2. Verificar soma dos pesos = 100%

Após arredondamento:

| Cargo | Soma dos Pesos |
|-------|----------------|
| SDR N1 Incorporador | 35 + 35 + 15 + 15 = **100%** |
| SDR N2 Incorporador | 40 + 40 + 10 + 10 = **100%** |

---

## Arquivos Afetados

Nenhuma alteração de código é necessária. Apenas a atualização dos dados na tabela `fechamento_metricas_mes`.

Os componentes que exibem o peso (`DynamicIndicatorCard.tsx`, linha 202) já mostram o valor diretamente da tabela:
```typescript
Peso: {metrica.peso_percentual}%
```

---

## Resultado Esperado

Após a migration:
- SDR N1 Incorporador: 35% / 35% / 15% / 15% (soma = 100%)
- SDR N2 Incorporador: 40% / 40% / 10% / 10% (soma = 100%)
- Todos os indicadores exibirão pesos arredondados na interface

---

## Decisão Pendente

Antes de implementar, confirme os pesos desejados:

**SDR Nível 1:**
- Opção A: 35% / 35% / 15% / 15%
- Opção B: 40% / 40% / 10% / 10%

**SDR Nível 2:**
- Opção A: 40% / 40% / 10% / 10%
- Opção B: 45% / 45% / 5% / 5%

Qual distribuição você prefere para cada nível?
