import React from 'react';

const sizeMap = {
    sm: 30,
    md: 38,
    lg: 46,
};

const AppLogo = ({ size = 'md', showText = false, variant = 'default', className = '' }) => {
    const markSize = sizeMap[size] || sizeMap.md;

    return (
        <div className={`app-logo app-logo--${size} app-logo--${variant} ${className}`.trim()}>
            <img
                className="app-logo__mark"
                style={{ width: markSize, height: markSize, borderRadius: Math.round(markSize * 0.38) }}
                src="/logo.svg"
                alt=""
                aria-hidden="true"
            />
            {showText && <span className="app-logo__text">Kişisel Finans</span>}
        </div>
    );
};

export default AppLogo;
