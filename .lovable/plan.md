
# Plano: Corrigir Conflito de Sobrecarga de Função

## Problema Identificado

O banco de dados possui **duas versões** da função `get_all_hubla_transactions` com assinaturas diferentes:

| Versão | p_start_date | p_end_date | id retorno |
|--------|--------------|------------|------------|
| Antiga | `text` | `text` | `text` |
| Nova | `timestamptz` | `timestamptz` | `uuid` |

Quando o hook chama a função passando strings de data (ex: `"2026-01-01T00:00:00-03:00"`), o PostgreSQL não consegue decidir qual função usar - ambas aceitam o valor como válido.

---

## Solução

Executar uma migração SQL para:

1. **Remover a versão antiga** da função (com parâmetros `text`)
2. **Manter apenas a versão nova** (com parâmetros `timestamptz`)

### SQL a Executar

```sql
-- Remover a versão antiga com assinatura text
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);
```

---

## Detalhes Técnicos

A versão antiga foi criada em migrações anteriores com tipo `text` para as datas. A migração mais recente criou uma nova versão com `timestamptz`, mas não removeu a antiga.

O hook `useAllHublaTransactions` passa datas como strings ISO, que podem ser interpretadas tanto como `text` quanto como `timestamptz`, causando a ambiguidade.

---

## Impacto Esperado

- A página de transações voltará a funcionar
- Apenas uma função existirá no banco
- Bruto Total mostrará o valor correto (~R$ 1.78M)
- Transações make duplicadas serão filtradas automaticamente

---

## Arquivos a Modificar

1. **Nova migração SQL** - DROP da função antiga com assinatura text
