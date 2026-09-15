import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './button';

const SidebarContext = createContext(null);

export const SidebarProvider = ({ children, defaultOpen = true }) => {
    const [open, setOpen] = useState(() => {
        if (typeof window === 'undefined') return defaultOpen;
        const stored = window.localStorage.getItem('tm_finance_sidebar_open');
        return stored === null ? defaultOpen : stored === 'true';
    });
    const value = useMemo(() => ({ open, setOpen, toggle: () => setOpen((current) => !current) }), [open]);

    useEffect(() => {
        document.documentElement.dataset.sidebarCollapsed = open ? 'false' : 'true';
        window.localStorage.setItem('tm_finance_sidebar_open', String(open));
    }, [open]);

    return (
        <SidebarContext.Provider value={value}>
            <div className={cn('ui-sidebar-provider', !open && 'is-collapsed')}>
                {children}
            </div>
        </SidebarContext.Provider>
    );
};

const useSidebarContext = () => useContext(SidebarContext);

export const Sidebar = ({ className, ...props }) => (
    <aside className={cn('ui-sidebar', className)} {...props} />
);

export const SidebarHeader = ({ className, ...props }) => (
    <div className={cn('ui-sidebar__header', className)} {...props} />
);

export const SidebarContent = ({ className, ...props }) => (
    <div className={cn('ui-sidebar__content', className)} {...props} />
);

export const SidebarFooter = ({ className, ...props }) => (
    <div className={cn('ui-sidebar__footer', className)} {...props} />
);

export const SidebarGroup = ({ className, ...props }) => (
    <div className={cn('ui-sidebar__group', className)} {...props} />
);

export const SidebarMenu = ({ className, ...props }) => (
    <nav className={cn('ui-sidebar__menu', className)} {...props} />
);

export const SidebarMenuButton = ({ className, isActive = false, ...props }) => (
    <button type="button" className={cn('ui-sidebar__menu-button', isActive && 'is-active', className)} {...props} />
);

export const SidebarTrigger = ({ className, ...props }) => {
    const sidebar = useSidebarContext();
    const Icon = sidebar?.open ? PanelLeftClose : PanelLeftOpen;

    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn('ui-sidebar__trigger', className)}
            aria-label={sidebar?.open ? 'Sidebar daralt' : 'Sidebar genişlet'}
            onClick={sidebar?.toggle}
            {...props}
        >
            <Icon size={18} strokeWidth={2.25} />
        </Button>
    );
};
