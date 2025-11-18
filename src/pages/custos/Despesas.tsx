import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_CUSTOS } from "@/data/mockData";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Download, Plus, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function CustosDespesas() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDespesas = MOCK_CUSTOS.filter(d => 
    d.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Despesas</h2>
          <p className="text-muted-foreground mt-1">Lista detalhada de todos os custos</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => toast({ title: "Exportando...", description: "Gerando arquivo Excel" })}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => toast({ title: "Em breve", description: "Funcionalidade em desenvolvimento" })}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
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
            <Select defaultValue="todas">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="pessoal">Pessoal</SelectItem>
                <SelectItem value="operacional">Operacional</SelectItem>
                <SelectItem value="administrativo">Administrativo</SelectItem>
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
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Categoria</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {filteredDespesas.map((despesa) => (
                  <tr key={despesa.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm text-foreground">{formatDate(despesa.data)}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{despesa.descricao}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{despesa.categoria}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-destructive">
                      {formatCurrency(despesa.valor)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={despesa.tipo === 'fixo' ? 'secondary' : 'default'}>
                        {despesa.tipo}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Mostrando {filteredDespesas.length} de {MOCK_CUSTOS.length} despesas</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
