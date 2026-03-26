

## Adicionar botão "Salvar" no drawer R2

### Problema
Campos de texto (profissão, idade, link da reunião, observações) só salvam no `onBlur`. Se o usuário digita e não clica fora, perde os dados. Não existe um botão explícito para salvar tudo.

### Solução
Adicionar um botão "Salvar" no footer do drawer que dispara o save de todos os campos pendentes das 3 abas de uma vez.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `R2MeetingDetailDrawer.tsx` | Adicionar estado `saveTrigger` (counter), botão "Salvar" no footer, passar trigger para as tabs |
| `R2QualificationTab.tsx` | Receber prop `saveTrigger`, useEffect que salva profissão e idade quando trigger muda |
| `R2EvaluationTab.tsx` | Receber prop `saveTrigger`, useEffect que salva meeting_link e observações quando trigger muda |

### Mecânica

1. Parent mantém `const [saveTrigger, setSaveTrigger] = useState(0)`
2. Botão "Salvar" faz `setSaveTrigger(prev => prev + 1)`
3. Cada tab recebe `saveTrigger` como prop
4. Dentro de cada tab, `useEffect` reage ao `saveTrigger` e chama os mutates para todos os campos de texto pendentes (sem depender de blur)
5. Toast de sucesso "Informações salvas" após o save

### Botão no footer
```tsx
<Button 
  className="w-full"
  onClick={() => setSaveTrigger(p => p + 1)}
>
  <Save className="h-4 w-4 mr-2" />
  Salvar Informações
</Button>
```

Posicionado acima dos botões de ação (Realizada, No-show, etc).

