import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClintContacts } from '@/hooks/useClintAPI';
import { Search, Plus, Mail, Phone, User } from 'lucide-react';

const Contatos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: contacts, isLoading } = useClintContacts();

  const contactsData = contacts?.data || [];
  const filteredContacts = contactsData.filter((contact: any) =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Contatos</h2>
          <p className="text-muted-foreground">Gerencie todos os seus contatos</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Contato
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contatos por nome ou email..."
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
      ) : filteredContacts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact: any) => (
            <Card key={contact.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{contact.name}</h3>
                      <p className="text-xs text-muted-foreground">ID: {contact.id.slice(0, 8)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                </div>

                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.slice(0, 3).map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="bg-primary/10 text-primary border-0">
                        {tag}
                      </Badge>
                    ))}
                    {contact.tags.length > 3 && (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">
                        +{contact.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Comece adicionando seus primeiros contatos'}
            </p>
            {!searchTerm && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Contato
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Contatos;
