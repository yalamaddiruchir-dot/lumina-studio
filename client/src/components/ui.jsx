import { useEffect, useRef, useState, useMemo } from 'react';
import { Icon } from './icons';
import { initials, avatarBg } from '../lib/format';

/* ---------- Avatar ---------- */
export function Avatar({ name, hue, size, className = '' }) {
  const cls = size ? `avatar avatar--${size}` : 'avatar';
  return (
    <span className={`${cls} ${className}`} style={{ background: avatarBg(hue) }} title={name}>
      {initials(name)}
    </span>
  );
}

/* ---------- Badges ---------- */
export const STATUS_META = {
  // Production pipeline stages
  booked: { label: 'Booked', cls: 'badge--gray' },
  data_copy: { label: 'Data Copy', cls: 'badge--blue' },
  lightroom: { label: 'Lightroom', cls: 'badge--violet' },
  video: { label: 'Video', cls: 'badge--pink' },
  album: { label: 'Album', cls: 'badge--teal' },
  final_review: { label: 'Final Review', cls: 'badge--amber' },
  delivered: { label: 'Delivered', cls: 'badge--green' },
  cancelled: { label: 'Cancelled', cls: 'badge--red' },
  // Photo gallery statuses
  uploaded: { label: 'Uploaded', cls: 'badge--gray' },
  selected: { label: 'Client selected', cls: 'badge--blue' },
  approved: { label: 'Approved', cls: 'badge--green' },
  // Invoice statuses
  draft: { label: 'Draft', cls: 'badge--gray' },
  sent: { label: 'Sent', cls: 'badge--blue' },
  partial: { label: 'Partially paid', cls: 'badge--amber' },
  paid: { label: 'Paid', cls: 'badge--green' },
  overdue: { label: 'Overdue', cls: 'badge--red' },
  cancelled: { label: 'Cancelled', cls: 'badge--red' },
  // Task statuses
  todo: { label: 'To do', cls: 'badge--gray' },
  in_progress: { label: 'In progress', cls: 'badge--blue' },
  review: { label: 'In review', cls: 'badge--amber' },
  done: { label: 'Done', cls: 'badge--green' },
  // Other entities
  active: { label: 'Active', cls: 'badge--green' },
  inactive: { label: 'Inactive', cls: 'badge--gray' },
  present: { label: 'Present', cls: 'badge--green' },
  late: { label: 'Late', cls: 'badge--amber' },
  half_day: { label: 'Half day', cls: 'badge--blue' },
  leave: { label: 'On leave', cls: 'badge--red' },
  wfh: { label: 'WFH', cls: 'badge--violet' },
  pending: { label: 'Pending', cls: 'badge--amber' },
  approved: { label: 'Approved', cls: 'badge--green' },
  rejected: { label: 'Rejected', cls: 'badge--red' },
  paid: { label: 'Paid', cls: 'badge--green' },
  draft: { label: 'Draft', cls: 'badge--gray' },
};

export const PRIORITY_META = {
  low: { label: 'Low', cls: 'badge--gray' },
  medium: { label: 'Medium', cls: 'badge--blue' },
  high: { label: 'High', cls: 'badge--amber' },
  urgent: { label: 'Urgent', cls: 'badge--red' },
};

export const ROLE_META = {
  owner: { label: 'Owner', cls: 'badge--indigo', level: 5 },
  admin: { label: 'System Admin', cls: 'badge--violet', level: 4 },
  manager: { label: 'Manager', cls: 'badge--blue', level: 3 },
  hr: { label: 'HR / Admin', cls: 'badge--pink', level: 3 },
  finance: { label: 'Finance', cls: 'badge--green', level: 3 },
  sales: { label: 'Sales', cls: 'badge--amber', level: 2 },
  quality: { label: 'Quality Control', cls: 'badge--teal', level: 2 },
  production: { label: 'Production', cls: 'badge--gray', level: 1 },
};

/** Production pipeline order (matches server Permissions.PIPELINE). */
export const PIPELINE = ['booked', 'data_copy', 'lightroom', 'video', 'album', 'final_review', 'delivered'];

export function Badge({ status, value, priority, role, className = '' }) {
  if (status && STATUS_META[status]) {
    return <span className={`badge ${STATUS_META[status].cls} ${className}`}>{STATUS_META[status].label}</span>;
  }
  if (priority && PRIORITY_META[priority]) {
    return <span className={`badge ${PRIORITY_META[priority].cls} ${className}`}>{PRIORITY_META[priority].label}</span>;
  }
  if (role && ROLE_META[role]) {
    return <span className={`badge ${ROLE_META[role].cls} ${className}`}>{ROLE_META[role].label}</span>;
  }
  return <span className={`badge badge--gray ${className}`}>{value || '—'}</span>;
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div style={{ padding: '8px 4px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-12" style={{ marginBottom: 12 }}>
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} style={{ flex: j === 0 ? 1.6 : 1, height: 16, borderRadius: 6 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ title = 'Nothing here yet', message, action, icon = 'inbox', small }) {
  return (
    <div className="empty" style={small ? { padding: '34px 16px' } : undefined}>
      <div className="empty__art" style={{ color: '#c3c8e0' }}>
        <Icon name={icon} size={small ? 52 : 64} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, size, top }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" style={top ? { zIndex: 300 } : undefined} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size === 'sm' ? 'modal--sm' : size === 'lg' ? 'modal--lg' : ''}`}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Delete', busy }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-2" style={{ fontSize: 13.5 }}>{message}</p>
    </Modal>
  );
}

/* ---------- Dropdown ---------- */
export function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref} style={{ position: 'relative' }}>
      <span onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex' }}>{trigger}</span>
      {open && (
        <div className="menu" style={{ left: align === 'left' ? 0 : undefined, right: align === 'right' ? 0 : undefined }}
          onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export function RowActions({ onEdit, onDelete, onView, editLabel = 'Edit', deleteLabel = 'Delete', canEdit = true, canDelete = true }) {
  return (
    <div className="row-actions">
      {onView && (
        <button className="icon-btn" style={{ width: 30, height: 30 }} title="View" onClick={onView}>
          <Icon name="eye" size={14} />
        </button>
      )}
      {canEdit && onEdit && (
        <button className="icon-btn" style={{ width: 30, height: 30 }} title={editLabel} onClick={onEdit}>
          <Icon name="pencil" size={13.5} />
        </button>
      )}
      {canDelete && onDelete && (
        <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--danger)' }} title={deleteLabel} onClick={onDelete}>
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
}

/* ---------- Client-side pagination hook ---------- */
export function usePager(items = [], perPage = 8) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safe = Math.min(page, pages);
  const slice = useMemo(() => items.slice((safe - 1) * perPage, safe * perPage), [items, safe, perPage]);
  return { page: safe, setPage, pages, total, slice };
}

export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
      {Array.from({ length: pages }).slice(0, 7).map((_, i) => {
        const p = i + 1;
        return <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>;
      })}
      <button disabled={page === pages} onClick={() => setPage(page + 1)}>›</button>
    </div>
  );
}

/* ---------- Toolbar pieces ---------- */
export function SearchBox({ value, onChange, placeholder = 'Search…', style }) {
  return (
    <div className="search-input" style={style}>
      <Icon name="search" size={15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function PageHeader({ title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="flex gap-8">{actions}</div>}
    </div>
  );
}
