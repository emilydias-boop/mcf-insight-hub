

## Diagnóstico

Encontrei **13 casos** idênticos ao da Jessé — leads com deals duplicados nos estágios "Contrato Pago" ou "Venda Realizada", criados pelo webhook do Clint quando o contrato foi pago. Em todos os casos, o padrão é:

- **Deal real**: mais atividades, reuniões vinculadas, criado antes
- **Deal duplicado**: 0-3 atividades, 0 reuniões, criado pelo webhook posterior

| Lead | Deal Real (atividades) | Deal Duplicado (atividades) |
|------|----------------------|---------------------------|
| Altacyr Guimarães | 13 atividades, 2 reuniões | 1 atividade, 0 reuniões |
| André Menini | 7 atividades, 1 reunião | 3 atividades, 0 reuniões |
| Deivison Carneiro | 12 atividades, 1 reunião | 1 atividade, 0 reuniões |
| Desirrê Rodrigues | 7 atividades, 1 reunião | 2 atividades, 0 reuniões |
| Fernando Magalhães | 9 atividades, 1 reunião | 0 atividades, 0 reuniões |
| Jean Cantuário | 6 atividades, 4 reuniões | 1 atividade, 0 reuniões |
| Julio Rodrigues | 20 atividades, 2 reuniões | 1 atividade, 0 reuniões |
| Livie Marques | 7 atividades, 1 reunião | 6 atividades, 0 reuniões |
| Lucas Chaves | 6 atividades, 2 reuniões | 3 atividades, 0 reuniões |
| Lucia Jander | 13 atividades, 4 reuniões | 0 atividades, 0 reuniões |
| Luiz Souza | 8 atividades, 4 reuniões | 1 atividade, 0 reuniões |
| Agenor Macedo | 7 atividades, 2 reuniões | 2 atividades, 0 reuniões |
| Nonato Rosal | 14 atividades, 2 reuniões | 1 atividade, 0 reuniões |

## Plano

### 1. Migration SQL para limpar os 13 casos

Uma migration que:
1. **Deleta os 13 deals duplicados** (os com 0 reuniões e menos atividades)
2. **Merge dos contatos duplicados** — para cada email com 2 contacts, move deals do contato duplicado para o principal e deleta o duplicado

Deals a deletar (duplicados sem reuniões):
- `0fb0290f` (Altacyr), `0f2a0cb4` (André), `7d5b43dd` (Deivison), `4f5e82f0` (Desirrê), `46e5d644` (Fernando), `9c915ab6` (Jean), `66083a35` (Julio), `23fd376d` (Livie), `cc70084d` (Lucas), `cc490b47` (Lucia), `ba1f87ab` (Luiz), `2f28a4fb` (Agenor), `c86601fc` (Nonato)

### 2. Rodar merge de contatos duplicados restantes

Após deletar os deals duplicados, executar a página `/crm/contatos-duplicados` para unificar os contatos duplicados remanescentes (os 2.725 grupos por email).

### Resultado

Os 13 leads deixarão de aparecer duplicados no Kanban. A proteção de race condition já implementada na mensagem anterior impede novos casos.

