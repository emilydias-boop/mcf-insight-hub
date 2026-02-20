
# Notificacoes de Documentos para Colaborador e Gestor

## Objetivo

Sempre que um documento for enviado (pelo colaborador ou pelo gestor), ambos devem receber um registro/notificacao no sistema via tabela `user_notifications`.

## Pontos de Acao Identificados

Existem 6 fluxos de envio de documentos no sistema:

| Fluxo | Quem envia | Quem notificar |
|-------|-----------|----------------|
| Enviar Documento (Meu RH) | Colaborador | Gestor |
| Enviar NFSe (Meu RH) | Colaborador | Gestor |
| Enviar NFSe Fechamento (SDR) | Colaborador | Gestor |
| Upload arquivo para colaborador | Gestor | Colaborador |
| Aceite de Termo | Colaborador | Gestor |
| Atualizar status documento | Gestor | Colaborador |

## Solucao

Criar uma funcao utilitaria `notifyDocumentAction` que insere registros na tabela `user_notifications` para ambas as partes. Depois, chamar essa funcao em cada ponto de acao apos o sucesso da operacao principal.

A tabela `user_notifications` ja existe com a estrutura necessaria: `user_id`, `title`, `message`, `type`, `action_url`, `metadata`.

## Detalhes Tecnicos

### 1. Novo arquivo: `src/lib/notifyDocumentAction.ts`

Funcao utilitaria que recebe:
- `employeeId` (ID do employee)
- `action` (tipo: "documento_enviado", "nfse_enviada", "termo_aceito", "documento_recebido", etc.)
- `documentTitle` (nome do documento)
- `sentBy` ("colaborador" | "gestor")

Logica:
1. Buscar `profile_id` e `gestor_id` do employee
2. Buscar `profile_id` do gestor (que tambem e um employee)
3. Inserir notificacao para o colaborador (profile_id do employee)
4. Inserir notificacao para o gestor (profile_id do gestor)
5. Se algum dos dois nao tiver profile_id, pular silenciosamente

```text
async function notifyDocumentAction({
  employeeId,
  action,
  documentTitle,
  sentBy
}) {
  // 1. Buscar employee com profile_id e gestor_id
  const { data: emp } = await supabase
    .from('employees')
    .select('profile_id, gestor_id, nome_completo')
    .eq('id', employeeId)
    .single();

  if (!emp?.gestor_id) return;

  // 2. Buscar gestor profile_id
  const { data: gestor } = await supabase
    .from('employees')
    .select('profile_id, nome_completo')
    .eq('id', emp.gestor_id)
    .single();

  // 3. Montar notificacoes
  const notifications = [];

  if (emp.profile_id) {
    notifications.push({
      user_id: emp.profile_id,
      title: tituloPorAcao(action, sentBy),
      message: mensagemPorAcao(action, documentTitle, sentBy, gestor?.nome_completo, emp.nome_completo),
      type: 'info',
    });
  }

  if (gestor?.profile_id) {
    notifications.push({
      user_id: gestor.profile_id,
      title: tituloPorAcao(action, sentBy === 'colaborador' ? 'gestor' : 'colaborador'),
      message: mensagemPorAcao(...),
      type: sentBy === 'colaborador' ? 'action_required' : 'info',
    });
  }

  // 4. Inserir
  if (notifications.length > 0) {
    await supabase.from('user_notifications').insert(notifications);
  }
}
```

### 2. Integrar nos 6 pontos de acao

**Arquivo: `src/components/meu-rh/EnviarDocumentoModal.tsx`**
- Apos `toast.success`, chamar `notifyDocumentAction({ employeeId, action: 'documento_enviado', documentTitle, sentBy: 'colaborador' })`

**Arquivo: `src/components/meu-rh/EnviarNfseModal.tsx`**
- Apos `toast.success`, chamar `notifyDocumentAction({ employeeId, action: 'nfse_enviada', documentTitle: monthLabel, sentBy: 'colaborador' })`

**Arquivo: `src/components/sdr-fechamento/EnviarNfseFechamentoModal.tsx`**
- Apos `toast.success`, chamar `notifyDocumentAction({ employeeId, action: 'nfse_enviada', documentTitle: monthLabel, sentBy: 'colaborador' })`

**Arquivo: `src/hooks/useUserFiles.ts`** (useUploadUserFile - onSuccess)
- Apos upload bem-sucedido, buscar employee pelo `userId` e chamar notificacao com `sentBy: 'gestor'`

**Arquivo: `src/hooks/useAssetTerms.ts`** (acceptTerm - onSuccess)
- Apos aceite, chamar `notifyDocumentAction({ employeeId: data.employee_id, action: 'termo_aceito', documentTitle: numPatrimonio, sentBy: 'colaborador' })`

**Arquivo: `src/hooks/useEmployees.ts`** (createDocument e updateDocument - onSuccess)
- Chamar notificacao com `sentBy: 'gestor'`

### 3. Nenhuma alteracao no banco de dados

A tabela `user_notifications` ja existe com todos os campos necessarios. Nao e necessaria migracao SQL.

### Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/lib/notifyDocumentAction.ts` | **Novo** - funcao utilitaria |
| `src/components/meu-rh/EnviarDocumentoModal.tsx` | Adicionar chamada de notificacao |
| `src/components/meu-rh/EnviarNfseModal.tsx` | Adicionar chamada de notificacao |
| `src/components/sdr-fechamento/EnviarNfseFechamentoModal.tsx` | Adicionar chamada de notificacao |
| `src/hooks/useUserFiles.ts` | Adicionar notificacao no onSuccess do upload |
| `src/hooks/useAssetTerms.ts` | Adicionar notificacao no onSuccess do aceite |
| `src/hooks/useEmployees.ts` | Adicionar notificacao em createDocument e updateDocument |
