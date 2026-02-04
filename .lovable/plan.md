
# Plano: Adicionar Alex Dias a Lista de SDRs

## Problema Identificado

O contrato pago de **Jose Vianey De Souza** (agendado por Alex Dias) nao esta sendo contabilizado nas metricas do Julio porque Alex Dias nao esta na `SDR_LIST`.

**Dados atuais:**
- Hudson Alves: booked by Leticia Nunes ✓ (na lista)
- Jose Vianey: booked by Alex Dias ✗ (NAO na lista)
- cleano melo: booked by Antony Elias ✓ (na lista)

## Solucao

Adicionar Alex Dias a lista de SDRs validos.

## Alteracao

### Arquivo: `src/constants/team.ts`

**Linha 11** - Adicionar Alex Dias antes do fechamento do array:

```typescript
export const SDR_LIST = [
  { nome: "Juliana Rodrigues", email: "juliana.rodrigues@minhacasafinanciada.com" },
  { nome: "Julia Caroline", email: "julia.caroline@minhacasafinanciada.com" },
  { nome: "Antony Elias", email: "antony.elias@minhacasafinanciada.com" },
  { nome: "Vinicius Rangel", email: "rangel.vinicius@minhacasafinanciada.com" },
  { nome: "Jessica Martins", email: "jessica.martins@minhacasafinanciada.com" },
  { nome: "Leticia Nunes", email: "leticia.nunes@minhacasafinanciada.com" },
  { nome: "Caroline Correa", email: "carol.correa@minhacasafinanciada.com" },
  { nome: "Caroline Souza", email: "caroline.souza@minhacasafinanciada.com" },
  { nome: "Alex Dias", email: "alex.dias@minhacasafinanciada.com" },  // NOVO
];
```

## Resultado Esperado

- Julio mostrara 3 contratos pagos corretamente
- Todas as metricas agendadas por Alex Dias serao contabilizadas
- Relatorios gerais de performance incluirao esses dados

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/constants/team.ts` | Adicionar Alex Dias a SDR_LIST |
