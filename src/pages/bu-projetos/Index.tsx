import { Outlet } from 'react-router-dom';
import { ResourceGuard } from '@/components/auth/ResourceGuard';

export default function BUProjetosIndex() {
  return (
    <ResourceGuard resource="projetos">
      <Outlet />
    </ResourceGuard>
  );
}
