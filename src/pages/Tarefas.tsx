import { CheckSquare } from "lucide-react";

const Tarefas = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckSquare className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">
            Gerencie suas tarefas e atividades
          </p>
        </div>
      </div>
      
      {/* Conteúdo futuro será adicionado aqui */}
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Em construção - Adicione funcionalidades aqui
      </div>
    </div>
  );
};

export default Tarefas;
