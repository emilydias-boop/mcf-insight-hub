import { useState } from 'react';
import { Employee } from '@/types/hr';
import { useAvailableProfiles, useLinkedProfile, AvailableProfile } from '@/hooks/useAvailableProfiles';
import { useEmployeeMutations } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { UserCheck, UserX, Link2, Unlink, Mail, Shield } from 'lucide-react';

interface ProfileLinkSectionProps {
  employee: Employee;
  editing: boolean;
  onProfileChange?: (profileId: string | null) => void;
}

export default function ProfileLinkSection({ employee, editing, onProfileChange }: ProfileLinkSectionProps) {
  const { data: availableProfiles, isLoading: loadingAvailable } = useAvailableProfiles();
  const { data: linkedProfile, isLoading: loadingLinked } = useLinkedProfile(employee.profile_id);
  const { updateEmployee } = useEmployeeMutations();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const handleLink = () => {
    if (!selectedProfileId) return;
    
    updateEmployee.mutate({
      id: employee.id,
      data: { profile_id: selectedProfileId },
    }, {
      onSuccess: () => {
        setSelectedProfileId(null);
      }
    });
  };

  const handleUnlink = () => {
    updateEmployee.mutate({
      id: employee.id,
      data: { profile_id: null, user_id: null },
    });
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'manager': return 'bg-purple-500';
      case 'coordenador': return 'bg-blue-500';
      case 'sdr': return 'bg-green-500';
      case 'closer': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  // View quando há profile vinculado
  if (linkedProfile) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Usuário do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">{linkedProfile.full_name || linkedProfile.email}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" />
                {linkedProfile.email}
              </div>
              <div className="flex items-center gap-2 mt-2">
                {linkedProfile.role && (
                  <Badge className={getRoleBadgeColor(linkedProfile.role)}>
                    <Shield className="h-3 w-3 mr-1" />
                    {linkedProfile.role}
                  </Badge>
                )}
                {linkedProfile.squad && (
                  <Badge variant="outline">{linkedProfile.squad}</Badge>
                )}
              </div>
            </div>
            
            {editing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Unlink className="h-4 w-4 mr-1" />
                    Desvincular
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desvincular Usuário</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja desvincular este colaborador do usuário do sistema?
                      O colaborador não terá mais acesso associado ao profile.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleUnlink}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Desvincular
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // View quando não há profile vinculado
  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
          <UserX className="h-4 w-4" />
          Usuário do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vincule este colaborador a um usuário do sistema para integrar dados de RH com permissões e CRM.
            </p>
            <div className="flex gap-2">
              <Select
                value={selectedProfileId || ''}
                onValueChange={setSelectedProfileId}
                disabled={loadingAvailable}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      <div className="flex items-center gap-2">
                        <span>{profile.full_name || profile.email}</span>
                        {profile.role && (
                          <Badge variant="secondary" className="text-xs">
                            {profile.role}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {availableProfiles?.length === 0 && (
                    <div className="px-2 py-1 text-sm text-muted-foreground">
                      Todos os usuários já estão vinculados
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleLink} 
                disabled={!selectedProfileId || updateEmployee.isPending}
                size="sm"
              >
                <Link2 className="h-4 w-4 mr-1" />
                Vincular
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum usuário vinculado. Clique em "Editar" para vincular.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
