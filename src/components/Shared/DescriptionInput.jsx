import React, { useMemo, useState } from 'react';

const normalizeText = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');

const DescriptionInput = ({
    value,
    onChange,
    historyItems = [],
    inputStyle,
    wrapperStyle,
    placeholder = "Açıklama"
}) => {
    const [focused, setFocused] = useState(false);
    const query = String(value || '').trim();

    const suggestions = useMemo(() => {
        if (query.length < 3) return [];

        const normalizedQuery = normalizeText(query);
        const seen = new Set();
        const uniqueDescriptions = [];

        (historyItems || []).forEach(item => {
            const description = String(item?.aciklama || '').trim();
            if (!description) return;

            const key = normalizeText(description);
            if (seen.has(key)) return;

            seen.add(key);
            uniqueDescriptions.push(description);
        });

        return uniqueDescriptions
            .filter(description => normalizeText(description).includes(normalizedQuery))
            .slice(0, 8);
    }, [historyItems, query]);

    const showSuggestions = focused && suggestions.length > 0;

    return (
        <div style={{ position: 'relative', ...wrapperStyle }}>
            <input
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 120)}
                style={{ ...inputStyle, width: '100%' }}
                autoComplete="off"
            />

            {showSuggestions && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.14)',
                    overflow: 'hidden',
                    maxHeight: '220px',
                    overflowY: 'auto'
                }}>
                    {suggestions.map(description => (
                        <button
                            key={description}
                            type="button"
                            onMouseDown={(event) => {
                                event.preventDefault();
                                onChange({ target: { value: description } });
                                setFocused(false);
                            }}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: 'none',
                                borderBottom: '1px solid #f1f5f9',
                                background: '#ffffff',
                                color: '#1f2937',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600
                            }}
                        >
                            {description}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DescriptionInput;
