
# Bloqueio de Horario Especifico em Datas Bloqueadas

## Resumo

Atualmente, ao bloquear uma data, o dia inteiro fica indisponivel. A proposta e permitir opcionalmente informar um horario especifico (ex: "14:00"), de modo que apenas aquele slot fique bloqueado em vez do dia todo.

## O que muda

### 1. Banco de dados
Adicionar duas colunas opcionais na tabela `closer_blocked_dates`:
- `blocked_start_time` (TIME, nullable) -- horario de inicio do bloqueio
- `blocked_end_time` (TIME, nullable) -- horario de fim do bloqueio

Quando ambas forem NULL, o bloqueio continua valendo para o dia inteiro (comportamento atual preservado).

### 2. Interface (BlockedDatesConfig.tsx)
- Adicionar um toggle/checkbox "Bloquear horario especifico" abaixo do seletor de data
- Quando ativado, mostrar dois campos de horario (inicio e fim) usando inputs tipo time
- Na lista de datas bloqueadas, exibir o horario ao lado da data quando for um bloqueio parcial (ex: "23 de fevereiro, 2026 - 14:00 ate 15:00")
- Quando for dia inteiro, mostrar "(Dia inteiro)" ao lado da data

### 3. Hook de dados (useAgendaData.ts)
- Atualizar a interface `BlockedDate` para incluir `blocked_start_time` e `blocked_end_time`
- Atualizar `useAddBlockedDate` para enviar os campos de horario opcionais

### 4. Logica de disponibilidade (CloserColumnCalendar.tsx)
- Atualizar as verificacoes de bloqueio para considerar o horario:
  - Se `blocked_start_time` e `blocked_end_time` forem NULL: bloqueia o dia inteiro (como hoje)
  - Se tiverem valor: bloqueia apenas os slots cujo horario esteja dentro do intervalo

## Detalhes Tecnicos

**Migracao SQL:**
```text
ALTER TABLE closer_blocked_dates 
  ADD COLUMN blocked_start_time TIME,
  ADD COLUMN blocked_end_time TIME;
```

**Logica de verificacao de bloqueio (pseudo-codigo):**
```text
Para cada blocked_date do closer na data selecionada:
  Se blocked_start_time == NULL -> dia inteiro bloqueado
  Senao -> bloqueado apenas se horario do slot >= blocked_start_time 
           E horario do slot < blocked_end_time
```

**Arquivos a modificar:**
1. Nova migracao SQL (adicionar colunas)
2. `src/integrations/supabase/types.ts` (tipos atualizados automaticamente)
3. `src/hooks/useAgendaData.ts` (interface BlockedDate + mutacao)
4. `src/components/crm/BlockedDatesConfig.tsx` (UI com campos de horario)
5. `src/components/crm/CloserColumnCalendar.tsx` (logica de disponibilidade)
