
# Alerta Pos-Reuniao no AgendaMeetingDrawer (Consorcio)

## Resumo
Quando um closer do Consorcio marca uma reuniao como "Realizada", exibir um banner/alerta visivel informando que o lead ainda precisa de definicao: **Enviar Proposta** ou **Sem Sucesso**. Incluir botoes de acao rapida que direcionam o closer para a pagina de Pos-Reuniao ou abrem os modais diretamente.

## O que muda

### Arquivo: `src/components/crm/AgendaMeetingDrawer.tsx`

Adicionar um bloco condicional que aparece **apenas quando**:
1. A BU ativa e `consorcio` (ja disponivel via `useBUContext`)
2. O participante selecionado tem status `completed`

O bloco sera inserido logo apos os botoes de acao de status (linha ~1047), antes das Notas do Closer.

### Conteudo do alerta

Um banner amarelo/azul com:
- Icone de atencao e texto: **"Pendente: Definir resultado da reuniao"**
- Subtexto: "Envie uma proposta ou marque como Sem Sucesso na aba Pos-Reuniao"
- Botao: **"Ir para Pos-Reuniao"** (navega para `/consorcio/crm/pos-reuniao`)

### Secao tecnica

Mudanca unica no arquivo `src/components/crm/AgendaMeetingDrawer.tsx`:

1. Ja existem as dependencias necessarias: `useBUContext` (linha 14/309), `useNavigate` (linha 122), icones
2. Apos a `div` que contem os botoes de status (fecha na linha 1047), inserir:

```tsx
{activeBU === 'consorcio' && selectedParticipant.status === 'completed' && (
  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <span className="font-medium text-sm text-amber-700 dark:text-amber-400">
        Pendente: Definir resultado da reuniao
      </span>
    </div>
    <p className="text-xs text-muted-foreground">
      Envie uma proposta ou marque como Sem Sucesso na aba Pos-Reuniao.
    </p>
    <Button size="sm" variant="outline" onClick={() => navigate('/consorcio/crm/pos-reuniao')}>
      <FileText className="h-4 w-4 mr-2" />
      Ir para Pos-Reuniao
    </Button>
  </div>
)}
```

Nenhuma mudanca de banco de dados necessaria. Apenas 1 arquivo modificado.
