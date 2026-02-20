

# Correcoes: QR Code, Termo visivel, e Termo em "Meus Arquivos"

Tres problemas identificados e suas solucoes:

---

## Problema 1: QR Code Download nao funciona

O download do QR Code usa conversao SVG-para-Canvas via Blob URL. Em muitos navegadores (especialmente Chromium), carregar um SVG de um Blob URL em uma `Image` falha silenciosamente por restricoes de seguranca (tainted canvas).

### Solucao

Substituir a abordagem por conversao via `data:` URL (base64) em vez de Blob URL. Isso evita problemas de CORS/tainted canvas.

### Arquivo: `src/components/patrimonio/AssetQRCode.tsx`

- Alterar `handleDownload` para converter o SVG em base64 data URL em vez de Blob URL
- Usar `btoa(encodeURIComponent(...))` ou `btoa(unescape(encodeURIComponent(...)))` para lidar com caracteres especiais
- Manter a mesma logica de canvas para desenhar o numero do patrimonio abaixo do QR

---

## Problema 2: Termo nao aparece na pagina "Meus Equipamentos"

O termo da Emily ja foi aceito (`aceito: true`). A pagina so mostra o botao "Aceitar Termo" quando o termo nao foi aceito. Depois de aceito, nao ha nenhuma indicacao visual nem forma de visualizar o conteudo do termo.

### Solucao

No card do equipamento em `MyEquipmentPage.tsx`:

- Quando existe um termo **aceito** para o equipamento, mostrar um badge "Termo Aceito" com botao "Ver Termo"
- Ao clicar em "Ver Termo", abrir um dialog mostrando o conteudo do termo com as informacoes de aceite (data, IP, versao)
- Manter o botao "Aceitar Termo" apenas para termos pendentes (comportamento atual)

### Arquivo: `src/pages/patrimonio/MyEquipmentPage.tsx`

- Buscar termos aceitos alem dos pendentes: `const acceptedTerm = myTerms?.find(t => t.asset_id === asset.id && t.aceito)`
- Adicionar badge + botao "Ver Termo" no card quando `acceptedTerm` existe
- Adicionar novo dialog para visualizacao do termo aceito (read-only)

---

## Problema 3: Termo deve aparecer em "Meus Arquivos"

O usuario espera que o Termo de Responsabilidade de equipamento apareca na secao "Meus Arquivos" junto com outros documentos (como Contrato de Trabalho). Atualmente, o aceite do termo nao cria nenhum registro na tabela `user_files`.

### Solucao

Alterar a mutacao `acceptTerm` em `useAssetTerms.ts` para, apos aceitar o termo com sucesso, inserir um registro na tabela `user_files` com:

- `user_id`: o `profile_id` do colaborador (auth user ID)
- `tipo`: `outro` (enum disponivel: contrato_trabalho, politica_comissao, metas, outro)
- `titulo`: "Termo de Responsabilidade - {numero_patrimonio}"
- `descricao`: "Termo de responsabilidade aceito em {data}"
- `visivel_para_usuario`: true
- `storage_url` e `storage_path`: criar um arquivo texto/markdown no bucket de storage com o conteudo do termo

### Migracao de banco (opcional mas recomendada)

Adicionar um novo valor ao enum `user_file_type`:

```text
ALTER TYPE user_file_type ADD VALUE 'termo_responsabilidade';
```

Isso permite filtrar e categorizar os termos corretamente nos arquivos do usuario.

### Arquivos afetados:

| Arquivo | Acao |
|---------|------|
| `src/components/patrimonio/AssetQRCode.tsx` | Corrigir download (base64 em vez de Blob URL) |
| `src/pages/patrimonio/MyEquipmentPage.tsx` | Adicionar visualizacao de termos aceitos |
| `src/hooks/useAssetTerms.ts` | Ao aceitar termo, salvar conteudo no storage e criar registro em `user_files` |
| Migracao SQL | Adicionar `termo_responsabilidade` ao enum `user_file_type` |

---

## Detalhes Tecnicos

### QR Code - Nova logica de download

```text
const svgData = new XMLSerializer().serializeToString(svg);
const base64 = btoa(unescape(encodeURIComponent(svgData)));
const dataUrl = `data:image/svg+xml;base64,${base64}`;
img.src = dataUrl;  // Sem Blob URL = sem problemas de seguranca
```

### Aceite do Termo - Fluxo expandido

```text
1. Aceitar termo (update asset_terms) -- ja existe
2. Buscar profile_id do employee
3. Salvar conteudo como .md no bucket 'user-files'
4. Criar signed URL
5. Inserir registro em user_files com tipo 'termo_responsabilidade'
6. Invalidar queries ['my-files'] e ['user-files']
```

### Visualizacao do Termo - Novo dialog em MyEquipmentPage

```text
- Badge verde "Aceito" no card do equipamento
- Botao "Ver Termo" abre dialog read-only
- Mostra conteudo do termo + metadados (data aceite, versao, IP)
```

