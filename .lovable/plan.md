
# Tornar Logo MCF Clicável para Navegar à Home

## Resumo

Fazer com que o logo "MCF" na sidebar navegue para a página inicial `/home` ao ser clicado.

## Alteração

**Arquivo**: `src/components/layout/AppSidebar.tsx`

Na linha 462, o texto "MCF" é apenas um `<span>` estático:

```text
<span className="text-xl font-bold text-primary">MCF</span>
```

Será transformado em um elemento clicável que navega para `/home`:

```text
<button 
  onClick={() => navigate('/home')} 
  className="text-xl font-bold text-primary hover:opacity-80 transition-opacity cursor-pointer"
>
  MCF
</button>
```

## Comportamento

- **Clique no "MCF"** → Navega para `/home` (página das 4 luas)
- Efeito hover para indicar que é clicável
- Funciona tanto com sidebar expandida quanto colapsada
