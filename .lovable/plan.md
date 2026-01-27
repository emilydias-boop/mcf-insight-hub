
Objetivo: fazer o filtro “Todos os responsáveis” mostrar corretamente TODOS os donos de negócios (SDRs/Closers/Admin/Manager/etc.) na Pipeline Inside Sales, inclusive quando alguns usuários não aparecem por causa de join/RLS/ausência de `user_roles`.

## Diagnóstico (por que ainda não aparece todo mundo)
Hoje o dropdown de responsáveis em `src/components/crm/DealFilters.tsx` faz:
- `profiles.select(..., user_roles(role))` (join via PostgREST)
- filtra `access_status = 'ativo'`
- depois filtra “ativos” apenas se existir `user_roles` com role em `[sdr, closer, admin, manager, coordenador]`

Isso costuma falhar em 3 cenários (bem comuns em Inside Sales):
1) **Join `profiles -> user_roles` não retorna** (por RLS, ou por inconsistência de FK/relacionamento, ou por policy que deixa ver `profiles` mas não deixa ver `user_roles`), então `user_roles` vem vazio e o usuário é eliminado no filtro.
2) **Usuários donos de negócio existem no `crm_deals`, mas não têm linha em `user_roles`** (ou têm role diferente), então são eliminados do dropdown apesar de serem donos reais.
3) **Donos “legados”**: deals antigos podem ter `owner_profile_id` nulo e só `owner_id` (email). Esses também somem do dropdown atual.

Resultado: mesmo depois de corrigir a comparação do filtro (UUID vs email), o dropdown ainda não lista todos os donos.

## Solução proposta (robusta e alinhada com o que o usuário vê)
Em vez de tentar “adivinhar” a lista de responsáveis a partir de `profiles/user_roles`, vamos montar a lista a partir de **quem realmente é dono dos negócios carregados na tela** (Inside Sales), usando os próprios `dealsData` que já chegam no `Negocios.tsx`.

Isso tem duas vantagens:
- Mostra exatamente “quem é dono de algum negócio aqui” (o que o usuário quer).
- Evita dependência de join/RLS para listar pessoas que já aparecem como owner nos negócios.

### Estratégia
1) **Em `Negocios.tsx`**:
   - Derivar um conjunto de owners a partir de `(dealsData || [])`:
     - `owner_profile_id` (UUID) quando existir
     - fallback para `owner_id` (email) quando `owner_profile_id` estiver vazio
   - Buscar nomes/roles **apenas** para os `owner_profile_id` encontrados (query em lote com `.in('id', ids)`), e buscar roles numa segunda query em `user_roles` (sem join).
   - Montar uma lista final:
     - `value` do Select = UUID quando existir; senão usar uma key estável tipo `email:<email>`
     - `label` = `full_name` se tiver; senão fallback para o email/parte antes do @
     - `meta` opcional = role (se disponível)
   - Passar essa lista pronta para o componente `DealFilters`.

2) **Em `DealFilters.tsx`**:
   - Adicionar um prop opcional `ownerOptions` (pré-carregado pelo `Negocios.tsx`).
   - Se `ownerOptions` existir: usar ela (não precisa mais do query atual).
   - Se não existir (reuso do componente em outro lugar): manter o comportamento antigo como fallback (ou simplificar depois).

3) **Em `Negocios.tsx` (aplicação do filtro)**:
   - Ajustar a lógica atual para suportar também o caso `email:<email>`:
     - Se `filters.owner` começar com `email:` comparar com `deal.owner_id`
     - Caso contrário comparar com `deal.owner_profile_id` (UUID), que já foi corrigido.

4) UX extra (opcional, mas recomendado):
   - Incluir uma opção “Sem responsável” quando existirem deals com `owner_profile_id` e `owner_id` vazios (se isso acontecer no dataset).

## Arquivos que serão modificados
- `src/pages/crm/Negocios.tsx`
  - gerar `ownerOptions` a partir de `dealsData`
  - buscar profiles/roles em lote (duas queries)
  - passar `ownerOptions` para `DealFilters`
  - aplicar filtro suportando UUID e `email:<...>`
- `src/components/crm/DealFilters.tsx`
  - aceitar prop `ownerOptions?`
  - renderizar dropdown a partir dessa lista quando fornecida

## Detalhes técnicos (como ficará o formato das opções)
Criar um tipo simples (local, sem quebrar outros lugares):
- `type OwnerOption = { value: string; label: string; roleLabel?: string; isInactive?: boolean }`

Onde:
- `value`: UUID do profile, ou `email:<email>`
- `label`: nome a exibir
- `roleLabel`: “SDR”, “CLOSER”, etc. quando tiver
- `isInactive`: para estilizar “ex-funcionário” se o profile vier como desativado

## Critérios de aceite / como vamos validar
1) No dropdown “Todos os responsáveis”, na pipeline Inside Sales, devem aparecer:
   - todos os usuários que são `owner_profile_id` em pelo menos 1 negócio carregado
   - e também owners que só existam via `owner_id` (email legado)
2) Ao selecionar um responsável, o kanban filtra corretamente.
3) “Todos os responsáveis” volta a mostrar tudo.
4) Não depender de `profiles.select(..., user_roles(role))` (join) para listar opções.

## Risco/atenções
- Se o usuário logado não tiver permissão (RLS) para ler `profiles` de terceiros, ainda assim a lista funcionará via fallback do email do deal, e não “some” ninguém (apenas pode ficar sem nome bonito).
- A lista passa a ser “contextual”: mostra quem tem negócios na seleção atual (que é exatamente o desejado para Inside Sales).

## Pergunta mínima que eu preciso confirmar (para não errar o comportamento)
- O filtro de responsável deve listar:
  A) somente quem já é dono de algum negócio dentro do pipeline/origem selecionado (recomendado), ou  
  B) todo mundo do time (mesmo quem não tem nenhum negócio ainda)?
  
Vou implementar o padrão A (mais útil para Inside Sales) e deixo fácil ajustar para B depois, se você confirmar que precisa.
