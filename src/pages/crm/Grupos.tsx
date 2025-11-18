import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClintGroups } from '@/hooks/useClintAPI';
import { Search, Plus, Layers, Users } from 'lucide-react';

const Grupos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: groups, isLoading } = useClintGroups();

  const groupsData = groups?.data || [];
  const filteredGroups = groupsData.filter((group: any) =>
    group.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Grupos</h2>
          <p className="text-muted-foreground">Organize seus contatos em grupos</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Grupo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar grupos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card border-border text-foreground"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filteredGroups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group: any) => (
            <Card key={group.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{group.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{group.contact_count || 0} contatos</span>
                  </div>
                  <Button variant="outline" size="sm" className="border-border">
                    Ver Grupo
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? 'Nenhum grupo encontrado' : 'Nenhum grupo cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Crie grupos para organizar seus contatos'}
            </p>
            {!searchTerm && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Criar Grupo
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Grupos;
