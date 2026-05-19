'use client';
import { useMemo, useState, useActionState } from 'react';
import {
  createStaffMember, updateStaffPermissions,
  toggleStaffActive, resetStaffPassword, deleteStaffMember,
} from '@/app/admin/team/actions';
import {
  ALL_PERMISSIONS, PERMISSION_META, GROUP_META,
  ROLE_TEMPLATES, matchRole,
  type PermissionGroup,
} from '@/lib/permissions';
import type { Permission, RoleKey } from '@/lib/permissions';

interface Staff {
  id: string;
  email: string;
  name: string;
  permissions: Permission[];
  is_active: boolean;
  created_at: string;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'white', borderRadius: 12,
  border: '1px solid #e5e7eb', overflow: 'hidden',
};
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
};
const btn = (color = '#111827', ghost = false): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600,
  cursor: 'pointer', border: ghost ? `1px solid ${color}` : 'none',
  background: ghost ? 'transparent' : color,
  color: ghost ? color : 'white',
});

// ─── Permission picker ───────────────────────────────────────────────────────
// Three layers:
//   1. Role template dropdown (Owner, Manager, Marketer, Support, …) — sets
//      a known bundle of permissions in one click. Picking "Custom" leaves
//      the current selection untouched so the user can hand-tune.
//   2. Quick actions: Select all / Clear / Revoke analytics — common
//      one-click flows.
//   3. Grouped checklist (Commerce / Content / Analytics / Store) with full
//      label + description per row so the merchant knows what they're handing
//      out.

const GROUPS_ORDER: PermissionGroup[] = ['commerce', 'content', 'analytics', 'store'];

function PermissionGrid({ selected, onChange }: {
  selected: Permission[];
  onChange: (p: Permission[]) => void;
}) {
  const toggle = (p: Permission) =>
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p]);

  const currentRole: RoleKey = useMemo(() => matchRole(selected), [selected]);

  const applyRole = (key: RoleKey) => {
    if (key === 'custom') return;
    const tmpl = ROLE_TEMPLATES.find(r => r.key === key);
    if (!tmpl) return;
    onChange([...tmpl.permissions]);
  };

  // Group the permission list once.
  const byGroup = useMemo(() => {
    const map: Record<PermissionGroup, Permission[]> = { commerce: [], content: [], analytics: [], store: [] };
    for (const p of ALL_PERMISSIONS) map[PERMISSION_META[p].group].push(p);
    return map;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hidden inputs so the form submission picks them up regardless of
          which rows are checked in the visible UI. We submit one value per
          selected permission so the server action receives them as an array. */}
      {selected.map(p => <input key={p} type="hidden" name="permissions" value={p} />)}

      {/* Role template + quick actions */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
        padding: '12px 14px', background: '#f9fafb', borderRadius: 8,
        border: '1px solid #e5e7eb',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
          Role template
          <select
            value={currentRole}
            onChange={e => applyRole(e.target.value as RoleKey)}
            style={{
              padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6,
              fontSize: '0.8125rem', background: 'white', cursor: 'pointer',
            }}
          >
            {ROLE_TEMPLATES.map(r => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', flex: 1, minWidth: 200 }}>
          {ROLE_TEMPLATES.find(r => r.key === currentRole)?.description}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => onChange([...ALL_PERMISSIONS])} style={miniBtn('#374151', true)}>
            Select all
          </button>
          <button type="button" onClick={() => onChange([])} style={miniBtn('#dc2626', true)}>
            Clear
          </button>
        </div>
      </div>

      {/* Grouped checklist */}
      {GROUPS_ORDER.map(group => {
        const items = byGroup[group];
        if (items.length === 0) return null;
        const { label, desc } = GROUP_META[group];
        const allOn = items.every(p => selected.includes(p));
        return (
          <div key={group}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8,
            }}>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{desc}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (allOn) onChange(selected.filter(p => !items.includes(p)));
                  else       onChange([...new Set([...selected, ...items])]);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6366f1', fontSize: '0.75rem', fontWeight: 600,
                }}
              >
                {allOn ? 'Revoke all' : 'Grant all'}
              </button>
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {items.map(p => {
                const { label, icon, desc } = PERMISSION_META[p];
                const on = selected.includes(p);
                return (
                  <label key={p} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    border: `1px solid ${on ? '#6366f1' : '#e5e7eb'}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: on ? '#eef2ff' : 'white',
                    transition: 'all 0.15s',
                  }}>
                    <input type="checkbox"
                      checked={on} onChange={() => toggle(p)}
                      style={{ marginTop: 2, accentColor: '#6366f1' }} />
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>
                        {icon} {label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2, lineHeight: 1.45 }}>{desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function miniBtn(color: string, ghost = false): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
    cursor: 'pointer', border: ghost ? `1px solid ${color}` : 'none',
    background: ghost ? 'transparent' : color,
    color: ghost ? color : 'white',
  };
}

// ─── Add Staff Modal ──────────────────────────────────────────────────────────

function AddStaffModal({ onClose }: { onClose: () => void }) {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [state, action, pending] = useActionState(createStaffMember, null);

  if (state && 'tempPassword' in state) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16, color: '#111827' }}>
          ✓ Staff member created
        </div>
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8,
          padding: 16, marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#92400e' }}>
            Temporary password — share this once and ask them to change it:
          </p>
          <code style={{
            display: 'block', fontSize: '1.125rem', fontWeight: 700,
            letterSpacing: '0.1em', color: '#111827',
          }}>{state.tempPassword}</code>
        </div>
        <button style={btn('#111827')} onClick={onClose}>Done</button>
      </div>
    );
  }

  return (
    <form action={action} style={{ padding: 28 }}>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 20, color: '#111827' }}>
        Add Staff Member
      </div>
      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
            Full Name
          </label>
          <input name="name" required placeholder="Ali Hassan" style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
            Email
          </label>
          <input name="email" type="email" required placeholder="ali@example.com" style={inp} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>
          Permissions
        </label>
        <PermissionGrid selected={perms} onChange={setPerms} />
        {perms.map(p => <input key={p} type="hidden" name="permissions" value={p} />)}
      </div>

      {state && 'error' in state && (
        <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: 12 }}>{state.error}</p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={pending} style={btn('#6366f1')}>
          {pending ? 'Creating…' : 'Create Account'}
        </button>
        <button type="button" style={btn('#6b7280', true)} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────

function EditStaffModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const [perms, setPerms] = useState<Permission[]>(staff.permissions);
  const [saveState, saveAction, savePending] = useActionState(updateStaffPermissions, null);
  const [resetState, resetAction, resetPending] = useActionState(resetStaffPassword, null);

  if (resetState && 'tempPassword' in resetState) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16 }}>Password Reset</div>
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#92400e' }}>
            New temporary password for {staff.name}:
          </p>
          <code style={{ display: 'block', fontSize: '1.125rem', fontWeight: 700, letterSpacing: '0.1em', color: '#111827' }}>
            {resetState.tempPassword}
          </code>
        </div>
        <button style={btn('#111827')} onClick={onClose}>Done</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>Edit — {staff.name}</div>
      <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 20 }}>{staff.email}</div>

      <form action={saveAction}>
        <input type="hidden" name="id" value={staff.id} />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
            Full Name
          </label>
          <input name="name" defaultValue={staff.name} required style={inp} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            Permissions
          </label>
          <PermissionGrid selected={perms} onChange={setPerms} />
          {perms.map(p => <input key={p} type="hidden" name="permissions" value={p} />)}
        </div>
        {saveState?.error && (
          <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: 12 }}>{saveState.error}</p>
        )}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button type="submit" disabled={savePending} style={btn('#6366f1')}>
            {savePending ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" style={btn('#6b7280', true)} onClick={onClose}>Cancel</button>
        </div>
      </form>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>
          Password Reset
        </div>
        <form action={resetAction}>
          <input type="hidden" name="id" value={staff.id} />
          {resetState && 'error' in resetState && (
            <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: 8 }}>{resetState.error}</p>
          )}
          <button type="submit" disabled={resetPending} style={btn('#f59e0b')}>
            {resetPending ? 'Resetting…' : '⟳ Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Staff row ────────────────────────────────────────────────────────────────

function StaffRow({ staff }: { staff: Staff }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={5} style={{ padding: 0 }}>
          <EditStaffModal staff={staff} onClose={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: '1px solid #f3f4f6' }}>
      <td data-label="Member" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#eef2ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6366f1', fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0,
          }}>
            {staff.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{staff.name}</div>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{staff.email}</div>
          </div>
        </div>
      </td>
      <td data-label="Permissions" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(() => {
            // Defence-in-depth: dedupe at render time. The audit caught a
            // staff member whose permissions column had duplicate entries —
            // the SQL fix in migration 070 dedupes existing data, this
            // guards against any future regression.
            const uniq = Array.from(new Set(staff.permissions));
            if (uniq.length === 0) {
              return <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>No permissions</span>;
            }
            return uniq.map(p => (
              <span key={p} style={{
                background: '#eef2ff', color: '#6366f1', borderRadius: 4,
                padding: '2px 7px', fontSize: '0.6875rem', fontWeight: 600,
              }}>
                {PERMISSION_META[p]?.label ?? p}
              </span>
            ));
          })()}
        </div>
      </td>
      <td data-label="Status" style={{ padding: '14px 20px' }}>
        <span style={{
          background: staff.is_active ? '#dcfce7' : '#fee2e2',
          color: staff.is_active ? '#166534' : '#991b1b',
          borderRadius: 4, padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600,
        }}>
          {staff.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td data-label="Added" style={{ padding: '14px 20px', color: '#6b7280', fontSize: '0.8125rem' }}>
        {new Date(staff.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={btn('#6366f1', true)} onClick={() => setEditing(true)}>Edit</button>
          <form action={toggleStaffActive} style={{ display: 'inline' }}>
            <input type="hidden" name="id" value={staff.id} />
            <input type="hidden" name="is_active" value={String(staff.is_active)} />
            <button type="submit" style={btn(staff.is_active ? '#f59e0b' : '#22c55e', true)}>
              {staff.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </form>
          {confirm ? (
            <form action={deleteStaffMember} style={{ display: 'inline' }}>
              <input type="hidden" name="id" value={staff.id} />
              <button type="submit" style={btn('#ef4444')}>Confirm Delete</button>
              <button type="button" style={{ ...btn('#6b7280', true), marginLeft: 6 }} onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button style={btn('#ef4444', true)} onClick={() => setConfirm(true)}>Delete</button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function TeamPage({ staff }: { staff: Staff[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div style={{ padding: '32px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Team</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            Manage staff accounts and their permissions
          </p>
        </div>
        <button style={btn('#ec4899')} onClick={() => setAdding(true)}>+ Add Staff Member</button>
      </div>

      {adding && (
        <div style={{ ...card, marginBottom: 24 }}>
          <AddStaffModal onClose={() => setAdding(false)} />
        </div>
      )}

      <div style={card}>
        {staff.length === 0 ? (
          <div style={{ padding: '60px 32px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⬡</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No staff members yet</div>
            <div style={{ fontSize: '0.875rem' }}>Click "Add Staff Member" to get started</div>
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Staff Member', 'Permissions', 'Status', 'Added', 'Actions'].map(h => (
                  <th scope="col" key={h} style={{
                    padding: '12px 20px', textAlign: 'left',
                    fontSize: '0.75rem', fontWeight: 600,
                    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => <StaffRow key={s.id} staff={s} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
