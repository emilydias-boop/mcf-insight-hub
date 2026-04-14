

## Plano: Filtrar colaboradores desligados fora do mês no fechamento

### Problema

A Juliana foi desligada mas ainda aparece na lista de fechamento de abril 2026. O filtro atual (linha 278 do `useSdrFechamento.ts`) permite qualquer SDR inativo que tenha `dias_uteis_trabalhados` preenchido — sem verificar se a demissão ocorreu no mês selecionado.

A Edge Function já faz essa validação corretamente (só cria payouts para desligados cujo `data_demissao` cai no mês), mas se um payout foi criado em um mês anterior e não foi removido, ele continua aparecendo.

### Alteração

**`src/hooks/useSdrFechamento.ts`**

1. Adicionar `data_demissao` ao select da query de employees (linha ~205):
   ```ts
   .select(`id, nome_completo, departamento, cargo, sdr_id, status, data_demissao, cargo_catalogo_id, fechamento_manual, ...`)
   ```

2. Incluir `data_demissao` no mapa `sdrToEmployee` e no tipo `EmployeeWithCargo`.

3. Alterar o filtro da linha 278 para verificar se colaboradores desligados têm `data_demissao` dentro do mês selecionado:
   ```ts
   result = result.filter(p => {
     if (p.sdr?.active !== false) return true; // ativo, mostra sempre
     
     const employee = (p as any).employee;
     if (!employee?.data_demissao) return false; // desligado sem data, esconde
     
     // Só mostra se a demissão foi no mês selecionado
     const demissaoMonth = employee.data_demissao.substring(0, 7); // "yyyy-MM"
     return demissaoMonth === anoMes;
   });
   ```

### Resultado

Juliana só aparecerá no fechamento do mês em que foi efetivamente desligada, não em meses subsequentes.

