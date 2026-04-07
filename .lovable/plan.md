

# Esconder filtro de periodo na aba Reunioes

## Problema
O filtro de periodo no topo limita os dados que chegam na tabela de reunioes, causando confusao quando o usuario tenta filtrar por datas fora do periodo. A barra de periodo so faz sentido na aba "Visao Geral".

## Solucao

No `SdrMeetingsDetailPage.tsx`:

1. **Adicionar estado `activeTab`** para rastrear qual aba esta ativa
2. **Esconder `SdrPerformanceFilters`** quando `activeTab === "leads"` (render condicional)
3. **Passar `onValueChange` no `<Tabs>`** para atualizar o estado

A tabela de reunioes continua recebendo `perfData.meetings` (dados ja carregados pelo periodo inicial), e os filtros internos da tabela (Agendado em, Reuniao em, busca, status, tipo) funcionam livremente sobre esses dados.

### Arquivo
| Arquivo | Acao |
|---------|------|
| `src/pages/crm/SdrMeetingsDetailPage.tsx` | Adicionar estado `activeTab`, esconder `SdrPerformanceFilters` quando `activeTab === "leads"` |

