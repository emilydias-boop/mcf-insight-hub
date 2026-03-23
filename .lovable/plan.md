

## Plano: Corrigir qualidade de áudio e estabilidade das ligações Twilio

### Diagnóstico

O `Device` do Twilio Voice SDK está sendo criado com configuração mínima (apenas `logLevel: 1`). Faltam:

1. **Codec preferencial**: Sem especificar `opus` como codec preferido, o SDK pode negociar codecs de menor qualidade que causam chiado
2. **Edge/Region**: Sem definir o edge mais próximo (`south-america`), o áudio trafega por servidores distantes, causando latência e drops
3. **DSCP**: Sem `enableDscp: true`, os pacotes de áudio não recebem prioridade na rede
4. **Close protection**: Sem handler de `tokenWillExpire`, o token pode expirar mid-call causando queda

### Correção

| Arquivo | O que muda |
|---------|-----------|
| `src/contexts/TwilioContext.tsx` | Adicionar configuração de codec, edge, DSCP e token refresh no Device |

### Detalhes da mudança

Na criação do Device (linha 183), adicionar:

```typescript
const twilioDevice = new Device(data.token, {
  logLevel: 1,
  codecPreferences: ['opus', 'pcmu'],
  edge: 'south-america',
  enableDscp: true,
  closeProtection: true,
});
```

E adicionar handler de `tokenWillExpire` para renovar o token antes de expirar durante uma chamada ativa:

```typescript
twilioDevice.on('tokenWillExpire', async () => {
  console.log('Twilio token will expire soon, refreshing...');
  const { data: refreshData } = await supabase.functions.invoke('twilio-token', {
    body: { identity: user.email || user.id }
  });
  if (refreshData?.token) {
    twilioDevice.updateToken(refreshData.token);
    tokenCreatedAt.current = Date.now();
  }
});
```

### Resultado esperado
- **Opus codec**: melhor qualidade de áudio, menos chiado
- **Edge south-america**: menor latência para ligações no Brasil
- **DSCP**: priorização de pacotes de voz na rede
- **Token refresh automático**: evita queda por expiração de token durante chamada longa
- **Close protection**: avisa o usuário antes de fechar a aba durante chamada

