

# Plano: Corrigir Visualizacao do Botao de Edicao na Agenda R2

## Diagnostico

O codigo ja foi implementado corretamente, mas a interface nao esta refletindo as mudancas.

### O que foi implementado (e esta correto)

| Arquivo | Status |
|---------|--------|
| `src/hooks/useTransferR2Attendee.ts` | Criado |
| `src/components/crm/R2AttendeeTransferModal.tsx` | Criado |
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Modificado com botao Pencil |

### Codigo atual (linha 226-240 do Drawer)

```typescript
{canTransfer && (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8 text-primary hover:bg-primary/10"
    onClick={(e) => {
      e.stopPropagation();
      setAttendeeToTransfer(att);
      setTransferModalOpen(true);
    }}
    title="Transferir participante"
  >
    <Pencil className="h-4 w-4" />
  </Button>
)}
```

### Permissoes

```typescript
const { role } = useAuth();
const canTransfer = ['admin', 'manager', 'coordenador'].includes(role || '');
// Usuario atual: admin -> canTransfer = true
```

## Problema Identificado

A imagem mostra um icone de "chat/comentario" que **nao existe** no codigo atual do drawer. Isso indica:

1. **Cache do navegador** - O preview esta mostrando uma versao antiga
2. **Hot reload nao aplicado** - O codigo foi salvo mas nao recarregado

## Solucao

### Opcao 1: Refresh Forcado (mais rapido)

O usuario precisa fazer um **refresh forcado** no navegador:
- **Windows/Linux**: `Ctrl + Shift + R` ou `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Opcao 2: Verificar Deploy

Se o refresh nao resolver, posso:
1. Adicionar um log de debug no codigo
2. Verificar se o arquivo foi salvo corretamente
3. Forcar rebuild do preview

## Resultado Esperado

Apos o refresh, cada participante devera mostrar:

```text
+------------------------------------------+
|  [F] Francisco Antonio da Silva Rocha    |
|      Remanejado | Contrato Pago          |
|      +5511984768433                       |
|                              [✏️] [🗑️]   |
+------------------------------------------+
          Pencil    Trash2
          (azul)    (vermelho)
```

## Proximo Passo

Se o refresh forcado nao funcionar, posso adicionar um `console.log` para debug ou verificar se ha algum erro no build. Por favor, tente o refresh forcado primeiro e me avise se o botao de lapis aparece.

