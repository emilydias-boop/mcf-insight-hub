

# Correção: Painel do Diretor Acessível

## Problema Identificado

O **Painel do Diretor** (página `Dashboard.tsx` com título "Painel do Diretor") ficou **inacessível** porque:
1. O link no sidebar "Dashboard > Visão Geral" aponta para `/`
2. A rota `/` agora redireciona para `/home` (página das 4 luas)
3. Não existe uma rota dedicada `/dashboard` para acessar o Painel do Diretor

## Solução

Criar uma rota `/dashboard` para o Painel do Diretor e atualizar o sidebar.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/dashboard` para o componente Dashboard |
| `src/components/layout/AppSidebar.tsx` | Mudar URL "Visão Geral" de `/` para `/dashboard` |

---

## Mudanças Técnicas

### 1. App.tsx - Nova Rota

Adicionar rota explícita para `/dashboard`:

```text
<Route path="dashboard" element={<ResourceGuard resource="dashboard"><Dashboard /></ResourceGuard>} />
```

### 2. AppSidebar.tsx - Corrigir URL

Mudar no menu "Dashboard":

**Antes:**
```text
{ title: "Visão Geral", url: "/" }
```

**Depois:**
```text
{ title: "Visão Geral", url: "/dashboard" }
```

---

## Resultado Final

| URL | Página |
|-----|--------|
| `/` | Redireciona para `/home` |
| `/home` | Home (4 luas - Ultrameta por BU) |
| `/dashboard` | Painel do Diretor (métricas consolidadas) |
| `/dashboard/semanas` | Dashboard por Semanas |
| `/chairman` | Visão Chairman (executivo) |

---

## Como Acessar o Painel do Diretor

1. **Sidebar** → Dashboard → Visão Geral
2. **URL direta**: `/dashboard`

