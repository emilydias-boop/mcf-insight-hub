## Diagnóstico final

Confirmado direto na Hubla:
- **66** compradores únicos de A017 (VSL + Manychat) com `sale_date` em **junho/2026** → é exatamente o número que você vê no painel da Hubla.
- O funil hoje mostra **30** porque:
  1. usa só `customer_email` (perde casos onde email do CRM ≠ email da Hubla);
  2. ancora "Entradas" no `created_at` do **deal** do CRM, não na `sale_date` da Hubla — então compradores de junho cujo deal já existia (criado antes de junho) ficam de fora.

## O que mudar

Tratar A017 como **canal ancorado na compra Hubla**, não no deal:

1. **Linha A017 — Entradas (junho)** = compradores únicos A017 com `sale_date` na janela. Dedup por email **ou** telefone (últimos 9 dígitos). Vai dar exatamente **66**.
2. **Linha A017 — R1 Agendada / Realizada / No-Show / Contrato Pago** = continuam vindo dos attendees na janela, mas o lead é classificado como A017 sempre que existir compra A017 (por email **ou** telefone), independentemente da data da compra ou de quando o deal foi criado. Isso traz os 26 leads que hoje caem em A010.
3. **Outros canais (A010, ANAMNESE, OUTROS)** — sem mudança na semântica de "Entradas" (continuam = deals criados na janela).
4. **Versionar `queryKey`s** afetadas para o cache antigo cair e a tela atualizar na hora.
5. **Sem alterar** webhooks, dados históricos ou outros relatórios.

## Resultado esperado em junho

| Canal   | Entradas antes | Entradas depois |
|---------|----------------|-----------------|
| A017    | 30             | **66**          |
| A010    | 299            | ~270 (perde os 26 que eram A017 mascarados) |
| Outros  | sem mudança    | sem mudança     |

Se topar, eu implemento.