import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_RECEITAS } from "@/data/mockData";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Download, Plus, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ReceitaTransacoes() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransacoes = MOCK_RECEITAS.filter(t => 
    t.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Transações de Receita</h2>
          <p className="text-muted-foreground mt-1">Lista detalhada de todas as receitas</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => toast({ title: "Exportando...", description: "Gerando arquivo Excel" })}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => toast({ title: "Em breve", description: "Funcionalidade em desenvolvimento" })}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Receita
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por descrição..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <DatePickerCustom mode="range" placeholder="Período" />
            <Select defaultValue="todos">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="a010">A010</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="contratos">Contratos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Canal</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransacoes.map((transacao) => (
                  <tr key={transacao.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm text-foreground">{formatDate(transacao.data)}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{transacao.descricao}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{transacao.canal}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-success">
                      {formatCurrency(transacao.valor)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={transacao.status === 'pago' ? 'default' : 'secondary'}>
                        {transacao.status === 'pago' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Mostrando {filteredTransacoes.length} de {MOCK_RECEITAS.length} transações</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
