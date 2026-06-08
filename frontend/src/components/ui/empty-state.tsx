import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}

/** Estado vacío con icono, título, descripción y CTA opcional. */
export function EmptyState({ icon: Icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon />
      </div>
      <h4>{title}</h4>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
