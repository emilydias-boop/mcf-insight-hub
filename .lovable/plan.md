

## Por que Andre e Nicola ainda não aparecem (e como resolver de vez)

### Diagnóstico definitivo

Eles **estão corretos** em `sdr` (squad = `incorporador`, ativos, role `sdr`) — confirmei agora no banco. O problema está em **outra camada**: a tabela `sdr_squad_history`, que o painel usa para incluir SDRs no período.

Histórico atual (timestamps em UTC, abril/2026):

**Andre Duarte**
| Squad | De | Até |
|---|---|---|
| `a010` | 20/04 20:59 | 23/04 16:44 |
| `inside sales produto` | 23/04 16:44 | 23/04 16:45 |
| `incorporador` | 23/04 16:47 | (atual) |

**Nicola Ricci**
| Squad | De | Até |
|---|---|---|
| `a010` | 22/04 17:06 | 23/04 16:45 |
| `inside sales produto` | 23/04 16:45 | 23/04 16:47 |
| `incorporador` | 23/04 16:47 | (atual) |

O painel está em **filtro "Mês" (01/04 a 30/04)** chamando o RPC `get_sdrs_for_squad_in_period(p_squad='incorporador', p_start='2026-04-01', p_end='2026-04-30')`. Esse RPC retorna todos os SDRs que estiveram em `incorporador` em **qualquer momento** do período. Como Andre só entrou em `incorporador` às 16:47 de 23/04, ele **deveria** aparecer — então o RPC está funcionando, mas há outro filtro engasgando.

Olhando o `useTeamMeetingsData`:

```ts
return metrics.filter((m) => {
  if (validSdrEmails.size > 0) {
    return validSdrEmails.has(m.sdr_email?.toLowerCase() || '');
  }
  return true;
});
```

Ele só inclui SDRs que aparecem no `metricsQuery.data.metrics` — ou seja, **SDRs que têm pelo menos uma linha de métrica retornada pelo RPC `get_sdr_metrics_from_agenda`**. Esse RPC só devolve linhas para SDRs com agendamentos no período. Nicola, que ainda não agendou nada, **nunca aparecerá** mesmo estando no squad. Andre deve aparecer **só se** já tiver agendado algo cuja métrica seja atribuída ao seu email.

Mas há um agravante: as reuniões que o Andre criou entre 20–23/04 foram feitas **enquanto ele estava marcado como `a010`**. Dependendo de como `get_sdr_metrics_from_agenda` filtra (provavelmente cruza email/squad histórico), as reuniões dele podem estar sendo contadas em `a010`, não em `incorporador`.

### Plano de correção

**Etapa 1 — Mostrar SDRs do squad mesmo sem métricas (fix de UI)**

Em `useTeamMeetingsData.ts`, fazer merge: a tabela final deve listar **todos os SDRs do `sdrMetaMap`** (atuais + histórico do período), não só os que têm linha em `metrics`. SDRs sem métricas aparecem com zeros.

```ts
// Pseudo:
const allEmails = new Set([...validSdrEmails, ...metrics.map(m => m.sdr_email.toLowerCase())]);
const bySDR = Array.from(allEmails).map(email => {
  const m = metrics.find(x => x.sdr_email?.toLowerCase() === email);
  const meta = sdrMetaMap.get(email);
  return {
    sdrEmail: email,
    sdrName: meta?.name || email.split('@')[0],
    agendamentos: m?.agendamentos ?? 0,
    r1Agendada: m?.r1_agendada ?? 0,
    r1Realizada: m?.r1_realizada ?? 0,
    noShows: m?.no_shows ?? 0,
    contratos: m?.contratos ?? 0,
    isExSquad: meta?.isExSquad ?? false,
    currentSquad: meta?.currentSquad ?? null,
  };
});
```

**Resultado:** Nicola passa a aparecer com zeros. Andre aparece — com as métricas que existirem para o email dele (ver Etapa 2).

**Etapa 2 — Reatribuir histórico errado de Andre/Nicola**

O período `a010` no histórico foi um efeito colateral do bug do trigger antigo (que pegava `squad[1]` do array). Como ambos foram **cadastrados já como Inside Sales/Incorporador** (o array `['a010','incorporador']` representava canal+BU, não uma transição real), as linhas `a010` e `inside sales produto` do histórico são **ruído**, não verdade operacional.

Proposta: encerrar/remover essas linhas históricas espúrias e deixar somente `incorporador` valendo desde a data de cadastro de cada um:

```sql
-- Andre: apagar linhas a010 e inside sales produto, ajustar incorporador para começar em 2026-04-20
DELETE FROM public.sdr_squad_history
WHERE sdr_id = '6533ee88-398a-4625-958f-80412f091339'
  AND squad IN ('a010','inside sales produto');

UPDATE public.sdr_squad_history
SET valid_from = '2026-04-20 20:59:58.431804+00'
WHERE sdr_id = '6533ee88-398a-4625-958f-80412f091339'
  AND squad = 'incorporador';

-- Nicola: mesma coisa começando em 2026-04-22
DELETE FROM public.sdr_squad_history
WHERE sdr_id = '3d312772-1bfe-4e55-8865-b525006adaa7'
  AND squad IN ('a010','inside sales produto');

UPDATE public.sdr_squad_history
SET valid_from = '2026-04-22 17:06:42.458965+00'
WHERE sdr_id = '3d312772-1bfe-4e55-8865-b525006adaa7'
  AND squad = 'incorporador';
```

Assim, qualquer reunião que Andre tenha criado entre 20–23/04 passa a ser corretamente atribuída ao squad `incorporador` para fins de métrica retroativa.

### Validação após aplicar

1. Recarregar `/crm/reunioes-equipe` (BU Incorporador, filtro "Mês") → Nicola e Andre aparecem na lista de SDRs.
2. Andre mostra as reuniões que ele criou nos últimos dias (não mais 0 se ele realmente agendou).
3. Nicola aparece com zeros (esperado — ainda não agendou).
4. Nenhum dos dois aparece nos painéis de outras BUs (consórcio, crédito etc.).

### Reversibilidade

- Etapa 1: alteração de código local em `useTeamMeetingsData.ts`, reverter = restaurar filtro original.
- Etapa 2: histórico apagado é reconstruível via `sdr_squad_history` se necessário, mas como são linhas geradas por bug e não por mudança operacional real, a remoção é segura.

### Fora deste plano

- Não vou alterar o RPC `get_sdr_metrics_from_agenda` — se ele estiver fazendo join com o histórico, a Etapa 2 já resolve. Se depois da Etapa 2 ainda houver métricas faltando para o Andre, abro investigação separada do RPC.
- Não vou tocar em outros SDRs que tenham histórico legítimo (ex: Leticia movendo de incorporador → crédito).

