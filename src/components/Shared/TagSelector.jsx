import React from 'react';

const TagSelector = ({ tags = [], selectedIds = [], onChange, label = 'Etiketler' }) => {
    if (!tags.length) return null;

    const selectedSet = new Set(selectedIds || []);
    const toggleTag = (tagId) => {
        if (!tagId) return;
        const next = new Set(selectedSet);
        if (next.has(tagId)) next.delete(tagId);
        else next.add(tagId);
        onChange?.(Array.from(next));
    };

    return (
        <div className="qw-tag-selector">
            <span>{label}</span>
            <div>
                {tags.map((tag) => (
                    <button
                        key={tag.id}
                        type="button"
                        className={selectedSet.has(tag.id) ? 'is-selected' : ''}
                        onClick={() => toggleTag(tag.id)}
                    >
                        #{tag.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TagSelector;
