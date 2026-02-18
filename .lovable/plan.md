

# Correção: SDRs aparecem vazios na tabela

## Problema

Existe uma inconsistência de nomes entre duas fontes:
- **Pre-população** usa nomes da tabela `sdr` (ex: "Jessica Martins") via `sdrProfileMap`
- **Classificação** usa nomes da tabela `profiles.full_name` (ex: "Jessica Martins de Souza") via `sdrNameMap`

Como os nomes não batem, os SDRs pre-populados ficam com 0 transações, e as transações vão para entradas com nomes diferentes que depois são descartadas (porque o `sdrProfileIds` filtra corretamente, mas o nome resolvido vem de outra fonte).

## Solução

Usar `sdrProfileMap` como fonte única de nomes para SDRs válidos na etapa de classificação (passo 8), em vez de `sdrNameMap`.

### Arquivo: `src/hooks/useAcquisitionReport.ts`

**Linha ~301-302** -- Resolver nome do SDR via `sdrProfileMap`:

```text
// Antes:
const sdrName = sdrId
  ? (sdrNameMap.get(sdrId) || 'SDR Desconhecido')
  : (isAutomatic ? origin : 'Sem SDR');

// Depois:
const sdrName = sdrId
  ? (sdrProfileMap.get(sdrId) || sdrNameMap.get(sdrId) || 'SDR Desconhecido')
  : (isAutomatic ? origin : 'Sem SDR');
```

Isso garante que o nome usado na classificação seja o mesmo nome usado na pre-população do `sdrMap`.

**Linha ~311** -- Adicionar `sdrProfileMap` nas dependências do useMemo de classificação:

```text
// Antes:
}, [transactions, emailToAttendees, phoneToAttendees, closerNameMap, sdrNameMap, globalFirstIds, bu, sdrProfileIds]);

// Depois:
}, [transactions, emailToAttendees, phoneToAttendees, closerNameMap, sdrNameMap, sdrProfileMap, globalFirstIds, bu, sdrProfileIds]);
```

## Resultado

- Todos os 11 SDRs da BU incorporador aparecem na tabela
- SDRs com vendas mostram seus valores corretamente
- SDRs sem vendas aparecem com 0
- "Sem SDR" agrupa transações de owners que não são SDRs da BU

