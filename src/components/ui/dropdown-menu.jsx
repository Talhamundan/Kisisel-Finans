import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

export const DropdownMenu = ({ children, className }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClick = (event) => {
            if (!ref.current?.contains(event.target)) setOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <div ref={ref} className={cn('ui-dropdown', className)} data-open={open ? 'true' : 'false'}>
            {React.Children.map(children, (child) => (
                React.isValidElement(child)
                    ? React.cloneElement(child, { dropdownOpen: open, setDropdownOpen: setOpen })
                    : child
            ))}
        </div>
    );
};

export const DropdownMenuTrigger = ({ children, dropdownOpen, setDropdownOpen }) => (
    React.cloneElement(children, {
        'aria-haspopup': 'menu',
        'aria-expanded': dropdownOpen,
        onClick: (event) => {
            children.props.onClick?.(event);
            setDropdownOpen((current) => !current);
        },
    })
);

export const DropdownMenuContent = ({ className, dropdownOpen, children }) => (
    dropdownOpen ? <div role="menu" className={cn('ui-dropdown__content', className)}>{children}</div> : null
);

export const DropdownMenuItem = ({ className, inset, ...props }) => (
    <button type="button" role="menuitem" className={cn('ui-dropdown__item', inset && 'is-inset', className)} {...props} />
);
