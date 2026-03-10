

## Problema: Leticia (e possivelmente outros SDRs) não consegue ligar

### Evidência no banco

Leticia tem **37 chamadas desde 6/Mar, TODAS com `twilio_call_sid = null` e `status = initiated`**. Nenhuma chamada dela conectou. Ela clica múltiplas vezes (intervalos de 3s entre tentativas), confirmando que nada acontece na tela.

Para comparação, outros SDRs como Alex (128/133 com SID), Caroline (69/69), Antony (49/49) funcionam normalmente. O problema é específico de alguns usuários.

Curiosamente, Leticia tinha chamadas funcionando em **Janeiro 2026** (5 calls com SID válido). Parou de funcionar em Março.

### 2 bugs encontrados

**Bug 1: Sem refresh de token Twilio (causa raiz)**

O token do Twilio tem TTL de 1 hora (`ttl = 3600` na edge function `twilio-token`). O `TwilioContext` inicializa o device UMA VEZ e nunca renova o token. Após 1 hora:
- O `deviceStatus` continua mostrando `ready` (o state local não muda)
- `device.connect()` falha silenciosamente porque o token expirou
- O SDR vê o botão ativo, clica, o registro é criado no banco, mas a chamada nunca conecta

Isso explica porque funciona para quem acabou de abrir a página, mas para quem fica logado por horas (como a Leticia), para de funcionar.

**Bug 2: `makeCall` catch não atualiza o banco**

Quando `device.connect()` lança exceção (token expirado, erro de rede), o `catch` na linha 336:
```js
catch (error) {
  console.error('Error making call:', error);
  setCallStatus('failed');
  return null;  // ← registro fica como 'initiated' para sempre
}
```
O registro já foi criado com `status: initiated` na linha 237, mas nunca é atualizado para `failed`. Isso gera as 37 chamadas fantasma da Leticia.

### Correção

**`src/contexts/TwilioContext.tsx`**:

1. **Token refresh automático**: Armazenar o timestamp de quando o token foi gerado. Antes de cada `makeCall`, verificar se o token tem mais de 50 min (margem de segurança). Se sim, chamar `initializeDevice()` novamente para renovar o token antes de conectar.

2. **Re-inicializar após falha de connect**: Se `device.connect()` falhar, destruir o device atual, setar `deviceStatus = 'disconnected'`, e tentar reinicializar + reconectar automaticamente (1 tentativa).

3. **Atualizar banco no catch**: Adicionar `updateCallInDb(callId, { status: 'failed', ended_at: now, duration_seconds: 0 })` no bloco catch do `makeCall`.

4. **Feedback visual**: Mostrar toast de erro específico quando a conexão falha ("Sessão expirada, reconectando...") para que o SDR saiba o que está acontecendo.

### Resultado esperado

- Token renovado automaticamente antes de expirar
- Se falhar, tenta reconectar uma vez automaticamente
- Registros fantasma não são mais criados (DB atualizado no catch)
- SDR vê feedback claro quando há problema de conexão

