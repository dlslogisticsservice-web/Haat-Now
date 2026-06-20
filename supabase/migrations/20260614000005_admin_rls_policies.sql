-- 0005_admin_rls_policies.sql
-- Grant admin users SELECT bypass on helpdesk tables so AdminDashboard can read all tickets and messages.
-- Existing policies on support_tickets and support_messages only match auth.uid() = customer_id,
-- which silently returns 0 rows for admin users.

create policy "Admins can read all support tickets" on support_tickets
  for select to authenticated
  using (
    exists (
      select 1
      from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'admin'
    )
  );

create policy "Admins can read all support messages" on support_messages
  for select to authenticated
  using (
    exists (
      select 1
      from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'admin'
    )
  );
