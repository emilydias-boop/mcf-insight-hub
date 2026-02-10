

# Corrigir erro "toLowerCase" e proteger contra emails nulos

## Problema
A tabela `sdr` tem 6 registros do consorcio com email = null. O codigo em `useTeamMeetingsData.ts` chama `.toLowerCase()` no email sem verificar se e nulo, causando o crash.

## Correcoes

### 1. Proteger `useTeamMeetingsData.ts` contra emails nulos (linhas 48 e 56)
Filtrar SDRs sem email antes de criar o Set e o Map:

```typescript
// linha 48: filtrar nulls
return new Set(sdrs.filter(sdr => sdr.email).map(sdr => sdr.email.toLowerCase()));

// linha 56: filtrar nulls  
sdrs.filter(sdr => sdr.email).forEach(sdr => {
  map.set(sdr.email.toLowerCase(), sdr.name);
});
```

### 2. Proteger `useSdrsFromSquad.ts` no tipo
Atualizar a interface para refletir que email pode ser nulo:
```typescript
email: string | null;
```

### 3. Dados pendentes - emails dos SDRs do Consorcio
Voce precisara fornecer os emails corretos dos SDRs do consorcio para que eles aparecam com metricas no painel. Sem email, o sistema nao consegue vincular as reunioes da agenda ao SDR.

Tambem ha registros **duplicados** (dois "Ithaline" e dois "Ygor") que devem ser limpos.

## Resultado
- O painel do consorcio vai **parar de dar erro** imediatamente
- SDRs sem email aparecerao na lista mas sem metricas vinculadas
- Apos inserir os emails corretos, as metricas serao exibidas automaticamente

