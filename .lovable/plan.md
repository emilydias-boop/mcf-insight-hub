

# Modulo de Contemplacao - Nova Aba no Controle Consorcio

## Resumo

Mover a logica de contemplacao (sorteio + lance) para uma aba exclusiva "Contemplacao" dentro do Controle Consorcio, com suporte a filtros, tabela de cotas, historico de sorteios/lances e acoes rapidas por cota.

## Parte 1 - Migration SQL

Criar duas tabelas de historico para rastrear todas as verificacoes e lances ao longo do tempo.

### Tabela `consorcio_sorteio_history`
- id (uuid, PK)
- card_id (uuid, FK consortium_cards)
- numero_sorteado (text)
- contemplado (boolean)
- distancia (integer)
- data_assembleia (date)
- observacao (text, nullable)
- created_by (uuid, FK auth.users)
- created_at (timestamptz)

### Tabela `consorcio_lance_history`
- id (uuid, PK)
- card_id (uuid, FK consortium_cards)
- percentual_lance (numeric)
- valor_lance (numeric)
- chance_classificacao (text) -- baixa/media/alta/muito_alta
- posicao_estimada (integer, nullable)
- observacao (text, nullable)
- salvo (boolean, default false) -- diferencia simulacao de lance registrado
- created_by (uuid, FK auth.users)
- created_at (timestamptz)

### RLS
- Usuarios autenticados podem inserir
- Admin/manager/coordenador podem ler e deletar todos
- Closers podem ler todos (contemplacao e visivel)

Nenhuma coluna nova em `consortium_cards` pois `numero_contemplacao`, `data_contemplacao`, `motivo_contemplacao`, `valor_lance`, `percentual_lance` ja existem.

---

## Parte 2 - Nova aba "Contemplacao" no Index.tsx

Adicionar terceira aba ao sistema de tabs existente:
- Cotas
- Cadastros Pendentes
- **Contemplacao** (nova)

---

## Parte 3 - Componente `ContemplationTab.tsx`

### Filtros no topo
- Busca por nome/CPF/CNPJ/cota (texto livre)
- Grupo (select)
- Status da cota (ativo/contemplado)
- Tipo produto (select/parcelinha)
- Vendedor responsavel (select)
- Periodo (mes/ano)

### Tabela principal
Colunas:
- Nome / Razao Social
- CPF / CNPJ
- Grupo
- N. Cota
- Valor do Credito
- Tipo (Select/Parcelinha)
- Status da cota
- Status contemplacao (badge colorido: Nao contemplada / Contemplada por sorteio / Contemplada por lance / Aguardando resultado)
- Acoes: Ver detalhes | Verificar sorteio | Simular/Registrar lance

---

## Parte 4 - Modal `VerificarSorteioModal.tsx`

Abre ao clicar "Verificar sorteio" em uma cota.

- Exibe dados da cota (grupo, cota, credito) no topo
- Input: Numero sorteado
- Input: Data da assembleia (date picker)
- Botao "Verificar"
- Resultado: mostra se contemplado, distancia, mensagem (reutiliza `verificarContemplacao` de `contemplacao.ts`)
- Se contemplado: botao "Confirmar Contemplacao por Sorteio" que:
  - Atualiza `consortium_cards` (status='contemplado', motivo_contemplacao='sorteio', numero_contemplacao, data_contemplacao)
  - Insere em `consorcio_sorteio_history`
- Sempre salva em `consorcio_sorteio_history` (contemplado ou nao) para manter historico

---

## Parte 5 - Modal `LanceModal.tsx`

Abre ao clicar "Simular/Registrar lance" em uma cota.

- Exibe dados da cota (grupo, cota, credito) no topo
- Input: Percentual do lance (%) -- calcula valor automaticamente
- Input: Valor do lance (R$) -- calcula percentual automaticamente (bidirecional)
- Input: Observacao (textarea, opcional)
- Botao "Simular" -- reutiliza `simularChanceLance` de `contemplacao.ts`
- Resultado da simulacao: classificacao (badge), mensagem, posicao estimada
- Botao "Salvar Lance" -- insere em `consorcio_lance_history` com salvo=true
- Botao "Registrar Contemplacao por Lance" (visivel se chance alta/muito_alta):
  - Atualiza `consortium_cards` (status='contemplado', motivo_contemplacao='lance', valor_lance, percentual_lance, data_contemplacao)
  - Insere em `consorcio_lance_history`

---

## Parte 6 - Drawer `ContemplationDetailsDrawer.tsx`

Abre ao clicar "Ver detalhes".

### Secao 1: Dados da cota (read-only)
- Grupo, Cota, Credito, Tipo, Responsavel, Status

### Secao 2: Status contemplacao atual
- Badge com status + detalhes se contemplada

### Secao 3: Historico de sorteios
- Tabela com: Data assembleia | Numero sorteado | Contemplado? | Distancia | Registrado por
- Fonte: `consorcio_sorteio_history`

### Secao 4: Historico de lances
- Tabela com: Data | Percentual | Valor | Classificacao | Observacao | Registrado por
- Fonte: `consorcio_lance_history`

### Botoes rapidos
- Verificar sorteio (abre VerificarSorteioModal)
- Registrar lance (abre LanceModal)
- Marcar como contemplada (manual, com dropdown de motivo -- permissao admin/manager)

---

## Parte 7 - Hook `useContemplacao.ts`

- `useContemplationCards(filters)`: query em `consortium_cards` com filtros (grupo, status, tipo, vendedor, busca)
- `useVerificarSorteio()`: mutation que insere em `consorcio_sorteio_history` e, se contemplado, atualiza `consortium_cards`
- `useRegistrarLance()`: mutation que insere em `consorcio_lance_history` e opcionalmente atualiza `consortium_cards`
- `useSorteioHistory(cardId)`: query em `consorcio_sorteio_history`
- `useLanceHistory(cardId)`: query em `consorcio_lance_history`
- `useMarcarContemplada()`: mutation para marcar manualmente como contemplada

---

## Parte 8 - Limpeza

O componente `ContemplationCard.tsx` continuara existindo dentro do `ConsorcioCardDrawer` como visualizacao rapida, mas as acoes de contemplacao agora serao redirecionadas para a aba dedicada ou executadas diretamente de la.

---

## Arquivos a criar

1. `supabase/migrations/XXXX_consorcio_contemplacao_history.sql`
2. `src/components/consorcio/ContemplationTab.tsx`
3. `src/components/consorcio/VerificarSorteioModal.tsx`
4. `src/components/consorcio/LanceModal.tsx`
5. `src/components/consorcio/ContemplationDetailsDrawer.tsx`
6. `src/hooks/useContemplacao.ts`

## Arquivos a modificar

1. `src/pages/bu-consorcio/Index.tsx` -- adicionar aba "Contemplacao"

## Sequencia de implementacao

1. Migration SQL (tabelas de historico + RLS)
2. Hook `useContemplacao.ts`
3. Componente `ContemplationTab.tsx` (filtros + tabela)
4. Modal `VerificarSorteioModal.tsx`
5. Modal `LanceModal.tsx`
6. Drawer `ContemplationDetailsDrawer.tsx`
7. Integrar aba no `Index.tsx`

