import { useState } from "react";
import { CheckSquare } from "lucide-react";
import { TaskSpacesSidebar } from "@/components/tasks/TaskSpacesSidebar";
import { useTaskSpaces } from "@/hooks/useTaskSpaces";

const Tarefas = () => {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const { data: spaces } = useTaskSpaces();

  const selectedSpace = spaces?.find((s) => s.id === selectedSpaceId);

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      {/* Sidebar */}
      <TaskSpacesSidebar
        selectedSpaceId={selectedSpaceId}
        onSelectSpace={setSelectedSpaceId}
      />

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">
                {selectedSpace?.name || "Todas as Tarefas"}
              </h1>
              <p className="text-muted-foreground">
                {selectedSpace
                  ? `Visualizando ${selectedSpace.type}`
                  : "Gerencie suas tarefas e atividades"}
              </p>
            </div>
          </div>

          {/* Content Area */}
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            {selectedSpace ? (
              <>
                <p className="font-medium">{selectedSpace.name}</p>
                <p className="text-sm mt-1">
                  Tipo: {selectedSpace.type} • 
                  {selectedSpace.is_private ? " Privado" : " Público"}
                </p>
                <p className="text-sm mt-4">
                  As tarefas deste espaço serão exibidas aqui
                </p>
              </>
            ) : (
              <>
                <p>Selecione um espaço na sidebar para ver as tarefas</p>
                <p className="text-sm mt-1">
                  Ou crie um novo setor clicando no botão +
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tarefas;
