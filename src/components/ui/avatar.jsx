import { cn } from '../../lib/cn';

export const Avatar = ({ className, ...props }) => (
    <span className={cn('ui-avatar', className)} {...props} />
);

export const AvatarFallback = ({ className, ...props }) => (
    <span className={cn('ui-avatar__fallback', className)} {...props} />
);
