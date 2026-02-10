
# Corrigir upsert de metas: buscar config em ambos os arrays de BU

## Problema
Na linha 209 de `useSdrTeamTargets.ts`, o upsert so procura o config em `SDR_TARGET_CONFIGS` (Incorporador). Tipos do Consorcio como `consorcio_sdr_agendamento_dia` nao sao encontrados, entao o sistema pula silenciosamente sem salvar nada no banco.

## Solucao
Alterar a linha 209 para buscar em ambos os arrays:

### Arquivo: `src/hooks/useSdrTeamTargets.ts`

Trocar:
```typescript
const config = SDR_TARGET_CONFIGS.find(c => c.type === type);
```
Por:
```typescript
const config = SDR_TARGET_CONFIGS.find(c => c.type === type)
  || CONSORCIO_SDR_TARGET_CONFIGS.find(c => c.type === type);
```

Cada BU continua com seus proprios registros separados na tabela `team_targets` -- os tipos `sdr_*` sao do Incorporador e os tipos `consorcio_sdr_*` sao do Consorcio. A unica mudanca e que o upsert agora reconhece os tipos do Consorcio e efetivamente grava no banco.

### Resultado
- Metas do Consorcio salvas com tipos `consorcio_sdr_*` (separadas do Incorporador)
- Metas do Incorporador continuam com tipos `sdr_*` (inalteradas)
- Cada BU le apenas seus proprios registros via o filtro `like('target_type', buPrefix + '%')`
