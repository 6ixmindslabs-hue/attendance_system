import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import type { UserRole } from '../types/app';

type RequireAuthProps = {
  roles?: UserRole[];
};

const getDefaultRedirect = (role: UserRole | null) => {
  if (role === 'ADMIN') {
    return '/admin';
  }

  if (role === 'STUDENT') {
    return '/student';
  }

  return '/';
};

export default function RequireAuth({ roles }: RequireAuthProps) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (roles?.length && (!role || !roles.includes(role))) {
    return <Navigate to={getDefaultRedirect(role)} replace />;
  }

  return <Outlet />;
}
