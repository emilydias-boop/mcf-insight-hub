
# Plano: Correção de Inconsistências de Dados entre Telas

## Diagnóstico Identificado

O sistema possui **3 fontes de dados diferentes** que não estão sincronizadas:

| Tela | Fonte de Dados | Filtro Usado |
|------|---------------|--------------|
| Fechamento → Closers | Tabela `closers` | `bu = 'consorcio'` |
| Fechamento → SDRs | Tabela `sdr` | `squad = 'consorcio'` |
| Configurações → Equipe | Tabela `employees` | `departamento = 'BU - Consórcio'` |

## Problemas por Pessoa

### 1. Victoria Paz
- **Aparece em**: Fechamento (Closers), Agenda
- **NÃO aparece em**: Configurações (Equipe)
- **Causa**: Departamento cadastrado como `"Consorcio"` em vez de `"BU - Consórcio"`
- **Solução**: Atualizar departamento no RH

### 2. Luis Felipe de Souza
- **Aparece em**: Fechamento (Closers), Agenda
- **NÃO aparece em**: Configurações (Equipe)
- **Causa**: Não possui cadastro na tabela `employees`
- **Solução**: Criar registro no módulo RH

### 3. Ithaline Clara
- **Aparece em**: Configurações (Equipe)
- **NÃO aparece em**: Fechamento (SDRs)
- **Causa**: Não possui registro na tabela `sdr` (sdr_id = null)
- **Solução**: Cadastrar como SDR em `/fechamento-sdr/configuracoes`

### 4. Cleiton Lima
- **Status**: OK - aparece em todas as telas corretas

## Solução Proposta

### Opção A: Correções Manuais (Recomendada - Rápida)

Fazer as correções diretamente no banco/interface:

1. **Victoria**: Atualizar departamento de "Consorcio" para "BU - Consórcio" no RH
2. **Luis Felipe**: Criar cadastro de employee no RH
3. **Ithaline**: Cadastrar na tabela SDR via Configurações → SDRs

### Opção B: Implementar Validação Automática (Melhoria de Longo Prazo)

Adicionar verificação na página de Configurações que detecta e alerta sobre:
- Closers do consórcio sem cadastro no RH
- Employees sem registro na tabela SDR (quando cargo é SDR)
- Departamentos com nomes inconsistentes

## Correções de Dados (SQL)

```sql
-- 1. Corrigir departamento da Victoria
UPDATE employees 
SET departamento = 'BU - Consórcio'
WHERE id = 'e58b2a55-5ea3-4cf6-a3a4-18436015e77e';

-- 2. Luis Felipe precisa ser cadastrado manualmente no RH
-- (não há como automatizar sem mais informações)

-- 3. Ithaline precisa ser cadastrada na tabela SDR
-- Isso pode ser feito via interface em /fechamento-sdr/configuracoes
```

## Resultado Esperado

Após as correções:

| Pessoa | Fechamento Closers | Fechamento SDRs | Config Equipe | Agenda |
|--------|-------------------|-----------------|---------------|--------|
| Victoria Paz | ✅ | - | ✅ | ✅ |
| Luis Felipe | ✅ | - | ✅ | ✅ |
| Thobson | ✅ | - | ✅ | ✅ |
| João Pedro | ✅ | - | ✅ | ✅ |
| Cleiton Lima | - | ✅ | ✅ | - |
| Ithaline | - | ✅ | ✅ | - |

## Próximos Passos

1. Corrigir o departamento da Victoria (pode ser feito via SQL ou RH)
2. Cadastrar Luis Felipe no módulo RH
3. Cadastrar Ithaline na tabela SDR via Configurações
4. (Opcional) Implementar validação automática para evitar inconsistências futuras
