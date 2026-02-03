
# Plano: Adicionar Botão de Transferência na Linha do Participante (R1)

## Situação Atual

O drawer da Agenda R1 (`AgendaMeetingDrawer.tsx`) já possui:
- Botão "Mover" existente na parte inferior do drawer (linha 978-987)
- `MoveAttendeeModal` já implementado e funcional

Na linha de cada participante existe:
- Edição de telefone (lápis)
- Botão WhatsApp (MessageCircle) 
- Botão remover (lixeira)

**Falta**: Um botão de transferência diretamente na linha do participante.

---

## Solução

Adicionar um botão `ArrowRightLeft` na linha de cada participante que:
1. Seleciona automaticamente o participante clicado
2. Abre o `MoveAttendeeModal` já existente

---

## Alteração

**Arquivo**: `src/components/crm/AgendaMeetingDrawer.tsx`

**Localização**: Linhas 702-728 (seção de botões por participante)

**Adicionar** antes do botão de WhatsApp:

```typescript
{/* Botão Transferir - apenas para admins/managers */}
{canTransfer && (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8"
    onClick={(e) => {
      e.stopPropagation();
      setSelectedParticipantId(p.id);
      setShowMoveModal(true);
    }}
    title="Transferir participante"
  >
    <ArrowRightLeft className="h-4 w-4 text-purple-600" />
  </Button>
)}
```

**Também adicionar** a variável `canTransfer`:
```typescript
const { role } = useAuth();
const canTransfer = ['admin', 'manager', 'coordenador'].includes(role || '');
```

---

## Resultado Visual Esperado

```text
+------------------------------------------+
|  [O] Oldai                               |
|      Convidado | Selecionado             |
|      +5592991357  [✔] [✗]                |
|                    [↔️] [💬] [🗑️]         |
+------------------------------------------+
                    Transfer  WhatsApp  Delete
                    (roxo)    (verde)   (vermelho)
```

---

## Permissões

O botão será visível apenas para:
- `admin`
- `manager`
- `coordenador`

---

## Vantagens

1. **Reutiliza código existente** - `MoveAttendeeModal` já funciona
2. **Mínima alteração** - Apenas adiciona um botão
3. **Consistente com R2** - Mesma experiência visual
4. **Controle de permissão** - Apenas gestores podem transferir
