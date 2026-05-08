## Objetivo

Remover Marcio Dantas da aba **SDRs** da tela `/crm/reunioes-equipe` no BU Incorporador, sem afetar sua presença correta na aba **Closers** (com 55 R1 Agendadas, 25 Realizadas, 1 Contrato) nem seu papel atual de SDR no Consórcio.

## Causa raiz

A tabela `sdr_squad_history` tem uma linha incorreta:

| sdr_id | squad | valid_from | valid_to |
|---|---|---|---|
| Marcio Dantas | **incorporador** | 16/03/2026 | 08/05/2026 |
| Marcio Dantas | consorcio | 08/05/2026 | (aberto) |

Marcio nunca foi SDR de incorporador — sempre foi closer dessa BU, e só virou SDR ao migrar para o Consórcio em 08/05. A linha `incorporador` foi criada por engano (provavelmente quando o `role_type` virou `sdr`).

## Correção

Apagar a linha de histórico equivocada e manter apenas a de Consórcio:

```sql
DELETE FROM public.sdr_squad_history
WHERE sdr_id = '1b949ca6-c97d-4a01-8da9-105dca5ded86'
  AND squad = 'incorporador';
```

## Resultado esperado

- Aba **SDRs (Incorporador)**: Marcio some — passa a ter 9 SDRs em vez de 10.
- Aba **Closers (Incorporador)**: Marcio continua igual (55/25/28/1 etc.) — esses dados vêm de `meeting_slot_attendees.closer_id` e não dependem de `sdr_squad_history`.
- BU **Consórcio**: Marcio continua aparecendo como SDR a partir de 08/05.
- Histórico de outros meses não é afetado (ele aparece zerado em qualquer aba SDR de Incorporador, pois nunca foi SDR lá de fato).

## Sem mudanças de código

Apenas uma operação de DELETE pontual no banco. Nenhum hook, função ou componente precisa ser alterado — a lógica de `get_sdrs_for_squad_in_period` está correta, o problema é dado sujo.
