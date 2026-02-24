
# Fix: SDR/Closer de Incorporador vendo BU Consorcio na sidebar

## Problema

A logica de filtragem do menu lateral esta incorreta. O item "BU - Consorcio" tem:
- `requiredRoles: ["admin", "manager", "coordenador", "sdr", "closer"]`
- `requiredProducts: ["consorcio"]`

A verificacao de `requiredProducts` so acontece quando a role do usuario **NAO** esta na lista de `requiredRoles`. Como Carol e SDR e "sdr" esta na lista, o filtro de roles passa e o `requiredProducts` nunca e verificado. Resultado: qualquer SDR/Closer ve a BU Consorcio, mesmo sem ter o produto.

## Solucao

Modificar a logica de filtragem no `AppSidebar.tsx` para que `requiredProducts` seja verificado **sempre**, independente de a role ter passado.

### Arquivo: `src/components/layout/AppSidebar.tsx`

Alterar a logica de filtragem (linhas 446-474) para:

```text
1. Verificar requiredRoles normalmente
2. Se passou no teste de roles, TAMBEM verificar requiredProducts (se existir)
3. Se requiredProducts existe e o usuario nao tem nenhum dos produtos, ocultar o item
```

Logica corrigida:

```typescript
const filteredMenuItems = allMenuItems.filter((item) => {
    // Verificacao de roles
    if (item.requiredRoles && role && 
        !item.requiredRoles.some(r => (allRoles as string[]).includes(r))) {
      // Fallback: SDR/Closer pode ver se tem o produto
      if (item.requiredProducts && ["sdr", "closer"].includes(role)) {
        return item.requiredProducts.some((p) => myProducts.includes(p));
      }
      return false;
    }

    // Verificacao de produtos (NOVO - aplica sempre, nao so como fallback)
    if (item.requiredProducts && item.requiredProducts.length > 0) {
      if (!myProducts || !item.requiredProducts.some(p => myProducts.includes(p))) {
        // Admin/Manager ignoram filtro de produto
        if (!isAdmin && role !== 'manager' && role !== 'coordenador') {
          return false;
        }
      }
    }

    // Verificacao de BU
    if (item.requiredBU && item.requiredBU.length > 0) {
      if (!myBUs || myBUs.length === 0) return false;
      if (!myBUs.some(bu => item.requiredBU!.includes(bu))) return false;
    }

    if (isAdmin) return true;
    if (item.resource && !canAccessResource(item.resource)) return false;
    return true;
});
```

### Impacto

- SDRs/Closers que NAO tem o produto "consorcio" (como Carol, que e de Incorporador) deixarao de ver "BU - Consorcio"
- SDRs/Closers que TEM o produto "consorcio" continuarao vendo normalmente
- Admin, Manager e Coordenador continuam vendo todas as BUs
