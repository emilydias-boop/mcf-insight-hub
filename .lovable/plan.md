

# Trocar "Selecionado" para Termo Mais Claro

## Problema
O badge verde "Selecionado" no drawer de detalhes da R2 está causando confusão, pois o termo também é usado no contexto do "Carrinho" (leads selecionados/aprovados). O usuário pode achar que significa status do lead no funil, quando na verdade indica apenas qual participante está sendo visualizado no drawer.

---

## Sugestões de Nome Alternativo

| Opção | Significado |
|-------|-------------|
| **Em foco** | Indica que é o item atualmente exibido |
| **Visualizando** | Indica que o usuário está vendo os detalhes deste |
| **Ativo** | O participante ativo na seleção |
| **Atual** | O atual sendo exibido |

**Recomendação:** Usar **"Em foco"** ou **"Visualizando"** — termos que deixam claro que é uma indicação de UI, não de status de negócio.

---

## Mudança Técnica

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Linha 203 - Trocar "Selecionado" para o novo termo |

```tsx
// Linha 202-204 - Antes
{isSelected && (
  <Badge className="text-xs bg-primary text-primary-foreground shrink-0">
    Selecionado
  </Badge>
)}

// Depois (exemplo com "Em foco")
{isSelected && (
  <Badge className="text-xs bg-primary text-primary-foreground shrink-0">
    Em foco
  </Badge>
)}
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Badge "Selecionado" verde | Badge "Em foco" verde |

O termo novo deixará claro que se trata de uma indicação de interface (qual lead está sendo visualizado), sem confundir com status de negócio do carrinho.

