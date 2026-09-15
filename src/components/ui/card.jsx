import React from 'react';
import { cn } from '../../lib/cn';

export const Card = React.forwardRef(({ as: Comp = 'section', className, ...props }, ref) => (
    React.createElement(Comp, {
        ref,
        className: cn('ui-card', className),
        ...props,
    })
));
Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }) => (
    <div className={cn('ui-card__header', className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
    <h2 className={cn('ui-card__title', className)} {...props} />
);

export const CardDescription = ({ className, ...props }) => (
    <p className={cn('ui-card__description', className)} {...props} />
);

export const CardContent = ({ className, ...props }) => (
    <div className={cn('ui-card__content', className)} {...props} />
);

export const CardFooter = ({ className, ...props }) => (
    <div className={cn('ui-card__footer', className)} {...props} />
);
