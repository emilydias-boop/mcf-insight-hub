

## Fase 4: Politicas MCF + Comunicados

### 1. Politicas MCF — Biblioteca de documentos internos

**Nova tabela: `rh_policies`**

```sql
CREATE TABLE rh_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'politica'
    CHECK (categoria IN ('politica', 'codigo_conduta', 'manual', 'procedimento', 'outro')),
  arquivo_url TEXT,
  storage_path TEXT,
  versao TEXT DEFAULT '1.0',
  obrigatoria BOOLEAN NOT NULL DEFAULT false,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

RLS: qualquer colaborador autenticado pode ler politicas ativas. Somente admin/RH insere/atualiza (via service role ou RLS com has_role).

**Arquivos novos:**
- `src/hooks/useRhPolicies.ts` — hook `useActivePolicies()` que lista politicas ativas ordenadas por categoria
- `src/components/meu-rh/MeuRHPoliticasSection.tsx` — lista de cards agrupados por categoria com icone, titulo, descricao e botao de download/visualizacao do PDF

**Layout:**
```text
┌──────────────────────────────────────────────────┐
│ Politicas e Diretrizes MCF                       │
├──────────────────────────────────────────────────┤
│ Politicas (2)                                    │
│ ┌──────────────────────────────────────────────┐ │
│ │ 📄 Politica de Home Office · v1.0            │ │
│ │ Regras para trabalho remoto     [Baixar PDF] │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ 📄 Politica de Ferias · v2.0                 │ │
│ │ Procedimento para solicitar ferias [Baixar]  │ │
│ └──────────────────────────────────────────────┘ │
│ Codigo de Conduta (1)                            │
│ ┌──────────────────────────────────────────────┐ │
│ │ 📋 Codigo de Etica MCF · v1.0               │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

### 2. Comunicados — Avisos, aniversariantes e recados

**Nova tabela: `rh_announcements`**

```sql
CREATE TABLE rh_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'aviso'
    CHECK (tipo IN ('aviso', 'aniversariante', 'recado_gestao', 'evento')),
  destaque BOOLEAN NOT NULL DEFAULT false,
  data_publicacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_expiracao DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

RLS: colaboradores autenticados leem comunicados ativos. Admin/RH insere.

**Arquivos novos:**
- `src/hooks/useRhAnnouncements.ts` — hook `useActiveAnnouncements()` que lista comunicados ativos (nao expirados) ordenados por destaque + data
- `src/components/meu-rh/MeuRHComunicadosSection.tsx` — cards com badge de tipo, destaque visual para itens marcados, icones por tipo (megafone, bolo para aniversario, etc)

**Layout:**
```text
┌──────────────────────────────────────────────────┐
│ Comunicados                                      │
├──────────────────────────────────────────────────┤
│ ⭐ DESTAQUE                                      │
│ ┌──────────────────────────────────────────────┐ │
│ │ 📢 Recado da Gestao                          │ │
│ │ "Parabens pelo resultado de marco..."        │ │
│ │ Publicado em 25/03/2026                      │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ 🎂 Aniversariantes do Mes                        │
│ ┌──────────────────────────────────────────────┐ │
│ │ Joao Silva - 15/03 · Maria Santos - 22/03   │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Avisos                                           │
│ ┌──────────────────────────────────────────────┐ │
│ │ 📌 Horario especial na sexta-feira santa     │ │
│ │ Publicado em 20/03/2026                      │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

### 3. Arquivos editados

**`src/pages/MeuRH.tsx`**: Substituir os dois `PlaceholderTab` restantes (politicas e comunicados) pelos componentes reais.

**`src/types/hr.ts`**: Adicionar interfaces `RhPolicy` e `RhAnnouncement` + constantes de labels/cores.

### 4. O que NAO muda
- Todas as abas existentes (Perfil, Documentos, Fale com RH, Avaliacoes, PDI, Historico)
- Quick Cards e Quick Actions
- Header e layout geral

