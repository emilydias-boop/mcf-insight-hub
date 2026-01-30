
## Objetivo
Eliminar o erro do Supabase/PostgREST:

> “Could not choose the best candidate function between … get_all_hubla_transactions(…) …”

e garantir que **/bu-incorporador/transacoes** volte a carregar normalmente, usando como “fonte da verdade” os produtos configurados em **/admin/produtos** (tabela `product_configurations`).

---

## O que está acontecendo (causa raiz)
Hoje existem **duas funções diferentes no banco com o mesmo nome** `public.get_all_hubla_transactions`, com **os mesmos tipos de parâmetros**, só que em **ordens diferentes**:

1) `get_all_hubla_transactions(p_start_date timestamptz, p_end_date timestamptz, p_search text, p_limit int)`  
2) `get_all_hubla_transactions(p_search text, p_start_date timestamptz, p_end_date timestamptz, p_limit int)`

Quando o frontend chama `supabase.rpc('get_all_hubla_transactions', { p_search, p_start_date, ... })`, o PostgREST tenta resolver qual “overload” usar e **falha por ambiguidade** (erro PGRST203).

Observação importante: eu confirmei via consulta no `pg_proc` que as 2 assinaturas existem ao mesmo tempo — uma delas ainda contém o filtro antigo por `product_category='incorporador'`.

---

## Resultado esperado após o ajuste
- A tela **/bu-incorporador/transacoes** deixa de dar erro e volta a listar transações.
- O filtro de “quais produtos entram” fica **100% alinhado** ao cadastro da página **/admin/produtos**:
  - só entra se existir `product_configurations.is_active = true` e `target_bu='incorporador'` e o nome do produto bater com `hubla_transactions.product_name`.
- Mantém a remoção dos duplicados `newsale-%`.

---

## Estratégia de correção (simples e definitiva)
### 1) Padronizar para UMA única assinatura
Vamos manter **apenas uma** versão da função, com uma assinatura “canônica” (e daí em diante, nunca mais criar outra com mesma lista de tipos).

Sugestão (compatível com o frontend atual que já usa `p_search` etc.):
- `public.get_all_hubla_transactions(p_search text default null, p_start_date timestamptz default null, p_end_date timestamptz default null, p_limit integer default 5000)`

### 2) Remover as versões antigas (dropar overloads)
Na migração SQL vamos:
- `DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(timestamp with time zone, timestamp with time zone, text, integer);`
- `DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);`

E então recriar **apenas** a versão canônica.

### 3) Recriar a função com a lógica correta (product_configurations)
A função final deve:
- Filtrar `sale_status IN ('completed','refunded')`
- Filtrar `source IN ('hubla','manual')` (mantendo a regra atual)
- Excluir `hubla_id LIKE 'newsale-%'`
- Filtrar produtos com `EXISTS (select 1 from product_configurations …)`
- Respeitar `p_start_date`, `p_end_date`, `p_search`
- `ORDER BY sale_date desc LIMIT p_limit`
- Manter `SECURITY DEFINER` e `SET search_path TO 'public'` (para consistência e evitar problemas de permissões/resolução)

---

## Passos de implementação (o que eu vou fazer quando você aprovar esta etapa no modo de execução)
1) Criar uma nova migration em `supabase/migrations/` que:
   - Drope as duas assinaturas da função.
   - Recrie a função com a assinatura única e a lógica baseada em `product_configurations`.
2) (Opcional, mas recomendado) Conferir se existe algum `GRANT EXECUTE` necessário para o papel `anon/authenticated` — normalmente Postgres mantém grants ao recriar? Nem sempre. Se necessário, incluir explicitamente `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;` na migration.
3) Validar no preview:
   - Abrir **/bu-incorporador/transacoes**
   - Confirmar que o toast de erro sumiu
   - Confirmar que há transações no período (ex: 01/01/2026 a 30/01/2026)
4) Se ainda aparecer “0” transações:
   - Verificar rapidamente se `hubla_transactions.product_name` está batendo exatamente com `product_configurations.product_name` (diferença de espaços/acentos/case).
   - Se houver divergência real de nomes, a correção seguinte (segunda etapa) seria implementar um match mais robusto (ex: normalização) ou mapear por `product_code`, mas só faremos isso se ficar comprovado que o “nome exato” não é confiável.

---

## Riscos e como vamos evitar
- **Risco:** Voltar a criar overload por acidente no futuro e quebrar de novo.
  - **Mitigação:** deixar apenas 1 assinatura e seguir a regra do projeto “sem overloading ambíguo”.
- **Risco:** Alguns produtos podem não aparecer se o nome não bater 100%.
  - **Mitigação:** primeiro confirmar se o cadastro de produtos em admin está usando exatamente o mesmo `product_name` vindo da Hubla/manual. Se não estiver, evoluir para estratégia por `product_code`/normalização.

---

## Checklist de aceitação (para você validar)
- [ ] Não aparece mais o erro “Could not choose the best candidate function…”
- [ ] A lista mostra transações para o período selecionado
- [ ] Produtos exibidos batem com os produtos ativos em **/admin/produtos** (target_bu incorporador)
- [ ] Duplicados `newsale-%` não aparecem
