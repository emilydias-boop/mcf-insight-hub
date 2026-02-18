
# Lista Configuravel de Vendedores do Consorcio

## Problema

O dropdown "Vendedor Responsavel" no formulario de carta do consorcio busca apenas perfis com `squad = 'consorcio'`. Diretores como Grimaldo Neto, Diego Carielo e Vinicius Motta nao aparecem porque nao tem esse squad configurado. O usuario precisa poder adicionar e remover vendedores livremente.

## Solucao

Criar uma tabela configuravel `consorcio_vendedor_options` (seguindo o mesmo padrao das tabelas `consorcio_tipo_produto_options`, `consorcio_categoria_options`, `consorcio_origem_options`) e adicionar uma aba "Vendedores" no modal de configuracoes do consorcio.

## Passos

### 1. Criar tabela `consorcio_vendedor_options`

Nova migration SQL:

```text
CREATE TABLE consorcio_vendedor_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,          -- nome do vendedor (ex: "Grimaldo Neto")
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE consorcio_vendedor_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vendedor options"
  ON consorcio_vendedor_options FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/manager can manage vendedor options"
  ON consorcio_vendedor_options FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );
```

Inserir os vendedores atuais (os que ja aparecem no dropdown + os novos solicitados):

```text
INSERT INTO consorcio_vendedor_options (name, display_order) VALUES
  ('Cleiton Anacleto Lima', 1),
  ('Fabio Damiao Sant Ana Campos', 2),
  ('Ithaline Clara dos Santos', 3),
  ('Joao Pedro Martins Vieira', 4),
  ('Luis Felipe de Souza Oliveira Ramos', 5),
  ('Thobson', 6),
  ('Victoria Paz', 7),
  ('Ygor Fereira', 8),
  ('Grimaldo Neto', 9),
  ('Diego Carielo', 10),
  ('Vinicius Motta Campos', 11);
```

### 2. Adicionar hooks CRUD em `useConsorcioConfigOptions.ts`

Seguindo o mesmo padrao dos hooks de Tipo/Categoria/Origem:
- `useConsorcioVendedorOptions()` - listar ativos
- `useCreateConsorcioVendedorOption()` - criar
- `useUpdateConsorcioVendedorOption()` - atualizar nome
- `useDeleteConsorcioVendedorOption()` - soft delete (is_active = false)

### 3. Adicionar aba "Vendedores" no `ConsorcioConfigModal.tsx`

- Mudar o grid de 3 para 4 colunas no TabsList
- Adicionar tab "Vendedores" com a mesma interface das outras abas
- Cada item mostra o nome editavel + botao de deletar
- Formulario de adicionar novo vendedor (campo de nome + botao +)

### 4. Atualizar `ConsorcioCardForm.tsx`

Substituir a query que busca `profiles` com `squad = consorcio` pela nova query que busca `consorcio_vendedor_options` ativos:

```text
// ANTES: profiles com squad consorcio
const { data: consorcioProfiles } = useQuery({
  queryKey: ['consorcio-profiles'],
  queryFn: async () => {
    const { data } = await supabase.from('profiles')
      .select('id, full_name').contains('squad', ['consorcio']);
    return data;
  }
});

// DEPOIS: tabela configuravel
const { data: vendedorOptions } = useConsorcioVendedorOptions();
```

O Select passara a usar `vendedorOptions` em vez de `consorcioProfiles`, salvando o nome do vendedor diretamente no campo `vendedor_name` (e o `vendedor_id` pode receber o id da option ou ficar null se nao for necessario vincular a um profile).

## Resultado

- Uma aba "Vendedores" no modal de configuracoes do consorcio permite adicionar/remover nomes livremente
- Diretores e qualquer outra pessoa podem ser adicionados sem depender de configuracoes de squad/perfil
- Mesmo padrao visual e tecnico das outras configuracoes (Tipos, Categorias, Origens)
