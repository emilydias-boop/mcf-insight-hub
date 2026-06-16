## Diagnóstico

Filtrando junho/2026 no relatório:

- **66** emails únicos compraram A017 (VSL + Manychat) na Hubla.
- **56** desses têm deal criado em junho na BU Incorporador.
- Hoje o funil mostra apenas **30** em A017 — os outros **26** estão caindo em A010 porque o lead também tem compra A010 ≤30 dias.

A regra atual em `classifyChannelWith30dRule` prioriza A010 fresco antes de A017:

```text
1. buyer A010 ≤30d                → A010   ← rouba 26 A017
2. buyer A017 (VSL/Manychat)      → A017
3. A010 esfriado + tag ANAMNESE   → ANAMNESE
4. A010 esfriado                  → A010
5. tag ANAMNESE                   → ANAMNESE
6. tag ANAMNESE-INCOMPLETA        → ANAMNESE INCOMPLETA
7. fallback                       → OUTROS
```

Mas a regra de negócio definida (mensagens 23:09 e 23:01 de 15/06, e memória `hubla-checkout-offer-primary-rule`) é: **prevalece a compra principal — e A017 só é marcado quando o checkout foi VSL ou Manychat (já é a compra principal)**. Logo A017 deve vencer A010 fresco.

## Mudança

`src/hooks/useChannelFunnelReport.ts` — função `classifyChannelWith30dRule`: inverter a ordem das duas primeiras regras.

```text
1. buyer A017 (VSL/Manychat)  → A017      ← passa para o topo
2. buyer A010 ≤30d            → A010
3. A010 esfriado + ANAMNESE   → ANAMNESE
4. A010 esfriado              → A010
5. tag ANAMNESE               → ANAMNESE
6. tag ANAMNESE-INCOMPLETA    → ANAMNESE INCOMPLETA
7. fallback                   → OUTROS
```

## Efeito esperado no relatório (junho)

| Canal   | Antes | Depois |
|---------|------:|-------:|
| A010    | 299   | ~273   |
| A017    | 30    | ~56    |
| Demais  | iguais |       |

Os 26 leads que migram de A010 para A017 trazem junto suas R1 agendadas, realizadas, no-shows e contratos pagos — então as linhas A010 e A017 do funil refletem corretamente o canal primário de aquisição. Os outros 10 emails A017 que não aparecem é porque não têm deal em junho na BU (compraram fora da janela ou não geraram deal de Inside Sales — esses não devem entrar mesmo).

## Sobre o "Agenda R1"

A mesma função vive replicada em `src/components/crm/MeetingsList.tsx` (`classifySimple`). Se quiser que a Agenda R1 também reflita A017 sobre A010, replico a inversão lá também. Senão, mantenho só no relatório. Me diz qual prefere.

## Sem mudanças em

- Webhooks (já corretos).
- Dados históricos (deals e transações ficam como estão).
- Demais relatórios (faturamento por canal usa outro caminho).
