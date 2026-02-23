
# Melhoria da Visualizacao do Calendario da Agenda

## Problema

A visualizacao "Calendario" na semana mostra 6-7 colunas de dias, cada uma subdividida em sub-colunas por closer. Isso resulta em:
- Cards de reunioes minusculos e ilegíveis (texto de 8-10px em colunas muito estreitas)
- Botoes de "Agendar" (+) praticamente invisiveis
- Altura do container limitada a 600px, desperdicando espaco da tela
- Dificuldade geral de leitura e interacao

## Solucao Proposta

### 1. Aumentar altura do container de scroll
- Trocar `max-h-[600px]` por `max-h-[calc(100vh-280px)]` para aproveitar toda a tela disponivel

### 2. Garantir largura minima por coluna de dia
- Adicionar `min-w-[140px]` em cada coluna de dia para evitar que fiquem estreitas demais
- Adicionar `overflow-x-auto` no container para permitir scroll horizontal quando necessario (em telas menores)

### 3. Aumentar a altura dos slots de tempo
- Aumentar `SLOT_HEIGHT` de 40px para 48px, dando mais espaco vertical para os cards de reuniao

### 4. Melhorar legibilidade dos cards de reuniao
- Aumentar fontes minimas: de 9px para 10px no modo compacto, de 10px para 11px no modo normal
- Aumentar o tamanho das bolinhas de cor do closer de 1.5px/2px para 2.5px/3px

### 5. Melhorar botoes de slot disponivel
- Aumentar a fonte dos botoes de agendar de 8-9px para 10px
- Mostrar sempre o primeiro nome do closer (em vez de so a inicial no modo compacto)

## Detalhes Tecnicos

Arquivo a modificar: `src/components/crm/AgendaCalendar.tsx`

Alteracoes principais:

1. **Linha 61**: `SLOT_HEIGHT = 40` para `SLOT_HEIGHT = 48`
2. **Linha 922**: `max-h-[600px]` para `max-h-[calc(100vh-280px)]`
3. **Linhas 976-995** (header das colunas de dia no week view): adicionar `min-w-[140px]`
4. **Linhas 1267-1276** (celulas do grid semanal): adicionar `min-w-[140px]`
5. **Linha 920**: adicionar `overflow-x-auto` no container pai
6. **Linhas 1307-1309** (botao de agendar compacto): aumentar tamanho de fonte
7. **Linhas 1418-1432** (card compacto header): aumentar fontes de 9px para 10px
8. **Linhas 1444-1465** (card compacto participantes): aumentar fontes de 9px para 10px

Nenhuma alteracao no banco de dados e necessaria.
