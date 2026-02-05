
# Plano: Criar Métricas Fevereiro 2026 para Todos os Cargos

## Diagnóstico

**Problema Identificado:** O mês de **Fevereiro 2026** está com métricas faltando para a maioria dos cargos. Apenas "SDR Consórcio N1" está configurado.

**Cargos sem métricas (aparecendo na imagem):**
| Cargo | ID | Funcionários Afetados |
|-------|----|-----------------------|
| SDR Inside N1 | d035345f-8fe3-41b4-8bba-28d0596c5bed | Carol Souza, Antony, Juliana, Julia Caroline, Vinicius, etc. |
| SDR Inside N2 | 9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad | Carol Correa |
| SDR Inside N5 | 997d5d36-cd94-4365-a5c1-85824c18c38d | Jessica Martins |
| SDR Consórcio N2 | 48f6d1ce-2fc3-47a0-859a-cfed0da32715 | Cleiton Lima |
| Closer Inside N1 | c2909e20-3bfc-4a9f-853f-97f065af099a | Cristiane Gomes, Julio |
| Closer Inside N2 | fd8d5a86-4687-4e89-b00d-84e7e5bcd563 | Thayna |

---

## Solução

Inserir as métricas para Fevereiro 2026 com os pesos definidos:

### Distribuição de Pesos

**SDRs:**
- **SDR Inside N1**: 35% Agendamentos / 35% Realizadas / 15% Tentativas / 15% Organização
- **SDR Inside N2/N5**: 40% Agendamentos / 40% Realizadas / 10% Tentativas / 10% Organização
- **SDR Consórcio N2**: 40% Agendamentos / 40% Realizadas / 20% Organização

**Closers:**
- **Closer Inside N1**: 85% Contratos / 15% Organização
- **Closer Inside N2**: 85% Contratos / 15% Organização

---

## SQL para Execução

Execute no [Supabase SQL Editor](https://supabase.com/dashboard/project/rehcfgqvigfcekiipqkc/sql/new):

```sql
-- ====================================
-- MÉTRICAS FEVEREIRO 2026
-- ====================================

-- 1. SDR Inside N1: 35% / 35% / 15% / 15%
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, ativo)
VALUES 
  ('2026-02', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'agendamentos', 'Agendamentos R1', 35.00, true),
  ('2026-02', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'realizadas', 'R1 Realizadas', 35.00, true),
  ('2026-02', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'tentativas', 'Tentativas de Ligação', 15.00, true),
  ('2026-02', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'organizacao', 'Organização', 15.00, true);

-- 2. SDR Inside N2: 40% / 40% / 10% / 10%
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, ativo)
VALUES 
  ('2026-02', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-02', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-02', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'tentativas', 'Tentativas de Ligação', 10.00, true),
  ('2026-02', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'organizacao', 'Organização', 10.00, true);

-- 3. SDR Inside N5: 40% / 40% / 10% / 10%
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, ativo)
VALUES 
  ('2026-02', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-02', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-02', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'tentativas', 'Tentativas de Ligação', 10.00, true),
  ('2026-02', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'organizacao', 'Organização', 10.00, true);

-- 4. SDR Consórcio N2: 40% / 40% / 20%
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, ativo)
VALUES 
  ('2026-02', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-02', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-02', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'organizacao', 'Organização', 20.00, true);

-- 5. Closer Inside N1: 85% / 15%
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual, ativo)
VALUES 
  ('2026-02', 'c2909e20-3bfc-4a9f-853f-97f065af099a', 'contratos', 'Contratos Pagos', 85.00, 30, true),
  ('2026-02', 'c2909e20-3bfc-4a9f-853f-97f065af099a', 'organizacao', 'Organização', 15.00, NULL, true);

-- 6. Closer Inside N2: 85% / 15%
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual, ativo)
VALUES 
  ('2026-02', 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563', 'contratos', 'Contratos Pagos', 85.00, 35, true),
  ('2026-02', 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563', 'organizacao', 'Organização', 15.00, NULL, true);
```

---

## Resultado Esperado

Após execução:

| Cargo | Total Peso | Métricas |
|-------|------------|----------|
| SDR Inside N1 | 100% | 4 métricas |
| SDR Inside N2 | 100% | 4 métricas |
| SDR Inside N5 | 100% | 4 métricas |
| SDR Consórcio N2 | 100% | 3 métricas |
| Closer Inside N1 | 100% | 2 métricas |
| Closer Inside N2 | 100% | 2 métricas |

Os indicadores no fechamento SDR (/fechamento-sdr) mostrarão os pesos corretamente e o "Valor Base" será calculado dinamicamente usando a fórmula: `(Variável Total × Peso %)`.

---

## Seção Técnica

### Campos Importantes

- **peso_percentual**: Define o peso do indicador no cálculo do variável
- **meta_percentual**: Usado para Closers - % de Realizadas que define a meta de contratos (ex: 30 = 30% das R1 Realizadas)
- **ativo**: Deve ser `true` para aparecer nos cálculos

### Query de Validação

Após inserção, verifique com:

```sql
SELECT 
  cc.nome_exibicao,
  SUM(fmm.peso_percentual) as total_peso,
  COUNT(*) as num_metricas
FROM fechamento_metricas_mes fmm
JOIN cargos_catalogo cc ON cc.id = fmm.cargo_catalogo_id
WHERE fmm.ano_mes = '2026-02' AND fmm.ativo = true
GROUP BY cc.nome_exibicao
ORDER BY cc.nome_exibicao;
```

Resultado esperado: todos os cargos com `total_peso = 100`.
