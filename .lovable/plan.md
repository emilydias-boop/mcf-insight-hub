## Problema

Juliana Rodrigues foi desligada em **23/03/2026** (março), mas continua aparecendo na lista de "Fechamentos de abril 2026".

## Causa raiz

No hook `useSdrPayouts` (`src/hooks/useSdrFechamento.ts`, linhas 280-286), a regra de filtragem é:

```ts
if (p.sdr?.active !== false) return true;   // <-- bug
const employee = (p as any).employee;
if (!employee?.data_demissao) return false;
return employee.data_demissao.substring(0, 7) === anoMes;
```

Verificação no banco confirma:
- `employees.status = 'desligado'`, `data_demissao = 2026-03-23`
- `sdr.active = true` (não foi sincronizado)

Como a primeira condição olha apenas `sdr.active`, e ele está `true`, a Juliana passa direto sem nunca cair na regra que exige `data_demissao` dentro do mês selecionado. Existe um payout dela em `sdr_month_payout` para 2026-04 (gerado antes ou logo após o desligamento), por isso ela renderiza.

A fonte de verdade do desligamento é a tabela `employees` (status + data_demissao), não o flag `sdr.active`.

## Correção

Ajustar o filtro em `useSdrPayouts` para considerar **employees** como fonte de verdade:

```ts
result = result.filter(p => {
  const employee = (p as any).employee as EmployeeWithCargo | null;
  const isTerminated =
    employee?.data_demissao != null || p.sdr?.active === false;

  if (!isTerminated) return true;

  // Desligado: mostrar somente se a demissão ocorreu no mês selecionado ou depois
  // (se desligou em março, não aparece em abril; se desligou em abril, ainda aparece)
  const demissao = employee?.data_demissao;
  if (!demissao) return false;
  return demissao.substring(0, 7) >= anoMes;
});
```

Regra de negócio: o colaborador aparece no fechamento do mês em que foi desligado (para fins de pro-rata e acerto final), mas **não** nos meses posteriores.

## Arquivo alterado

- `src/hooks/useSdrFechamento.ts` (função `useSdrPayouts`, bloco de filtros ~linha 280)

## Validação pós-mudança

1. Abrir `/fechamento-sdr?month=2026-04&bu=incorporador` → Juliana **não** deve aparecer.
2. Abrir `/fechamento-sdr?month=2026-03&bu=incorporador` → Juliana **deve** aparecer (mês do desligamento, com pro-rata).
3. Conferir que demais SDRs ativos continuam aparecendo normalmente.

## Observação adicional (não bloqueante)

O flag `sdr.active = true` para um colaborador desligado indica drift entre `employees` e `sdr`. Isso é coberto pela memória [HR Profile Squad Sync] (sincronização bidirecional). Não vou alterar o registro neste plano — o fix acima já resolve a exibição independentemente do drift, e qualquer ajuste em sync deve ser tratado em tarefa separada.
