

## Por que Andre e Nicola não aparecem no Painel Comercial Incorporador

### Diagnóstico

Os dois SDRs **existem e estão ativos**, mas com squad errado na tabela `sdr`:

| Onde | Valor |
|---|---|
| `profiles.squad` | `['a010', 'incorporador']` ✅ correto |
| `employees.departamento` | Nicola: `Inside` / Andre: vazio |
| **`sdr.squad`** | **`'a010'`** ❌ deveria ser `'incorporador'` |
| `sdr.active` | `true` ✅ |
| `sdr.role_type` | `'sdr'` ✅ |
| `user_roles.role` | `'sdr'` ✅ |

A página `/crm/reunioes-equipe` (BU Incorporador) usa o hook `useTeamMeetingsData({ squad: 'incorporador' })`, que por sua vez chama `useSdrsFromSquad('incorporador')` filtrando estritamente `sdr.squad = 'incorporador'`. Como o squad deles está marcado como `a010`, eles ficam invisíveis no painel — junto com qualquer métrica de agendamento que tenham gerado.

A causa provável: o squad em `profiles` é um array (`['a010','incorporador']`) e o sync bidirecional para `sdr` gravou apenas o **primeiro elemento**, "a010", em vez de priorizar `incorporador` (que é a BU operacional do agendamento).

### Correção proposta

**Etapa 1 — Correção pontual (imediata)**

Atualizar via migration os dois registros em `sdr` para refletir a BU correta:

```sql
UPDATE public.sdr
SET squad = 'incorporador', updated_at = now()
WHERE email IN (
  'andre.duarte@minhacasafinanciada.com',
  'nicola.ricci@minhacasafinanciada.com'
);
```

Resultado esperado: ambos passam a aparecer na aba SDRs (com 0 agendamentos no período, já que foram cadastrados em 20 e 22/04 e estão começando agora) e qualquer reunião que venham a agendar entrará no painel automaticamente.

**Etapa 2 — Corrigir o sync para evitar repetição (próximo passo)**

Investigar o trigger/função de sync `profiles ↔ sdr` para garantir que, quando `profiles.squad` é um array com múltiplos valores, a prioridade de gravação em `sdr.squad` seja:

1. `incorporador` se presente
2. `consorcio` se presente
3. `a010` apenas como fallback

Isso evita que novos cadastros caiam no mesmo problema. Deixo essa parte como **Etapa 2 separada** — confirmo antes de aplicar para não mexer em sync sem alinhamento.

### Validação anti-regressão

Após a Etapa 1:
- Verificar que Andre e Nicola aparecem na aba **SDRs** do Painel Comercial Incorporador (com 0 agendamentos, é esperado).
- Confirmar que não duplicaram em outras BUs (continuam fora de Consórcio).
- Confirmar que `useSdrsFromSquad('a010')` (se houver painel a010) não os perde indevidamente — se o painel A010 também precisar deles, a Etapa 2 vira obrigatória (manter o array funcional).

### Reversibilidade

UPDATE simples e auditável. Reverter = `UPDATE sdr SET squad='a010' WHERE email IN (...)`.

### O que NÃO faz parte deste plano

- Não vou alterar `profiles.squad` (já está correto).
- Não vou criar registros em `closers` — eles são SDRs, não Closers; estão na aba certa, só com squad errado.
- Não vou tocar no trigger de sync sem aprovação separada.

