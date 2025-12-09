import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyPlaybook } from "@/hooks/usePlaybookReads";
import { PlaybookViewer } from "@/components/playbook/PlaybookViewer";
import { PlaybookDocWithRead, PLAYBOOK_CATEGORIA_LABELS, PLAYBOOK_STATUS_LABELS, PLAYBOOK_STATUS_COLORS, PLAYBOOK_TIPO_LABELS, PLAYBOOK_CATEGORIAS_LIST } from "@/types/playbook";
import { Loader2, FileText, Link, FileType, Eye, BookOpen } from "lucide-react";

export default function MeuPlaybook() {
  const { data: docs, isLoading } = useMyPlaybook();
  const [selectedDoc, setSelectedDoc] = useState<PlaybookDocWithRead | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredDocs = docs?.filter(doc => {
    if (categoryFilter === "all") return true;
    return doc.categoria === categoryFilter;
  }) || [];

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'arquivo':
        return <FileText className="h-4 w-4" />;
      case 'link':
        return <Link className="h-4 w-4" />;
      case 'texto':
        return <FileType className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Contagem por status
  const statusCounts = {
    total: docs?.length || 0,
    nao_lido: docs?.filter(d => d.read_status === 'nao_lido').length || 0,
    lido: docs?.filter(d => d.read_status === 'lido').length || 0,
    confirmado: docs?.filter(d => d.read_status === 'confirmado').length || 0,
    obrigatorios: docs?.filter(d => d.obrigatorio).length || 0,
    obrigatorios_confirmados: docs?.filter(d => d.obrigatorio && d.read_status === 'confirmado').length || 0,
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          Meu Playbook
        </h1>
        <p className="text-muted-foreground">
          Materiais oficiais do seu cargo.
        </p>
      </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{statusCounts.total}</div>
              <p className="text-xs text-muted-foreground">Total de documentos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-muted-foreground">{statusCounts.nao_lido}</div>
              <p className="text-xs text-muted-foreground">Não lidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{statusCounts.lido}</div>
              <p className="text-xs text-muted-foreground">Lidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {statusCounts.obrigatorios_confirmados}/{statusCounts.obrigatorios}
              </div>
              <p className="text-xs text-muted-foreground">Obrigatórios confirmados</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Documentos</CardTitle>
                <CardDescription>
                  Clique em "Abrir" para visualizar o conteúdo.
                </CardDescription>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {PLAYBOOK_CATEGORIAS_LIST.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {PLAYBOOK_CATEGORIA_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {docs?.length === 0 
                  ? "Nenhum documento disponível para o seu cargo."
                  : "Nenhum documento encontrado com este filtro."
                }
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Obrigatório</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.titulo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {PLAYBOOK_CATEGORIA_LABELS[doc.categoria]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTipoIcon(doc.tipo_conteudo)}
                          <span>{PLAYBOOK_TIPO_LABELS[doc.tipo_conteudo]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.obrigatorio ? (
                          <Badge variant="destructive">Sim</Badge>
                        ) : (
                          <Badge variant="secondary">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={PLAYBOOK_STATUS_COLORS[doc.read_status || 'nao_lido']}>
                          {PLAYBOOK_STATUS_LABELS[doc.read_status || 'nao_lido']}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDoc(doc)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      {/* Viewer dialog */}
      <PlaybookViewer
        open={!!selectedDoc}
        onOpenChange={(open) => !open && setSelectedDoc(null)}
        doc={selectedDoc}
        currentStatus={selectedDoc?.read_status}
      />
    </div>
  );
}
