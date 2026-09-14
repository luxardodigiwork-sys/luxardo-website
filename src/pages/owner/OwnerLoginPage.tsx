import RoleLoginPage from '../../components/auth/RoleLoginPage';

export default function OwnerLoginPage() {
  return (
    <RoleLoginPage
      roleLabel="OWNER"
      allowedRoles={['owner', 'admin', 'super_admin']}
      redirectPath="/owner/dashboard"
      lockKey="owner_lock"
      attemptsKey="owner_attempts"
      tagline="Executive personnel only"
    />
  );
}
