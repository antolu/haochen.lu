import React, { useMemo, useState } from 'react';

interface TagMultiSelectProps {
  value: string[];
  options: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

const TagMultiSelect: React.FC<TagMultiSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Search or create tags...',
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [query, options]);

  const addTag = (tag: string) => {
    const cleaned = tag.trim();
    if (!cleaned) return;
    if (value.includes(cleaned)) return;
    onChange([...value, cleaned]);
    setQuery('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter(v => v !== tag));
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query) addTag(query);
    }
    if (e.key === 'Backspace' && !query && value.length) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2 border border-gray-300 rounded px-2 py-2">
        {value.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded"
          >
            {tag}
            <button onClick={() => removeTag(tag)} className="text-blue-600 hover:text-blue-800">
              ✕
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[120px] outline-none text-sm"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {query && (
        <div className="mt-2 border border-gray-200 rounded max-h-40 overflow-auto bg-white shadow">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-600">
              No match. Press Enter to create "{query}".
            </div>
          )}
          {filtered.map(opt => (
            <button
              key={opt}
              onClick={() => addTag(opt)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagMultiSelect;
