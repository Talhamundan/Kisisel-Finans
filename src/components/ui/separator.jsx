import { cn } from '../../lib/cn';

export const Separator = ({ className, orientation = 'horizontal', ...props }) => (
    <div
        role="separator"
        aria-orientation={orientation}
        className={cn('ui-separator', `ui-separator--${orientation}`, className)}
        {...props}
    />
);
