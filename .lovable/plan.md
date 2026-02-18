

# Correção: Mostrar todos os SDRs da BU na tabela

## Problema

A tabela "Faturamento por SDR" só mostra SDRs que tiveram pelo menos 1 transação matcheada. SDRs com 0 transações não aparecem.

Existem 11 SDRs ativos na BU incorporador (Alex Dias, Antony Elias, Carol Correa, Caroline Souza, Evellyn Santos, Jessica Martins, Julia Caroline, Juliana Rodrigues, Leticia Nunes, Robert Gusmao, Yanca Tavares), mas só 3 aparecem na tabela.

## Solução

Pre-popular o `sdrMap` com todos os SDRs válidos da BU (com valores zerados) ANTES de processar as transações. Assim, todos os SDRs aparecem na tabela mesmo com 0 vendas.

### Arquivo: `src/hooks/useAcquisitionReport.ts`

1. Buscar nomes dos SDRs junto com os emails (já temos a query `buSdrs`, basta expandir para incluir `name`)
2. Na construção do `sdrMap` (passo 10), inicializar com todas as entradas dos SDRs da BU com valores zerados
3. Quando transações forem processadas, acumular nos SDRs que já existem no map

### Detalhes técnicos

**Query 2b** -- expandir para retornar nome e email:

```text
// Antes: retorna apenas emails
sdr.select('email')

// Depois: retorna email e name
sdr.select('email, name')
// Retornar array de { email, name } em vez de string[]
```

**Query 2c** -- criar mapa profile_id -> nome do SDR:

```text
// Criar Map<profileId, sdrName> em vez de Set<profileId>
// Para usar no pre-populate do sdrMap
```

**Passo 10** -- pre-popular sdrMap:

```text
// Antes do forEach(classified):
validSdrNames.forEach((name, profileId) => {
  sdrMap.set(name, { txs: 0, gross: 0, net: 0, outsideCount: 0, outsideRev: 0 });
});
```

## Resultado

- Tabela SDR mostra todos os 11 SDRs da BU incorporador
- SDRs sem vendas aparecem com 0 transações e R$ 0,00
- Permite à gestão ver quem não está vendendo

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/hooks/useAcquisitionReport.ts` | Expandir query de SDRs para incluir nomes; pre-popular sdrMap com todos os SDRs da BU |

