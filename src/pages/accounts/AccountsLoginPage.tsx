import RoleLoginPage from '../../components/auth/RoleLoginPage';

export default function AccountsLoginPage() {
  return (
    <RoleLoginPage
      roleLabel="ACCOUNTS"
      allowedRoles={['accounts', 'analysis', 'admin', 'super_admin']}
      redirectPath="/analysis/dashboard"
      lockKey="accounts_lock"
      attemptsKey="accounts_attempts"
      tagline="Finance & analytics team only"
    />
  );
}
