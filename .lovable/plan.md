
# Corrigir Redirecionamento da Agenda no Consorcio

## Problema

O dialogo "Agendar Reuniao" (`SdrScheduleDialog`) tem dois caminhos hardcoded para o CRM Incorporador:

1. **"Ir para Agenda"** navega para `/crm/agenda` (hardcoded) em vez de `/consorcio/crm/agenda`
2. **"Agendar aqui"** carrega closers sem filtro de BU (`useClosersWithAvailability()` sem parametro), mostrando closers do Incorporador em vez do Consorcio

## Solucao

### Arquivo: `src/components/crm/SdrScheduleDialog.tsx`

Duas alteracoes:

1. **Importar e usar `useCRMBasePath`** do BUContext para obter o basePath correto da BU ativa
2. **Importar e usar `useActiveBU`** para passar o filtro de BU ao hook `useClosersWithAvailability`

### Alteracoes especificas:

**Imports** - Adicionar:
```text
import { useCRMBasePath } from '@/hooks/useActiveBU';
import { useActiveBU } from '@/hooks/useActiveBU';
```

**Dentro do componente** - Adicionar:
```text
const basePath = useCRMBasePath();
const activeBU = useActiveBU();
```

**Linha 34** - Passar BU ao hook de closers:
```text
// Antes:
const { data: closers = [] } = useClosersWithAvailability();

// Depois:
const { data: closers = [] } = useClosersWithAvailability(activeBU);
```

**Linha 49** - Usar basePath dinamico:
```text
// Antes:
navigate(`/crm/agenda?${params.toString()}`);

// Depois:
navigate(`${basePath}/agenda?${params.toString()}`);
```

### Resultado

- No Consorcio: "Ir para Agenda" navega para `/consorcio/crm/agenda` e "Agendar aqui" mostra closers do Consorcio
- No Incorporador: comportamento mantido (`/crm/agenda` com closers do Incorporador)
