import { useState } from "react";
import { PlaybookDoc, PlaybookRole, PLAYBOOK_ROLE_LABELS, PLAYBOOK_ROLES_LIST } from "@/types/playbook";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlaybookDocsByRole } from "@/hooks/usePlaybookDocs";
import { PlaybookDocTable } from "./PlaybookDocTable";
import { PlaybookDocForm } from "./PlaybookDocForm";
import { PlaybookReadStats } from "./PlaybookReadStats";
import { Plus, Loader2 } from "lucide-react";

export function PlaybookConfigSection() {
  const [selectedRole, setSelectedRole] = useState<PlaybookRole>('sdr');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PlaybookDoc | null>(null);
  const [statsDoc, setStatsDoc] = useState<PlaybookDoc | null>(null);

  const { data: docs, isLoading } = usePlaybookDocsByRole(selectedRole);

  const handleEdit = (doc: PlaybookDoc) => {
    setEditingDoc(doc);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingDoc(null);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingDoc(null);
    }
  };

  // Filtrar apenas as roles mais usadas para exibição
  const displayRoles: PlaybookRole[] = ['sdr', 'closer', 'coordenador', 'admin', 'manager'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playbook por Cargo</CardTitle>
        <CardDescription>
          Gerencie os documentos e materiais oficiais por cargo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tabs de cargo */}
        <div className="flex items-center justify-between">
          <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as PlaybookRole)}>
            <TabsList>
              {displayRoles.map((role) => (
                <TabsTrigger key={role} value={role}>
                  {PLAYBOOK_ROLE_LABELS[role]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo documento
          </Button>
        </div>

        {/* Título do cargo selecionado */}
        <div>
          <h3 className="text-lg font-semibold">
            Playbook do cargo {PLAYBOOK_ROLE_LABELS[selectedRole]}
          </h3>
          <p className="text-sm text-muted-foreground">
            {docs?.length || 0} documento(s) cadastrado(s)
          </p>
        </div>

        {/* Tabela de documentos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <PlaybookDocTable
            docs={docs || []}
            onEdit={handleEdit}
            onViewStats={setStatsDoc}
          />
        )}

        {/* Dialog de formulário */}
        <PlaybookDocForm
          open={formOpen}
          onOpenChange={handleFormClose}
          doc={editingDoc}
          defaultRole={selectedRole}
        />

        {/* Dialog de estatísticas */}
        <PlaybookReadStats
          open={!!statsDoc}
          onOpenChange={(open) => !open && setStatsDoc(null)}
          doc={statsDoc}
        />
      </CardContent>
    </Card>
  );
}
