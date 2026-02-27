

## Plano: Remover aba "Origens" do Painel de Controle do Funil

### Alteração em `src/pages/crm/Overview.tsx`
1. Remover import de `Origens` (linha 6) e `MapPin` (linha 3)
2. Remover o `TabsTrigger` de "origens" (linhas 28-31)
3. Remover o `TabsContent` de "origens" (linhas 46-48)

Grupos e Tags permanecem intactos.

