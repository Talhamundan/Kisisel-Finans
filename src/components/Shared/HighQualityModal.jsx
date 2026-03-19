import React from 'react';
import ReactDOM from 'react-dom';

/**
 * A reusable, high-quality modal component.
 * Uses Portal to render at document.body level to avoid z-index/overflow issues.
 */
const HighQualityModal = ({ isOpen, onClose, title, icon, children, footerButtons, width = '450px', minHeight, maxHeight = '90vh' }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div
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
                zIndex: 99999
            }}
            onClick={onClose}
        >
            <div
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
                    position: 'relative' // Ensure relative content context
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* HEADER */}
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {icon && <span style={{ fontSize: '18px' }}>{icon}</span>}
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '0.1px' }}>{title}</h3>
                    </div>
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

                {/* BODY */}
                <div style={{ padding: '18px 20px' }}>
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
