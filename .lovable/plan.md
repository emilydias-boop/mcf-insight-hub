
# Plano: Corrigir Visibilidade de Pipelines para SDRs do Consórcio

## Problema Identificado

Os SDRs do Consórcio, como o Cleiton Lima, estão visualizando apenas uma pipeline fixa porque o sistema está direcionando-os para uma origem incorreta:

**Situação Atual:**
- O SDR tem a BU `consorcio` configurada no perfil ✓
- O código busca a origem padrão em `SDR_ORIGIN_BY_BU['consorcio']`
- Essa constante aponta para `PIPELINE - INSIDE SALES - VIVER DE ALUGUEL` (ID: `4e2b210a-...`)
- **Porém**, essa origem pertence ao grupo **Perpétuo - X1** que é da BU **Incorporador**!

**Origem Correta para Consórcio:**
- `PIPE LINE - INSIDE SALES` (ID: `57013597-22f6-4969-848c-404b81dcc0cb`)
- Grupo: **Perpétuo - Construa para Alugar** (mapeado corretamente para consorcio)
- Já possui 8 estágios configurados no Kanban

---

## Solução Proposta

### 1. Atualizar Constante `SDR_ORIGIN_BY_BU` no Frontend

**Arquivo:** `src/components/auth/NegociosAccessGuard.tsx`

Corrigir o mapeamento para apontar para a origem correta:

```
SDR_ORIGIN_BY_BU = {
  incorporador: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',  // (mantém)
  consorcio: '57013597-22f6-4969-848c-404b81dcc0cb',     // CORRIGIR: PIPE LINE - INSIDE SALES (grupo Consórcio)
  credito: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  projetos: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  leilao: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
}
```

### 2. Adicionar Origem ao Mapeamento do Banco de Dados

**Ação:** Inserir registro na tabela `bu_origin_mapping` para que a origem padrão do Consórcio fique registrada oficialmente.

```sql
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default)
VALUES ('consorcio', 'origin', '57013597-22f6-4969-848c-404b81dcc0cb', true)
ON CONFLICT DO NOTHING;
```

### 3. Atualizar `BU_DEFAULT_ORIGIN_MAP` para Consistência

Garantir que a origem padrão usada por não-SDRs também esteja correta:

```
BU_DEFAULT_ORIGIN_MAP = {
  incorporador: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  consorcio: '57013597-22f6-4969-848c-404b81dcc0cb',     // CORRIGIR para mesma origem
  credito: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  projetos: 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  leilao: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
}
```

---

## Detalhes Técnicos

### Mapeamento de IDs Corretos

| BU | Origem Padrão SDR | Grupo Pai |
|---|---|---|
| incorporador | `e3c04f21-...` (PIPELINE INSIDE SALES) | Perpétuo - X1 |
| **consorcio** | **`57013597-...` (PIPE LINE - INSIDE SALES)** | **Perpétuo - Construa para Alugar** |
| leilao | `a1b2c3d4-...` (Pipeline Leilão) | BU - LEILÃO |

### Fluxo Atual do Código

```
Negocios.tsx
  └─ useActiveBU() → 'consorcio'
  └─ isSdrRole() → true
  └─ SDR_ORIGIN_BY_BU['consorcio'] → '4e2b210a...' ← ERRADO!
      └─ Pertence ao grupo 'Perpétuo - X1' (Incorporador)
```

### Fluxo Corrigido

```
Negocios.tsx
  └─ useActiveBU() → 'consorcio'
  └─ isSdrRole() → true
  └─ SDR_ORIGIN_BY_BU['consorcio'] → '57013597...' ← CORRETO
      └─ Pertence ao grupo 'Perpétuo - Construa para Alugar' (Consórcio)
```

---

## Arquivos a Modificar

1. **`src/components/auth/NegociosAccessGuard.tsx`**
   - Atualizar `SDR_ORIGIN_BY_BU.consorcio`
   - Atualizar `BU_DEFAULT_ORIGIN_MAP.consorcio`

2. **Migração SQL** (opcional mas recomendado)
   - Inserir origem padrão no `bu_origin_mapping`

---

## Resultado Esperado

Após a correção:
- SDRs do Consórcio verão o Kanban da pipeline "PIPE LINE - INSIDE SALES"
- Os estágios corretos aparecerão: Novo Lead, Lead Qualificado, Reunião 01 Agendada, etc.
- O filtro de BU funcionará corretamente para isolar os dados do Consórcio
