

# Plano: Permitir Closers Multi-BU (Corrigir Constraint de Email)

## Problema Identificado

A tabela `closers` possui uma constraint **`UNIQUE (email)`** que impede cadastrar o mesmo usuário em múltiplas Business Units ou tipos de reunião.

**Situação atual de Thobson:**
- Email: `thobson.motta@minhacasafinanciada.com`
- BU: `incorporador`
- Meeting Type: `r2`

**O que você quer fazer:**
- Adicionar Thobson também no **Consórcio** para R1

Isso falha porque o email precisa ser único globalmente.

---

## Solução Proposta

Alterar a constraint de `UNIQUE (email)` para `UNIQUE (email, bu)`, permitindo:
- O mesmo closer em BUs diferentes
- Cada combinação email+bu é única

### Cenários Permitidos Após Correção:

| Email | BU | Meeting Type | Permitido |
|-------|-----|--------------|-----------|
| thobson@... | incorporador | r2 | Sim |
| thobson@... | consorcio | r1 | Sim (NOVO!) |
| luis@... | consorcio | r1 | Sim |
| luis@... | incorporador | r1 | Sim |
| thobson@... | consorcio | r1 | Erro (duplicado) |

---

## Alterações Necessárias

### 1. Migração de Banco de Dados

```sql
-- Remover constraint antiga
ALTER TABLE closers DROP CONSTRAINT closers_email_key;

-- Criar nova constraint composta (email + bu)
ALTER TABLE closers ADD CONSTRAINT closers_email_bu_unique UNIQUE (email, bu);
```

### 2. Validação no Frontend (Opcional)

Adicionar verificação no `CloserFormDialog` para mostrar mensagem mais amigável caso já exista um closer com mesmo email+bu.

---

## Impacto

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Mesmo closer em BUs diferentes | Não permitido | Permitido |
| Sincronização cross-BU | Via employee_id | Mantém via employee_id |
| Dados existentes | Não afetados | Não afetados |

---

## Resumo Técnico

| Tipo | Alteração |
|------|-----------|
| **Migração SQL** | Trocar `UNIQUE(email)` por `UNIQUE(email, bu)` |
| **Frontend** | Melhorar mensagem de erro (opcional) |

---

## Fluxo Após Correção

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Admin cadastra Thobson no Consórcio                                │
│  1. Seleciona: Thobson Motta                                        │
│  2. BU: Consórcio                                                   │
│  3. Sistema verifica: existe (thobson@..., consorcio)? NÃO          │
│  4. INSERT bem-sucedido                                             │
│  5. Thobson agora aparece em AMBAS as agendas:                      │
│     - Incorporador R2 (registro existente)                          │
│     - Consórcio R1 (novo registro)                                  │
└─────────────────────────────────────────────────────────────────────┘
```

