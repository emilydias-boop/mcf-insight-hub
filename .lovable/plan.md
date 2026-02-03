

# Plano: Correção do Cadastro de SDRs no Consórcio

## Diagnóstico Resumido

### Problema 1: Cadastro de SDR precisa ser feito na página do Incorporador
O formulário de cadastro de SDRs ("Novo SDR") só existe em `/fechamento-sdr/configuracoes`, que é a página do Incorporador. A página de configurações do Consórcio (`/consorcio/fechamento/configuracoes`) mostra apenas a lista de equipe sem a opção de criar SDR.

### Problema 2: Vínculo de usuário parece não salvar
O vínculo de usuário na tela do RH **funciona corretamente** - a Ithaline tem o `profile_id` vinculado no banco:
- `profile_id`: `411e4b5d-8183-4d6a-b841-88c71d50955f`

O problema visual é que o componente `ProfileLinkSection` tem seu próprio botão "Vincular" que funciona separadamente do botão "Salvar" do formulário geral.

### Problema 3: Ithaline não aparece no fechamento
Ela está no RH (tabela `employees`) mas não na tabela `sdr`, por isso não aparece na aba de fechamento SDRs. O campo `sdr_id` na tabela employees está `null`.

---

## Solução

### Alteração 1: Adicionar Aba "SDRs" na Configuração do Consórcio

Atualizar `src/pages/bu-consorcio/FechamentoConfig.tsx` para incluir uma nova aba que permite:
- Listar SDRs do Consórcio (filtrados por `squad = 'consorcio'`)
- Criar novos SDRs já com `squad = 'consorcio'` pré-selecionado
- Editar SDRs existentes

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Configurações - Fechamento Consórcio                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐ ┌─────┐ ┌───────────┐ ┌───────────────┐ ┌──────────┐  │
│  │ Equipe HR│ │ SDRs│ │ Planos OTE│ │ Métricas Ativas│ │ Dias Úteis│  │
│  └──────────┘ └─────┘ └───────────┘ └───────────────┘ └──────────┘  │
│                                                                      │
│                     [SDRs do Consórcio aqui]                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Alteração 2: Criar Componente Reutilizável de SDRs

Extrair a lógica de SDRs do `Configuracoes.tsx` do Incorporador para um componente reutilizável que aceite a prop `squad`:

**Novo arquivo**: `src/components/fechamento/SdrConfigTab.tsx`

Props:
- `defaultSquad`: string (ex: 'consorcio')
- `lockSquad`: boolean (quando true, oculta o select de squad)

### Alteração 3: Cadastrar Ithaline como SDR (dados)

Após implementar as melhorias, o usuário poderá:
1. Acessar `/consorcio/fechamento/configuracoes`
2. Ir na aba "SDRs"
3. Clicar em "Novo SDR"
4. Vincular a Ithaline que já existe como employee com profile

Ou posso incluir uma migração para criar o registro automaticamente.

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/fechamento/SdrConfigTab.tsx` | Criar | Componente reutilizável para gerenciar SDRs com filtro de squad |
| `src/pages/bu-consorcio/FechamentoConfig.tsx` | Modificar | Adicionar aba "SDRs" usando o novo componente |
| `src/pages/fechamento-sdr/Configuracoes.tsx` | Modificar | Usar o componente reutilizável em vez do código inline |

---

## Detalhes Técnicos

### Componente SdrConfigTab

```typescript
interface SdrConfigTabProps {
  defaultSquad?: string;   // Ex: 'consorcio'
  lockSquad?: boolean;     // Oculta select de squad
}

export function SdrConfigTab({ defaultSquad = 'incorporador', lockSquad = false }: SdrConfigTabProps) {
  // Query filtrada por squad
  const { data: sdrs } = useSdrsAll();
  
  const filteredSdrs = useMemo(() => {
    if (!sdrs) return [];
    return sdrs.filter(s => s.squad === defaultSquad);
  }, [sdrs, defaultSquad]);

  // Form dialog com squad pré-preenchido
  // ...
}
```

### Formulário com Vínculo Automático

Ao criar um SDR com `user_id` vinculado:
1. O hook `useCreateSdr` já busca o employee com esse `user_id`
2. E já atualiza o `sdr_id` no employee

Isso já está implementado! Só precisa garantir que o usuário seja selecionado.

---

## Fluxo para Cadastrar Ithaline

Após a implementação:

1. Acessar `/consorcio/fechamento/configuracoes`
2. Ir na aba **SDRs**
3. Clicar em **"Novo SDR"**
4. Preencher:
   - Nome: Ithaline Clara dos Santos
   - Email: ithaline.clara@minhacasafinanciada.com
   - Usuário vinculado: selecionar email dela
   - Squad: já estará pré-selecionado como "Consórcio"
5. Salvar

O sistema vai:
- Criar registro na tabela `sdr` com `squad = 'consorcio'`
- Vincular automaticamente o `sdr_id` no employee da Ithaline

---

## Resultado Esperado

Após as alterações:

1. **Página de Configurações do Consórcio** terá 5 abas: Equipe HR, SDRs, Planos OTE, Métricas Ativas, Dias Úteis
2. **Aba SDRs** mostrará apenas SDRs do Consórcio
3. **Formulário "Novo SDR"** terá o squad pré-selecionado e bloqueado
4. **Ithaline** aparecerá no fechamento após ser cadastrada
5. **Cleiton** continuará aparecendo normalmente

