

# Adicionar detalhes do lead na pagina Pos-Reuniao

## Resumo
Integrar o `DealDetailsDrawer` existente nas 3 abas da pagina Pos-Reuniao, permitindo clicar no nome do lead para ver todos os dados dele (jornada, historico de stages, notas, ligacoes, tarefas, qualificacao, etc.).

## O que ja existe
O componente `DealDetailsDrawer` ja mostra tudo que voce precisa:
- Cabecalho com nome, telefone, stage atual
- Jornada do lead (SDR, R1, R2)
- Acoes rapidas e proxima acao
- Qualificacao (se houver)
- Abas internas: Tarefas, Historico de stages, Ligacoes, Notas
- Jornada A010 detalhada

## Solucao
Tornar o nome do contato clicavel em todas as 3 tabelas (Realizadas, Propostas, Sem Sucesso). Ao clicar, abre o `DealDetailsDrawer` com todos os dados do lead.

## Secao tecnica

### Arquivo: `src/pages/crm/PosReuniao.tsx`

1. Importar `DealDetailsDrawer` no topo do arquivo
2. Adicionar state `selectedDealId` e `drawerOpen` em cada sub-componente (RealizadasTab, PropostasTab, SemSucessoTab)
3. Transformar a celula do nome do contato em um botao/link clicavel que seta o `selectedDealId`
4. Renderizar o `DealDetailsDrawer` em cada tab com o `dealId` selecionado

Exemplo da mudanca no RealizadasTab:
- Adicionar `const [selectedDealId, setSelectedDealId] = useState<string | null>(null);`
- Na TableCell do contato: trocar texto por `<Button variant="link" onClick={() => setSelectedDealId(r.deal_id)}>...</Button>`
- Ao final do componente: `<DealDetailsDrawer dealId={selectedDealId} open={!!selectedDealId} onOpenChange={o => !o && setSelectedDealId(null)} />`

Mesma logica se aplica ao PropostasTab (usando `p.deal_id`) e SemSucessoTab (usando `d.deal_id`).

Nenhuma mudanca de banco de dados necessaria.
