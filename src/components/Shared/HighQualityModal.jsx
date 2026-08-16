import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * A reusable, high-quality modal component.
 * Uses Portal to render at document.body level to avoid z-index/overflow issues.
 */
const HighQualityModal = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    children,
    footerButtons,
    headerActions,
    width = '450px',
    minHeight,
    maxHeight = '90vh',
    className,
    bodyClassName,
    overlayClassName,
    overlayStyle,
    contentStyle,
    headerStyle,
    bodyStyle,
    bodyScrollLock = true
}) => {
    useEffect(() => {
        if (!isOpen || !bodyScrollLock) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen, bodyScrollLock]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            onClose?.();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div
            className={overlayClassName}
            style={{
                position: 'fixed',
                inset: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(15, 23, 42, 0.55)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 99999,
                ...overlayStyle
            }}
            onClick={onClose}
        >
            <div
                className={['hq-modal', className].filter(Boolean).join(' ')}
                style={{
                    background: 'var(--surface-solid, #ffffff)',
                    width: '100%',
                    maxWidth: width,
                    minHeight: minHeight,
                    maxHeight: maxHeight,
                    overflowY: 'auto',
                    borderRadius: '18px',
                    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.30)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.25s ease-out',
                    position: 'relative',
                    ...contentStyle
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* HEADER */}
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', ...headerStyle }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        {icon && <span style={{ fontSize: '18px' }}>{icon}</span>}
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '0.1px' }}>{title}</h3>
                            {subtitle && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{subtitle}</p>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {headerActions}
                        <button
                            onClick={onClose}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: '18px',
                                color: '#94a3b8',
                                padding: '4px'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className={bodyClassName} style={{ padding: '18px 20px', ...bodyStyle }}>
                    {children}
                </div>

                {/* FOOTER (Optional) */}
                {footerButtons && (
                    <div style={{ padding: '14px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '18px', borderBottomRightRadius: '18px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        {footerButtons}
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default HighQualityModal;
