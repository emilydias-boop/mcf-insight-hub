# Página "Triagem de candidatos" no RH

## O que muda para o usuário
- Novo item **Triagem de candidatos** no menu RH, logo após "Prova Equipe".
- A página abre o painel da triagem (https://rh-mcf.lovable.app/painel) ocupando toda a área de conteúdo, sem borda.
- Acima do quadro, um link **Abrir em nova aba** para o mesmo endereço, com uma linha curta explicando: no primeiro acesso, entre com o e-mail e a senha da triagem dentro do quadro (login separado, pois são sistemas com bases diferentes); se o Safari bloquear o login no quadro, use "Abrir em nova aba".
- Acesso só para admin e RH; outros perfis são barrados como em "Prova Equipe".

## Detalhes técnicos
- Novo arquivo `src/pages/rh/TriagemCandidatos.tsx`: barra superior fina (link `target="_blank" rel="noopener noreferrer"` + texto de ajuda) e `<iframe src=... className="w-full flex-1 border-0">` em contêiner flex de altura total, com `title="Triagem de candidatos"` e `allow="clipboard-write"`.
- `src/App.tsx`: `lazy` import e rota `rh/triagem` dentro de `<RoleGuard allowedRoles={['admin','rh']}>`, ao lado de `rh/prova-equipe`.
- `src/components/layout/AppSidebar.tsx`: item `{ title: "Triagem de candidatos", url: "/rh/triagem" }` no grupo RH.
- Sem mudanças no banco, nas funções ou em outros arquivos; sem publicar.
- Limitação: se o app da triagem bloquear exibição em quadro, o quadro ficará vazio e o link de nova aba resolve.
