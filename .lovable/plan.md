

## Problema

No `LeadProfileSection.tsx`, linha 131, os valores dos campos usam a classe `truncate` que corta o texto com "..." quando é longo demais — especialmente problemático para campos como "Objetivos" que contêm listas.

```tsx
<p className="text-sm text-foreground truncate">...</p>
```

## Solução

Trocar `truncate` por `break-words` para que o texto quebre em múltiplas linhas ao invés de ser cortado:

**Arquivo:** `src/components/crm/LeadProfileSection.tsx`, linha ~131

```tsx
// De:
<p className="text-sm text-foreground truncate">

// Para:
<p className="text-sm text-foreground break-words">
```

Mudança de uma única classe CSS. O texto longo agora será exibido por completo, quebrando linha quando necessário.

