

## Problema

A lista de etapas no modal de configuração não permite scroll até o final. O usuário só consegue ver as etapas cortadas.

### Causa raiz

O `PipelineStagesEditor` tem `h-full` no seu wrapper root (linha 266), o que faz o componente **tentar se encaixar na altura do pai** em vez de crescer naturalmente com o conteúdo. O container pai (`div.flex-1.overflow-y-auto.p-6`) precisa que o conteúdo filho **ultrapasse** a altura disponível para ativar o scroll — mas `h-full` impede isso.

Além disso, o `DialogContent` base do shadcn usa `grid` + `gap-4` o que pode consumir espaço vertical inesperadamente.

## Correção

### 1. `PipelineStagesEditor.tsx` — Remover `h-full` do wrapper

```diff
- <div className="flex flex-col min-h-0 h-full space-y-4">
+ <div className="space-y-4">
```

O componente não precisa de constraints de flex/altura — ele deve simplesmente renderizar seu conteúdo com altura natural. O scroll é responsabilidade do pai (`overflow-y-auto` no painel direito do modal).

### 2. `PipelineConfigModal.tsx` — Garantir que o `DialogContent` não bloqueia overflow

Na linha 316, remover `grid` implícito do `DialogContent` adicionando `flex flex-col` explicitamente e ajustando o gap:

```diff
- <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden">
+ <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden flex flex-col">
```

E o inner wrapper (linha 318) já tem `flex flex-col h-full` — garantir que ele tenha `min-h-0`:

```diff
- <div className="flex flex-col h-full">
+ <div className="flex flex-col h-full min-h-0 flex-1">
```

### Arquivos modificados
- `src/components/crm/PipelineStagesEditor.tsx` — linha 266: remover `h-full`, `flex flex-col`, `min-h-0`
- `src/components/crm/PipelineConfigModal.tsx` — linhas 316-318: adicionar `flex flex-col` no DialogContent e `min-h-0 flex-1` no wrapper

