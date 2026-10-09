import RoleLoginPage from '../../components/auth/RoleLoginPage';

export default function DispatchLoginPage() {
  return (
    <RoleLoginPage
      roleLabel="DISPATCH"
      allowedRoles={['dispatch', 'admin', 'super_admin']}
      redirectPath="/dispatch/dashboard"
      lockKey="dispatch_lock"
      attemptsKey="dispatch_attempts"
      tagline="Operations team only"
    />
  );
}
