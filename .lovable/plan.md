
# Plano: Corrigir Stages Customizadas não Aparecendo no Kanban

## Diagnóstico Confirmado

### O Problema
As stages criadas para "Efeito Alavanca + Clube" não aparecem porque o sistema de permissões as bloqueia por padrão.

| Stage | ID | Normalizado | Tem Permissão? | Aparece? |
|-------|-----|-------------|----------------|----------|
| R1 Agendada | bedef4ec-... | r1_agendada → reuniao_1_agendada | Sim | Sim |
| NO-SHOW | bb69af6a-... | no_show | Sim | Sim |
| R1 Realizada | f7c48a43-... | r1_realizada | Sim | Sim |
| NOVO LEAD ( FORM ) | b5af7d28-... | novo_lead_(_form_) | Nao | Nao |
| CLUBE DO ARREMATE | bf370a4f-... | clube_do_arremate | Nao | Nao |
| RENOVACAO HUBLA | 3e545cd2-... | renovacao_hubla | Nao | Nao |
| ... (outras 6) | ... | ... | Nao | Nao |

### Causa Raiz
No `useStagePermissions.ts`, linha 177:
```typescript
const canViewStage = (stageId: string) => {
  return findPermission(stageId)?.can_view ?? false;  // Retorna FALSE quando nao encontra
};
```

O padrão `false` bloqueia qualquer stage que nao tenha permissao explicita.

---

## Solucao

### Mudanca de Comportamento
Inverter o padrao: **stages sem permissao explicita devem ser visiveis por padrao**.

A logica de restricao existe para:
1. Esconder stages especificas de roles especificas (ex: SDRs nao veem "Contrato Pago")
2. Nao para bloquear todo o sistema

### Implementacao

**Arquivo:** `src/hooks/useStagePermissions.ts`

Alterar as 4 funcoes de verificacao de permissao para retornar `true` por padrao:

```typescript
const canViewStage = (stageId: string) => {
  const permission = findPermission(stageId);
  // Se nao existe permissao explicita, permitir por padrao
  if (!permission) return true;
  return permission.can_view;
};

const canEditStage = (stageId: string) => {
  const permission = findPermission(stageId);
  if (!permission) return true;
  return permission.can_edit;
};

const canMoveFromStage = (stageId: string) => {
  const permission = findPermission(stageId);
  if (!permission) return true;
  return permission.can_move_from;
};

const canMoveToStage = (stageId: string) => {
  const permission = findPermission(stageId);
  if (!permission) return true;
  return permission.can_move_to;
};
```

---

## Alternativa Considerada (Nao Recomendada)

Criar permissoes automaticamente quando novas stages sao criadas:
- Mais complexo
- Requer migrar todas as stages existentes
- Aumenta dados no banco

A solucao de "permitir por padrao" e mais simples e segura.

---

## Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| "Efeito Alavanca + Clube" | 3 stages (R1, NO-SHOW, R1 Realizada) | 13 stages (todas) |
| Stages customizadas sem permissao | Bloqueadas | Visiveis por padrao |
| Restricoes explicitas (ex: SDR nao ve "Contrato Pago") | Funcionam | Continuam funcionando |

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useStagePermissions.ts` | Alterar padrao de `false` para `true` nas 4 funcoes de permissao |
