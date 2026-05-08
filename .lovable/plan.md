## Promover Thayna para Closer Inside N3 em abril/2026

### Contexto

Hoje a Thayna (sdr_id `66a5a9ea-6d48-4831-b91c-7d79cf00aac2`) tem em `sdr_comp_plan` o cargo **Closer Inside N2** vigente desde 2026-04-01 (sem data fim). Isso faz o Fechamento puxar a meta de Contratos Pagos do N2 (35%), e não os 40% que você configurou no N3.

### O que fazer

1. **Encerrar o registro N2 vigente** em `sdr_comp_plan`
   - Setar `vigencia_fim = 2026-03-31` no plano N2 que hoje está com `vigencia_inicio=2026-04-01` (ou seja, anular esse plano marcando-o como já encerrado antes de abril).

2. **Criar novo registro N3 para abril/2026**
   - `sdr_id = 66a5a9ea-...`
   - `cargo_catalogo_id = d7bdc06e-d63a-49b8-9ccc-c9c8f06aa037` (Closer Inside N3)
   - `vigencia_inicio = 2026-04-01`
   - `vigencia_fim = NULL`
   - `status = APPROVED`

3. **Recalcular o payout DRAFT de abril/2026 da Thayna**
   - Atualizar `sdr_month_payout` (`id=2eb63f95-...`):
     - `cargo_vigente = 'Closer Inside N3'`
     - `nivel_vigente = 3`
     - `cargo_catalogo_id_fechamento = d7bdc06e-...`
   - O hook `useActiveMetricsForSdr` passa a resolver as métricas pelo cargo N3 → Contratos Pagos = 40% das Realizadas.
   - Tela vai recalcular Variável e Total ao abrir/clicar "Salvar e Recalcular".

### Detalhes técnicos

- Operação 100% de dados (INSERT/UPDATE em `sdr_comp_plan` e `sdr_month_payout`). Nenhum arquivo de código será alterado.
- Memória `Payout Recalculation Sync` é respeitada: ao alinhar `cargo_catalogo_id_fechamento` com o cargo global N3, o recálculo automático volta a funcionar normalmente.
- Se preferir manter histórico, em vez de "anular" o plano N2 de abril podemos apenas trocar o `cargo_catalogo_id` desse mesmo registro para N3 — mais simples e preserva o id. Recomendo essa abordagem.

### Validação após execução

- Conferir em `/fechamento-sdr/2eb63f95-...?from=2026-04&bu=incorporador`:
  - Cabeçalho mostra "Closer Inside N3", OTE 9.000, Fixo 6.300.
  - Linha "Contratos Pagos" mostra **Meta: 40% de 166 Realizadas = 66**.
