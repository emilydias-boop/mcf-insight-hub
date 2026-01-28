
# Ajustar Layout da Aba "R2 Agendadas" no Carrinho

## Objetivo
Reorganizar a visualização da aba "R2 Agendadas" para mostrar:
- **Dia da reunião como header** destacado no topo de cada grupo
- **Horários listados verticalmente** abaixo de cada dia

## Layout Atual vs Proposto

| Atual | Proposto |
|-------|----------|
| Tabela com colunas horizontais (Data/Hora, Nome, Telefone, Closer, Status) | Cards por dia com header de data |
| Dia aparece como linha de separação dentro da tabela | Dia como header destacado com badge de contagem |
| Horário na primeira coluna da linha | Horário como item vertical compacto |

## Mudanças no Componente `R2AgendadasList.tsx`

### Estrutura Visual Proposta

```
┌─────────────────────────────────────────────┐
│ domingo, 25 de janeiro                  [9] │  ← Header do dia
├─────────────────────────────────────────────┤
│ ⏰ 13:00  João Silva       (11) 99999-9999  │
│           Closer: Julio    [Realizada]      │
├─────────────────────────────────────────────┤
│ ⏰ 15:00  Maria Santos     (11) 88888-8888  │
│           Closer: Claudia  [Agendada]       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ segunda-feira, 26 de janeiro            [5] │
├─────────────────────────────────────────────┤
│ ...                                         │
└─────────────────────────────────────────────┘
```

### Implementação

1. **Remover estrutura de Table** - Trocar por cards/divs com layout vertical
2. **Header por dia** - Card com data formatada e badge de contagem
3. **Lista de horários** - Cada attendee como item com horário destacado
4. **Informações em duas linhas**:
   - Linha 1: Horário + Nome + Telefone
   - Linha 2: Closer + Status badge

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/R2AgendadasList.tsx` | Substituir Table por layout de cards agrupados por dia |

## Detalhes Técnicos

- Manter agrupamento `byDay` existente
- Usar `Collapsible` ou cards simples para cada dia
- Horário como elemento principal (lado esquerdo)
- Nome, telefone, closer e status como informações secundárias
- Manter click handler para abrir drawer de detalhes
- Manter todos os status badges existentes com suas cores

