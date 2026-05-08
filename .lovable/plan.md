## Promover Julio para Closer Inside N2 em abril/2026

### Diagnóstico

- Julio (`sdr_id=21393c7b-faa7-42e2-b1d8-920e3a808b33`) tem em `sdr_comp_plan` o cargo **Closer Inside N1** (`c2909e20-3bfc-4a9f-853f-97f065af099a`) vigente desde 2026-04-01.
- O payout de abril/2026 (`id=db16a333-4f0f-4f8d-84cd-65e15eb6bdee`) está com `cargo_vigente='Closer Inside N1'`, `nivel_vigente=1` e `status=APPROVED`.
- Por isso o Fechamento ainda exibe N1, mesmo que você tenha mudado o cargo dele em outro lugar.

### O que fazer (operação de dados)

1. **`sdr_comp_plan`** — trocar o cargo do registro vigente (vigencia_inicio=2026-04-01) para **Closer Inside N2** (`fd8d5a86-4687-4e89-b00d-84e7e5bcd563`).
2. **`sdr_month_payout`** (id `db16a333-…`) — atualizar:
   - `cargo_vigente = 'Closer Inside N2'`
   - `nivel_vigente = 2`
   - `cargo_catalogo_id_fechamento = fd8d5a86-…`
   - `status = 'DRAFT'` (para destravar recálculo, já que estava APPROVED)

Após executar, abra o fechamento do Julio e clique em "Salvar e Recalcular" para refletir a meta nova (35% para N2).

### Observação

O payout estava aprovado. Reverter para DRAFT vai reabrir o fechamento dele para edição/recálculo. Se preferir manter o histórico aprovado intacto e gerar um ajuste, me avise antes.
