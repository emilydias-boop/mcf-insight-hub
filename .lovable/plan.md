

# Correção: Erro PGRST203 - Ambiguidade de Função

## Problema Identificado

O erro ocorre porque existem **duas versões** da função `get_all_hubla_transactions` no banco de dados:

| Versão | Parâmetros |
|--------|------------|
| Antiga | `p_search, p_start_date, p_end_date, p_limit` |
| Nova | `p_search, p_start_date, p_end_date, p_limit, p_products` |

Quando o `useIncorporadorGrossMetrics` chama a função sem `p_products`, o PostgREST não sabe qual versão usar.

---

## Solução

Atualizar o hook `useIncorporadorGrossMetrics.ts` para incluir o parâmetro `p_products: null` em todas as chamadas, garantindo que o PostgREST escolha a versão correta.

---

## Alterações

### Arquivo: `src/hooks/useIncorporadorGrossMetrics.ts`

Atualizar as 3 chamadas ao RPC para incluir `p_products: null`:

```text
// ANTES (linha 48-52)
supabase.rpc('get_all_hubla_transactions', {
  p_search: null,
  p_start_date: formatDateForQuery(weekStart),
  p_end_date: formatDateForQuery(weekEnd, true),
  p_limit: 5000,
})

// DEPOIS
supabase.rpc('get_all_hubla_transactions', {
  p_search: null,
  p_start_date: formatDateForQuery(weekStart),
  p_end_date: formatDateForQuery(weekEnd, true),
  p_limit: 5000,
  p_products: null,  // <-- ADICIONADO
})
```

As mesmas alterações serão aplicadas às chamadas mensais (linhas 54-58) e anuais (linhas 60-64).

---

## Resultado Esperado

- O Dashboard carregará sem erros
- Todas as métricas do Incorporador serão exibidas corretamente
- Compatibilidade mantida com a versão mais recente da função RPC

---

## Seção Técnica

A causa raiz é o "function overloading" do PostgreSQL. Quando duas funções têm o mesmo nome e parâmetros similares (onde alguns são opcionais), o PostgREST não consegue resolver automaticamente qual usar.

A solução definitiva seria remover a versão antiga da função no banco, mas a correção imediata é passar explicitamente o parâmetro `p_products: null` para forçar o uso da versão mais recente.

