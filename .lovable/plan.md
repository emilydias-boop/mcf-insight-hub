

## Plano: Corrigir erro de conexão do Twilio Device

### Diagnóstico

O valor `edge: 'south-america'` configurado no Device **não é um edge válido** do Twilio Voice SDK. Os valores válidos são: `ashburn`, `dublin`, `frankfurt`, `singapore`, `sydney`, `tokyo`, `sao-paulo`, `roaming`.

Com um edge inválido, o Device não consegue se registrar no servidor WebSocket do Twilio, resultando em erro de conexão.

### Correção

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/TwilioContext.tsx` | Trocar `edge: 'south-america'` por `edge: 'sao-paulo'` |

Linha 186:
```typescript
// Antes
edge: 'south-america',

// Depois
edge: 'sao-paulo',
```

### Resultado
- O Device conecta ao edge correto do Twilio em São Paulo
- Menor latência para chamadas no Brasil
- Registro do dispositivo funciona normalmente

