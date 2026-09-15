import React from 'react';
import { cn } from '../../lib/cn';

const variantClass = {
    default: 'ui-button--default',
    secondary: 'ui-button--secondary',
    ghost: 'ui-button--ghost',
    outline: 'ui-button--outline',
    destructive: 'ui-button--destructive',
};

const sizeClass = {
    default: 'ui-button--md',
    sm: 'ui-button--sm',
    icon: 'ui-button--icon',
};

export const Button = React.forwardRef(({
    className,
    variant = 'default',
    size = 'default',
    children,
    ...props
}, ref) => {
    const classes = cn('ui-button', variantClass[variant], sizeClass[size], className);

    return (
        <button ref={ref} className={classes} {...props}>
            {children}
        </button>
    );
});

Button.displayName = 'Button';
