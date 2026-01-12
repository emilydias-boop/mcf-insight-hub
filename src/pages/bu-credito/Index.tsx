import { Outlet } from 'react-router-dom';
import { ResourceGuard } from '@/components/auth/ResourceGuard';

export default function BUCreditoIndex() {
  return (
    <ResourceGuard resource="credito">
      <Outlet />
    </ResourceGuard>
  );
}
