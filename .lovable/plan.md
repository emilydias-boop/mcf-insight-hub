
# Plano de Correção - Login que Não Funciona

## Diagnóstico Confirmado

O banco de dados Supabase está retornando **erro 544 - Connection Timeout**. Isso significa que:
- O servidor Supabase está sobrecarregado ou instável
- As requisições de login podem estar falhando silenciosamente
- O refresh token também está falhando (`Failed to fetch` no network)

## Problemas Identificados no Código

### 1. Login sem Feedback Visual Adequado
Na função `signIn` do AuthContext, quando ocorre timeout ou falha de conexão:
- O usuário fica sem feedback (botão pode parecer que nada acontece)
- O `toast.error` pode não disparar se o erro for de rede

### 2. Chamadas Síncronas Bloqueantes
O fluxo atual de login faz várias chamadas em sequência que podem bloquear:
```typescript
await signInWithPassword()     // ← Se travar aqui, nada acontece
await checkUserBlocked()       // ← Timeout potencial
await profiles.update()        // ← Timeout potencial  
await fetchUserRoles()         // ← Timeout potencial
```

---

## Correções Propostas

### Correção 1: Adicionar Timeout ao Login

Envolver a chamada de login em um Promise.race para garantir resposta em tempo máximo:

```text
┌─────────────────────────────────────────────────────────────┐
│  signIn() atual:                                            │
│  ─────────────────                                          │
│  await signInWithPassword() → pode travar infinitamente     │
│                                                             │
│  signIn() corrigido:                                        │
│  ─────────────────────                                      │
│  Promise.race([                                             │
│    signInWithPassword(),                                    │
│    timeout(15000) → "Servidor não respondeu"                │
│  ])                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Correção 2: Melhorar Tratamento de Erros de Rede

Adicionar detecção específica para erros de conexão/rede e exibir mensagem apropriada.

### Correção 3: Separar Chamadas Críticas de Secundárias

Fluxo proposto:
1. **Crítico**: `signInWithPassword()` → Se sucesso, login ok
2. **Background**: `checkUserBlocked`, `fetchUserRoles`, `profiles.update`

Isso permite que o usuário entre no app mesmo se as chamadas secundárias falharem.

---

## Alterações em Arquivos

### Arquivo: `src/contexts/AuthContext.tsx`

**Mudanças:**
1. Adicionar timeout de 15s ao `signInWithPassword`
2. Melhor detecção de erros de rede vs erros de autenticação
3. Separar chamadas críticas de secundárias
4. Feedback visual melhorado (toast para timeout de rede)

```text
Antes:
──────
const signIn = async () => {
  setLoading(true);
  try {
    const { error } = await supabase.auth.signInWithPassword(...);
    if (error) throw error;
    await checkUserBlocked(...);   // ← Pode travar
    await profiles.update(...);    // ← Pode travar
    await fetchUserRoles(...);     // ← Pode travar
    navigate('/');
  } catch (error) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
}

Depois:
───────
const signIn = async () => {
  setLoading(true);
  try {
    // Login com timeout de 15s
    const result = await withTimeout(
      supabase.auth.signInWithPassword(...),
      15000,
      { error: { message: 'Servidor não respondeu. Tente novamente.' } }
    );
    
    if (result.error) throw result.error;
    
    toast.success('Login realizado!');
    navigate('/');  // ← Entrar imediatamente
    
    // Background: verificar bloqueio e roles (não bloqueia)
    setTimeout(() => {
      checkAndLoadRoles(result.data.user.id);
    }, 0);
    
  } catch (error) {
    // Detectar erros de rede
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      toast.error('Erro de conexão. Verifique sua internet.');
    } else {
      toast.error(error.message || 'Erro ao fazer login');
    }
  } finally {
    setLoading(false);
  }
}
```

### Arquivo: `src/pages/Auth.tsx`

**Mudanças:**
1. Adicionar estado local de loading para o botão
2. Mostrar feedback de "tentando conectar" após 5s

---

## Ação Imediata Recomendada

Antes de aplicar o código, recomendo testar:

1. **Verificar status do Supabase**: Acessar https://status.supabase.com para ver se há incidentes
2. **Testar em aba anônima**: Limpar qualquer sessão corrompida no localStorage
3. **Verificar no dashboard do Supabase**: Ver se há muitas conexões ativas ou queries lentas

---

## Resultado Esperado

Após as correções:
- Login terá timeout de 15s com mensagem clara
- Usuário verá feedback imediato se a conexão falhar
- O app entrará mesmo que chamadas secundárias falhem (roles carregam depois)
- Erros de rede serão diferenciados de erros de credenciais

---

## Observação Importante

O erro 544 (Connection Timeout) no Supabase indica sobrecarga ou instabilidade do servidor. As correções de código ajudam a dar melhor experiência ao usuário, mas se o banco continuar instável, será necessário:
- Verificar uso de recursos no dashboard do Supabase
- Considerar upgrade do plano se necessário
- Otimizar queries que podem estar sobrecarregando o banco
