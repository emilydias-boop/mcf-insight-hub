

# Leads em Limbo - Upload e Comparacao com Base Local

## Resumo
Criar uma tela onde a gestora faz upload de uma planilha Excel exportada do Clint (Pipeline Inside Sales), o sistema compara com os `crm_deals` existentes por nome/email/telefone, e mostra quais ja existem (com ou sem dono) e quais nao existem. A gestora pode entao atribuir leads sem dono a SDRs ou marcar leads do Clint que precisam ser importados.

## O que a tela faz

1. **Upload de Excel** - Gestora exporta a lista do Clint e sobe o .xlsx
2. **Mapeamento de colunas** - Sistema tenta auto-mapear (nome, email, telefone, estagio, valor, dono)
3. **Comparacao automatica** - Cruza com `crm_deals` por email do contato ou nome
4. **Tabela de resultados** com 3 categorias:
   - **Ja existe COM dono** (verde) - nada a fazer
   - **Ja existe SEM dono** (amarelo) - gestora pode atribuir a um SDR
   - **Nao encontrado** (vermelho) - lead so existe no Clint, gestora decide se importa ou ignora
5. **Atribuicao em lote** - Selecionar varios leads sem dono e atribuir a um SDR
6. **Vincular contrato pago** - Para leads que pagaram apos followup, registrar o closer responsavel

## Detalhes Tecnicos

### Arquivos novos

**`src/pages/crm/LeadsLimbo.tsx`**
Pagina principal com:
- Step 1: Upload do Excel (reutiliza padrao de `Importar.tsx`)
- Step 2: Mapeamento de colunas (nome, email, telefone, estagio, valor, dono atual)
- Step 3: Tabela de comparacao com filtros por status (todos/com dono/sem dono/nao encontrado), busca por nome, e paginacao
- Acoes: checkbox de selecao, select de SDR para atribuicao em lote
- A comparacao e feita 100% no frontend: busca todos os deals da origin Inside Sales + contatos e cruza por email (match exato) ou nome (similaridade)

**`src/hooks/useLimboLeads.ts`**
- `useInsideSalesDeals()` - busca todos os deals da origin `e3c04f21-ba2c-4c66-84f8-b4341c826b1c` com contatos (paginado em lotes de 1000 para superar o limite do Supabase)
- `useAssignLimboOwner()` - mutation que atualiza `owner_id` e `owner_profile_id` nos deals selecionados
- Logica de comparacao: normaliza emails (lowercase, trim) e nomes para matching

### Arquivos modificados

**`src/pages/CRM.tsx`**
- Adicionar tab "Limbo" com icone `Inbox` apos "Orfaos"

**`src/pages/crm/BUCRMLayout.tsx`**
- Adicionar key `leads-limbo` nas tabs visiveis da BU incorporador

**`src/App.tsx`**
- Importar `LeadsLimbo`
- Adicionar rota `leads-limbo` dentro do CRM incorporador (protegida para admin/manager/coordenador)
- Adicionar nas rotas das BUs que usam BUCRMLayout

### Fluxo de matching

```text
Para cada linha da planilha:
  1. Se tem email -> busca em crm_contacts.email (match exato, case insensitive)
     -> Se encontrou contato -> busca deal vinculado na Inside Sales
        -> Se deal tem owner_id -> status = "com_dono"
        -> Se deal nao tem owner_id -> status = "sem_dono" (atribuivel)
     -> Se nao encontrou contato -> status = "nao_encontrado"
  2. Se nao tem email mas tem nome -> busca por nome (match exato)
     -> Mesma logica acima
  3. Se nao achou por nenhum -> status = "nao_encontrado"
```

### Detalhes da interface

- Contadores no topo: X com dono | Y sem dono | Z nao encontrados
- Filtro de status (3 abas ou select)
- Tabela: Nome | Email | Telefone | Estagio (Clint) | Valor | Status | Dono atual | Acao
- Para leads "sem_dono": select de SDR inline ou checkbox + atribuicao em lote
- Para leads "nao_encontrado": botao "Exportar nao encontrados" gera Excel para a gestora decidir manualmente
- Usa lista de SDRs existente da tabela `sdr` para o select de atribuicao

### Performance
- Upload e parsing do Excel sao feitos no frontend com a lib `xlsx` (ja instalada)
- Busca dos deals existentes e feita em lotes de 1000 (batching para superar limite do Supabase)
- Comparacao e feita em memoria no frontend (Map por email para O(1) lookup)
- Nenhuma tabela nova no banco - usa diretamente `crm_deals` e `crm_contacts` existentes
- Nenhuma edge function necessaria

