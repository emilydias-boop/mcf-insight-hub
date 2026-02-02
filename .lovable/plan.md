
# Plano: Corrigir Exibição de Métricas de Closer na Página de Detalhe

## Problema Identificado

Quando você configura as métricas do **Closer Inside** na aba "Métricas Ativas", a página de detalhe individual ainda mostra métricas de SDR (Tentativas, Organização) porque:

**Causa raiz**: A consulta SQL `useSdrPayoutDetail` não está buscando o campo `role_type` da tabela `sdr`, então a verificação `isCloser = (payout.sdr)?.role_type === 'closer'` sempre retorna `false`.

**Código atual (linha 246):**
```
sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, ...)
```
**Faltando:** `squad, role_type`

---

## Solução

Adicionar os campos `squad` e `role_type` nas consultas SQL que buscam dados do SDR para a página de detalhe.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSdrFechamento.ts` | Adicionar `squad, role_type` nas funções `useSdrPayoutDetail` e `useOwnPayout` |

---

## Alterações Técnicas

### Função `useSdrPayoutDetail` (linha 244-252)

**Antes:**
```typescript
sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, observacao, status, criado_por, aprovado_por, aprovado_em, created_at, updated_at)
```

**Depois:**
```typescript
sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, observacao, status, criado_por, aprovado_por, aprovado_em, created_at, updated_at, squad, role_type)
```

### Função `useOwnPayout` (linha 280-283)

**Antes:**
```typescript
sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, observacao, status, criado_por, aprovado_por, aprovado_em, created_at, updated_at)
```

**Depois:**
```typescript
sdr:sdr_id(id, user_id, name, email, active, nivel, meta_diaria, observacao, status, criado_por, aprovado_por, aprovado_em, created_at, updated_at, squad, role_type)
```

---

## Fluxo da Correção

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ANTES DA CORREÇÃO                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário abre detalhe do Julio (Closer Inside)               │
│  2. useSdrPayoutDetail busca dados SEM role_type                │
│  3. payout.sdr.role_type = undefined                            │
│  4. isCloser = false                                            │
│  5. Exibe indicadores de SDR (errado!)                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    DEPOIS DA CORREÇÃO                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário abre detalhe do Julio (Closer Inside)               │
│  2. useSdrPayoutDetail busca dados COM role_type                │
│  3. payout.sdr.role_type = "closer"                             │
│  4. isCloser = true                                             │
│  5. Exibe CloserIndicators (correto!)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após a correção, quando você abrir o fechamento do **Julio Caetano (Closer Inside)**:

| Antes (Errado) | Depois (Correto) |
|----------------|------------------|
| Reuniões Agendadas | Reuniões Alocadas |
| Reuniões Realizadas | R1 Realizadas |
| Tentativas de Ligação | Contratos Pagos |
| Organização Clint | Taxa de Conversão |
| No-Show | No-Show |
| - | R2 Agendadas |

O formulário de KPI também já oculta os campos de Tentativas e Organização para Closers (isso já está funcionando, só faltava o `role_type` ser carregado).

---

## Impacto

- **Baixo risco**: Apenas adiciona campos à consulta SQL
- **Sem breaking changes**: O código que usa esses dados já existe e espera esses campos
- **Benefício imediato**: Julio e outros Closers passarão a ver métricas corretas
