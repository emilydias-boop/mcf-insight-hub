

# Plano: Solução Definitiva para Métricas de Todos os Meses

## Diagnóstico Completo

### Problemas Identificados

**Janeiro 2026:**
- Métricas duplicadas para vários cargos
- Pesos errados (ex: SDR Consórcio N2 com 35%/55%/10% ao invés de 40%/40%/20%)
- Closer Inside N1/N2 com registros duplicados e conflitantes

**Fevereiro 2026:**
- Apenas SDR Consórcio N1 configurado
- Todos os outros cargos sem métricas

**Meses Futuros:**
- Nenhum mecanismo automático para copiar configurações

---

## Solução em 3 Partes

### Parte 1: Criar Tabela de Templates Padrão

Nova tabela `cargo_metricas_padrao` que define a configuração padrão por cargo. Esta tabela serve como "fonte da verdade" para novos meses.

**Estrutura:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| cargo_catalogo_id | UUID | Referência ao cargo |
| nome_metrica | text | Nome da métrica |
| label_exibicao | text | Label para UI |
| peso_percentual | numeric | Peso % |
| meta_percentual | numeric | Meta % (para Closers) |

### Parte 2: Hook com Auto-Copy

Modificar `useActiveMetricsForSdr` para implementar fallback hierárquico:

```text
1. Buscar métricas do mês atual
2. Se não existir → Copiar do mês anterior automaticamente
3. Se mês anterior não existir → Usar template padrão (cargo_metricas_padrao)
4. Se template não existir → Usar fallback hardcoded
```

### Parte 3: Correção de Dados

Limpar e recriar métricas para Janeiro e Fevereiro 2026.

---

## Implementação Detalhada

### 1. Nova Tabela `cargo_metricas_padrao`

```sql
CREATE TABLE cargo_metricas_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_catalogo_id UUID REFERENCES cargos_catalogo(id),
  nome_metrica TEXT NOT NULL,
  label_exibicao TEXT NOT NULL,
  peso_percentual NUMERIC(5,2) NOT NULL DEFAULT 25,
  meta_percentual NUMERIC(5,2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cargo_catalogo_id, nome_metrica)
);
```

### 2. Dados dos Templates

**SDR Inside N1:** 35% / 35% / 15% / 15%
**SDR Inside N2-N7:** 40% / 40% / 10% / 10%
**SDR Consórcio N1:** 40% / 40% / 20% (sem tentativas)
**SDR Consórcio N2-N7:** 40% / 40% / 20% (sem tentativas)
**Closer Inside N1:** 85% Contratos (meta 30%) / 15% Organização
**Closer Inside N2:** 85% Contratos (meta 35%) / 15% Organização

### 3. Lógica de Auto-Copy no Hook

Arquivo: `src/hooks/useActiveMetricsForSdr.ts`

Adicionar função que:
1. Verifica se existem métricas para o mês/cargo
2. Se não existir, busca do mês anterior
3. Se não existir, busca do template padrão
4. Copia automaticamente para o mês atual (INSERT)

### 4. Correção Janeiro/Fevereiro 2026

```sql
-- 1. Deletar métricas problemáticas
DELETE FROM fechamento_metricas_mes 
WHERE ano_mes IN ('2026-01', '2026-02');

-- 2. Inserir métricas corretas para ambos os meses
-- (script completo com todos os cargos)
```

---

## Distribuição de Pesos Final

| Cargo | Agendamentos | Realizadas | Tentativas | Organização | Contratos |
|-------|-------------|------------|------------|-------------|-----------|
| SDR Inside N1 | 35% | 35% | 15% | 15% | - |
| SDR Inside N2-N7 | 40% | 40% | 10% | 10% | - |
| SDR Consórcio N1-N7 | 40% | 40% | - | 20% | - |
| Closer Inside N1 | - | - | - | 15% | 85% (meta 30%) |
| Closer Inside N2 | - | - | - | 15% | 85% (meta 35%) |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration | Criar tabela `cargo_metricas_padrao` + dados |
| `src/hooks/useActiveMetricsForSdr.ts` | Adicionar lógica de auto-copy |
| `src/hooks/useFechamentoMetricas.ts` | Hook para buscar templates |
| Migration de dados | Corrigir Jan/Fev 2026 |

---

## Benefícios

1. **Nunca mais** precisará configurar métricas manualmente para novos meses
2. **Um único lugar** para definir pesos padrão por cargo
3. **Retrocompatível** - não afeta meses já configurados corretamente
4. **Flexível** - ainda permite customização por mês se necessário

---

## Seção Técnica

### Fluxo de Resolução de Métricas

```text
useActiveMetricsForSdr(sdrId, '2026-03')
    │
    ├─► Busca métricas em fechamento_metricas_mes para '2026-03'
    │       │
    │       └─► Encontrou? → Retorna
    │
    ├─► Não encontrou → Busca mês anterior '2026-02'
    │       │
    │       └─► Encontrou? → Copia para '2026-03' e Retorna
    │
    ├─► Não encontrou → Busca template em cargo_metricas_padrao
    │       │
    │       └─► Encontrou? → Copia para '2026-03' e Retorna
    │
    └─► Fallback hardcoded (DEFAULT_SDR_METRICS / DEFAULT_CLOSER_METRICS)
```

### Query de Validação

Após implementação, todos os cargos devem ter métricas para qualquer mês consultado:

```sql
SELECT 
  cc.nome_exibicao,
  fmm.ano_mes,
  SUM(fmm.peso_percentual) as total_peso,
  COUNT(*) as num_metricas
FROM fechamento_metricas_mes fmm
JOIN cargos_catalogo cc ON cc.id = fmm.cargo_catalogo_id
WHERE fmm.ativo = true
GROUP BY cc.nome_exibicao, fmm.ano_mes
HAVING SUM(fmm.peso_percentual) = 100
ORDER BY fmm.ano_mes DESC, cc.nome_exibicao;
```

