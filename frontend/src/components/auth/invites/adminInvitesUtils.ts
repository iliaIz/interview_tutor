export interface InviteItem {
  id: string;
  label: string;
  role: 'owner' | 'user';
  isActive: boolean;
  maxUses: number;
  useCount: number;
  createdAt: string;
  lastUsedAt?: string;
  userId: string;
  userName: string;
  userLastLoginAt?: string;
}

/**
 * Pure RFC 4180 CSV serializer and browser downloader for invite codes.
 * Prepends UTF-8 BOM (\uFEFF) for compatibility with Excel and third-party tools.
 */
export const exportInvitesToCsv = (invites: InviteItem[]): void => {
  if (!invites || invites.length === 0) return;

  const headers = ['ID', 'Label', 'Role', 'Status', 'Uses', 'Max Uses', 'Created At', 'Last Used At'];
  const rows = invites.map((inv) => [
    inv.id,
    `"${(inv.label || '').replace(/"/g, '""')}"`,
    inv.role,
    inv.isActive ? 'Active' : 'Revoked',
    inv.useCount,
    inv.maxUses === 0 ? 'Unlimited' : inv.maxUses,
    inv.createdAt ? new Date(inv.createdAt).toISOString() : '',
    inv.lastUsedAt ? new Date(inv.lastUsedAt).toISOString() : ''
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `invites_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
