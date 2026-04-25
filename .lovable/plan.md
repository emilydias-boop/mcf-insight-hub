## Objetivo

Os botões flutuantes do **Discador Rápido** (📞 verde) e **Auto-Discador** (⚡ cinza) hoje aparecem no canto inferior esquerdo da tela, sobrepondo conteúdo e ficando visíveis para todos os usuários — inclusive quem nunca usa (admins, financeiro, RH, marketing etc.).

A solução: **mover esses dois acessos para dentro do `AppSidebar**`, em uma seção própria no rodapé do menu lateral, **visível apenas para `sdr` e `closer**` (e `admin` por padrão de gestão, se confirmado).

---

## Alterações propostas

### 1. `src/components/layout/AppSidebar.tsx`

- Adicionar uma nova seção no `SidebarFooter` (ou logo acima dele), chamada **"Discador"**, contendo dois `SidebarMenuButton`:
  - **Discador rápido** — ícone `Phone` (verde, igual ao botão atual). Atalho `Ctrl+Shift+D` exibido como hint quando expandido.
  - **Auto-Discador** — ícone `Zap`. Mostra um `Badge` com `stats.called/stats.total` quando há fila ativa (mesma lógica do botão atual).
- Filtragem por role: usar `hasAnyRole('sdr', 'closer', 'admin')` do `useAuth()`. Se o usuário não tiver nenhum desses cargos, a seção inteira não é renderizada.
- Quando o sidebar está colapsado (modo ícone), apenas os ícones aparecem — comportamento nativo do shadcn sidebar.
- Os botões disparam o mesmo `setOpen(true)` / `setAutoOpen(true)` que hoje vivem no `QuickDialerLauncher`.

### 2. `src/components/crm/QuickDialerLauncher.tsx`

- **Remover os dois botões flutuantes** (o `<div className="fixed bottom-4 left-4 ...">` com os dois `Tooltip`).
- **Manter** todo o resto: estado `open`/`autoOpen`, atalhos de teclado `Ctrl+Shift+D` e `Ctrl+Shift+A`, efeito que fecha o painel quando entra em chamada, e os componentes `<QuickDialer>` e `<AutoDialerPanel>` montados.
- Os atalhos de teclado continuam globais e funcionam para qualquer usuário com permissão (sem alteração).

### 3. Comunicação entre Sidebar e Launcher

Como o `QuickDialerLauncher` mantém o estado dos modais e o `AppSidebar` precisa abrir esses modais, vou criar um pequeno contexto `**DialerLauncherContext**` (`src/contexts/DialerLauncherContext.tsx`) com:

- `quickOpen`, `setQuickOpen`
- `autoOpen`, `setAutoOpen`

O Provider envolve `MainLayout`. O `AppSidebar` consome para abrir; o `QuickDialerLauncher` consome para renderizar os modais e tratar atalhos. Isso evita acoplamento via eventos globais e mantém a lógica de "fechar painel ao atender" intacta.

### 4. Visibilidade (regra final)

- **SDR** ✅ vê os dois botões no sidebar
- **Closer** ✅ vê os dois botões no sidebar
- **Admin** ✅ vê (para suporte/teste) — não precisa ver
- **Manager / Coordenador / Financeiro / RH / Marketing / demais** ❌ não vê nada relacionado a discador

---

## Resultado visual

**Antes:** dois círculos flutuantes sobrepostos ao canto inferior esquerdo, visíveis para todos.

**Depois:** dois itens no sidebar, agrupados em "Discador", junto aos demais itens do menu — discretos quando colapsado (só ícones), descritivos quando expandido. Aparecem apenas para quem opera o telefone.

---

## Arquivos editados/criados

- ✏️ `src/components/layout/AppSidebar.tsx` — adicionar seção "Discador" filtrada por role
- ✏️ `src/components/crm/QuickDialerLauncher.tsx` — remover botões flutuantes, manter atalhos e modais
- ➕ `src/contexts/DialerLauncherContext.tsx` — contexto leve para conectar sidebar ↔ modais
- ✏️ `src/components/layout/MainLayout.tsx` — envolver com `DialerLauncherProvider`