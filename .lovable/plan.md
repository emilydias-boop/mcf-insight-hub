
# Fix: Closers e SDRs do Consorcio sem acesso ao Pos-Reuniao e Painel Equipe

## Problema

Dois bloqueios de acesso identificados:

### 1. Pos-Reuniao (aba no CRM)
No `BUCRMLayout.tsx`, as roles `sdr`, `closer` e `closer_sombra` sao tratadas como "agenda only" (linha 62-63), o que filtra as abas visíveis para apenas `agenda` e `negocios` (linhas 105-114). A aba `pos-reuniao` e removida mesmo estando configurada para o Consorcio.

### 2. Painel Equipe (rota separada)
No `App.tsx` (linha 207), a rota `/consorcio/painel-equipe` usa `RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}`, bloqueando closers e SDRs.

## Solucao

### Arquivo 1: `src/pages/crm/BUCRMLayout.tsx`
- Adicionar `pos-reuniao` a lista de abas permitidas para roles "agenda only" quando a BU tiver essa aba configurada
- Logica: se `buVisibleTabs` inclui `pos-reuniao`, adicionar ao `allowedTabs` para closers/SDRs

Trecho a modificar (linhas 105-114):
```
if (isAgendaOnly) {
    const allowedTabs: string[] = ['agenda'];
    
    if (canViewR2 && buVisibleTabs.includes('agenda-r2')) {
      allowedTabs.push('agenda-r2');
    }
    
    // Permitir pos-reuniao para closers/SDRs (necessário para ações pós-reunião)
    if (buVisibleTabs.includes('pos-reuniao')) {
      allowedTabs.push('pos-reuniao');
    }
    
    allowedTabs.push('negocios');
    
    navItems = navItems.filter(item => allowedTabs.includes(item.key));
}
```

### Arquivo 2: `src/App.tsx`
- Adicionar `sdr` e `closer` ao `allowedRoles` da rota `/consorcio/painel-equipe`
- De: `['admin', 'manager', 'coordenador']`
- Para: `['admin', 'manager', 'coordenador', 'sdr', 'closer']`

### Arquivo 3: `src/components/layout/AppSidebar.tsx`
- Verificar se o item "Painel Equipe" no menu lateral tambem precisa ter suas restricoes de role ajustadas para que closers/SDRs vejam o link na sidebar

## Resultado Esperado

- Closers do Consorcio verao a aba "Pos-Reuniao" no CRM e poderao registrar propostas/sem sucesso
- SDRs e Closers verao o "Painel Equipe" no menu lateral e poderao acompanhar metricas da equipe
