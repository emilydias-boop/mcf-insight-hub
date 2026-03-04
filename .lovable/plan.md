

## Problema

Ao recalcular fevereiro, a Edge Function busca `nivel` e `cargo` da tabela `cargos_catalogo` usando o `cargo_catalogo_id` **atual** do employee. Se o colaborador foi promovido de N1→N2 em março, o recálculo de fevereiro grava N2 incorretamente.

Os **valores financeiros** (OTE, fixo, variável) estão corretos porque vêm do `sdr_comp_plan` que é versionado por vigência. Mas o `nivel_vigente` e `cargo_vigente` vêm do cargo atual.

## Solução

Derivar o nível histórico a partir do `sdr_comp_plan` vigente no mês, que já contém os valores corretos da época.

### 1. Edge Function `recalculate-sdr-payout`

Após encontrar o `compPlan` vigente para o mês (linha ~641-649), usar os valores do comp_plan para fazer match com o `cargos_catalogo` e descobrir o nível da época:

```typescript
// Buscar nível histórico baseado no OTE do comp_plan vigente
let nivelVigente = cargoInfo?.nivel || sdr.nivel || null;
let cargoVigente = cargoInfo?.nome_exibicao || null;

if (compPlan) {
  // Tentar encontrar o cargo que corresponde ao OTE do comp_plan
  const { data: cargoHistorico } = await supabase
    .from('cargos_catalogo')
    .select('nivel, nome_exibicao')
    .eq('ote_total', compPlan.ote_total)
    .eq('fixo_valor', compPlan.fixo_valor)
    .eq('ativo', true)
    .limit(1)
    .single();
  
  if (cargoHistorico) {
    nivelVigente = cargoHistorico.nivel;
    cargoVigente = cargoHistorico.nome_exibicao;
  }
}
```

Depois usar `nivelVigente` e `cargoVigente` no upsert (linha 1130-1131) em vez de `cargoInfo?.nivel`.

### 2. Alternativa mais robusta (recomendada)

Adicionar `cargo_catalogo_id` ao `sdr_comp_plan` para que ao versionar o plano (close-and-create), o cargo da época fique gravado:

- **Migration**: `ALTER TABLE sdr_comp_plan ADD COLUMN IF NOT EXISTS cargo_catalogo_id uuid REFERENCES cargos_catalogo(id);`
- **Sync/Edit plan logic**: Gravar o `cargo_catalogo_id` do employee ao criar novo comp_plan
- **Edge Function**: Buscar nível do `cargo_catalogo_id` do comp_plan (histórico) em vez do employee (atual)

### Resultado

- Ao clicar "Recalcular Todos" para fevereiro, o nível exibido será o que estava vigente em fevereiro (N1), não o atual (N2)
- Os valores financeiros já estão corretos (vêm do comp_plan versionado)
- Fechamentos futuros também gravarão o nível correto automaticamente

