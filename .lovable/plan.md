
# Automatizar Sincronizacao CRM <-> Agenda (Consorcio)

## Diagnostico

O codigo de sincronizacao (`syncDealStageFromAgenda`) JA EXISTE e JA E CHAMADO quando o status muda na Agenda. O problema e que a atualizacao **falha silenciosamente** por 3 motivos distintos:

### Causa 1: RLS bloqueia closers de atualizar deals

A politica de UPDATE na tabela `crm_deals` permite apenas roles `admin`, `manager` e `sdr`. **Closers nao podem atualizar deals.** O Supabase retorna sucesso com 0 linhas afetadas (sem erro), entao o sistema loga a atividade normalmente mas o deal nao muda de estagio.

Prova: O deal do "Jone" tem atividade registrada "Status atualizado via Agenda: completed" mas continua em "Reuniao 01 Agendada" com o owner original.

### Causa 2: Nao existe estagio "No-Show" na pipeline Consorcio

A pipeline "PIPE LINE - INSIDE SALES" (Consorcio) tem apenas 8 estagios e NENHUM deles e "No-Show". Quando a funcao tenta encontrar o estagio para no-show, nao acha nada e retorna silenciosamente.

### Causa 3: Typo no nome do estagio R2

O estagio esta cadastrado como "Reuniao 02 **Agendado**" (masculino) mas a funcao procura por "Reuniao 02 **Agendada**" (feminino). O `ilike` nao resolve isso pois sao palavras diferentes.

## Solucao

### 1. Corrigir RLS - Adicionar role `closer` na politica de UPDATE

Alterar a politica "SDRs podem atualizar deals" para incluir `has_role(auth.uid(), 'closer'::app_role)`. Isso permite que closers atualizem deals quando marcam reunioes na agenda.

### 2. Criar estagio "No-Show" na pipeline Consorcio

Inserir um novo registro na tabela `crm_stages` com `stage_name: 'No-Show'` e `origin_id: '57013597-22f6-4969-848c-404b81dcc0cb'`.

### 3. Adicionar variante "Agendado" no mapeamento de estagios

No `stageNameMap` dentro de `syncDealStageFromAgenda`, adicionar "Reuniao 02 Agendado" como variante aceita para os mapeamentos de `rescheduled` e `r2_scheduled`.

## Detalhes Tecnicos

### Arquivo: `src/hooks/useAgendaData.ts`

Adicionar variantes no `stageNameMap` (linhas 1462-1469):
- `rescheduled` (r2): adicionar `'Reuniao 02 Agendado'`
- `r2_scheduled`: adicionar `'Reuniao 02 Agendado'`

### Banco de dados: SQL a executar

```text
-- 1. Corrigir RLS para closers
DROP POLICY IF EXISTS "SDRs podem atualizar deals" ON crm_deals;
CREATE POLICY "SDRs e closers podem atualizar deals" ON crm_deals
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'manager'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'sdr'::app_role) OR
      has_role(auth.uid(), 'closer'::app_role)
    )
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'manager'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'sdr'::app_role) OR
      has_role(auth.uid(), 'closer'::app_role)
    )
  );

-- 2. Criar estagio No-Show na pipeline Consorcio
INSERT INTO crm_stages (origin_id, stage_name)
VALUES ('57013597-22f6-4969-848c-404b81dcc0cb', 'No-Show');
```

### Resultado esperado

Apos estas correcoes, ao marcar uma reuniao como "Realizada", "No-Show" ou "Contrato Pago" na Agenda do Consorcio, o deal sera automaticamente movido para o estagio correspondente no CRM e a ownership sera transferida para o closer.
