import { cn } from '../../lib/cn';

export const Badge = ({ className, variant = 'secondary', ...props }) => (
    <span className={cn('ui-badge', `ui-badge--${variant}`, className)} {...props} />
);
