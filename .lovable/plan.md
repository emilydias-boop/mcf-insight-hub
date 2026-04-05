

# Cockpit SDR — Nova tela de execucao

## Resumo
Criar uma central operacional em 3 colunas para o SDR trabalhar leads sem trocar de tela. Rota `/sdr/cockpit`, totalmente independente do Kanban existente.

## Arquivos a criar

### 1. `src/pages/sdr/SDRCockpit.tsx` — Pagina principal
Layout de 3 colunas fixas (240px | flex-1 | 220px) com fundo dark (#0f1117). Orquestra estado global: `selectedDealId`, `leadState` (novo, em_ligacao, nao_atendeu, qualificado, agendando, agendado, retorno, perdido). Importa os 3 paineis.

### 2. `src/hooks/useSDRCockpit.ts` — Hook principal de dados
Query para fila de deals do SDR logado:
- `crm_deals WHERE owner_id = user.email`
- JOIN `crm_contacts`, `crm_stages`, LEFT JOIN `deal_activities` (count)
- Excluir stages por nome: R1 Realizada, Contrato Pago, R2 Agendada, R2 Realizada, Venda Realizada, Sem Interesse
- Ordenacao por prioridade: atrasados primeiro, sem atividade, parados 4h+, depois `stage_moved_at ASC`
- Limit 50 com paginacao
- Segundo query para deal selecionado: dados completos + contato + atividades + tentativas (count de call/nao_atendeu)

### 3. `src/components/sdr/cockpit/CockpitQueue.tsx` — Coluna esquerda (240px)
Lista de cards com: nome, estagio, tempo no estagio (via `stage_moved_at`), badge urgencia (verde <2h, amarelo <24h, vermelho >24h), indicador acao atrasada. Botao "ver mais" para carregar proximos 50.

### 4. `src/components/sdr/cockpit/CockpitExecutionPanel.tsx` — Coluna central (flex-1)
- Header fixo: avatar iniciais, nome, telefone, origem, badge estado
- Barra de acoes dinamica conforme `leadState` (botoes mudam por estado)
- Area principal renderiza conteudo por estado:
  - `novo`: info + sugestao + timeline
  - `em_ligacao`: timer + textarea notas + chips resultado (Atendeu/Nao atendeu/Caixa postal/Pediu retorno)
  - `nao_atendeu`: cadencia automatica (tentativas 1-5 com datas)
  - `qualificado`: resumo + sugestao agendar R1
  - `agendando`: resumo + agenda ativa na coluna direita
  - `agendado`: confirmacao visual + proximo lead
  - `perdido`: motivo + timeline

### 5. `src/components/sdr/cockpit/CockpitQualificationPanel.tsx` — Coluna direita (220px)
- Parte superior: campos de qualificacao inline (reutiliza `useQualification` hook e config de `QualificationFields.tsx`). Editaveis inline, salvam em `custom_fields`.
- Parte inferior: agenda embutida, visivel apenas quando `leadState = 'agendando'`. Reutiliza `useClosersWithAvailability` + `QuickScheduleModal`. Nos outros estados mostra mensagem placeholder.

### 6. `src/components/sdr/cockpit/CadenceDisplay.tsx` — Sub-componente de cadencia
Mostra as 5 tentativas programadas com datas calculadas:
- Tentativa 1-2: mesmo dia (intervalo 2h)
- Tentativa 3: dia seguinte
- Tentativa 4: +2 dias
- Tentativa 5: +4 dias
Logica de auto-criacao de `next_action_date` via `useSaveNextAction`. Regra 15 dias sem contato: mover para Sem Interesse automaticamente.

### 7. `src/components/sdr/cockpit/CallTimer.tsx` — Timer de ligacao
Cronometro simples (useState + setInterval), textarea para notas em tempo real, chips de resultado.

## Arquivos a alterar

### 8. `src/App.tsx`
Adicionar rota: `<Route path="sdr/cockpit" element={<RoleGuard allowedRoles={['sdr']}><SDRCockpit /></RoleGuard>} />`

### 9. `src/components/layout/AppSidebar.tsx`
Adicionar item na secao SDR (antes de "Minhas Reunioes"):
```
{ title: "Cockpit", url: "/sdr/cockpit", icon: Zap, resource: "crm", requiredRoles: ["sdr"] }
```

## O que NAO sera alterado
- Kanban (`DealKanbanBoardInfinite`)
- Hooks existentes (apenas importados/reutilizados)
- Rotas existentes
- Tabelas do banco (usa `custom_fields`, `deal_activities`, `next_action_*` existentes)

## Estilo visual
Dark mode forcado: fundo `#0f1117`, bordas `#1e2130`, texto `#e2e8f0`. Tipografia densa (text-xs/text-sm). Cores semanticas: verde (`#22c55e`), vermelho (`#ef4444`), ambar (`#f59e0b`). Sem sombras decorativas.

## Complexidade
Alta — 7 novos arquivos, 2 alteracoes. Implementacao incremental recomendada: hook + pagina + fila primeiro, depois painel central com estados, por ultimo qualificacao + agenda.

