import React, { useMemo, useCallback, useRef } from "react";
import { Tag, TagInput } from "emblor-maintained";

interface SharedTag {
  id: string;
  text: string;
}

interface TagMultiSelectProps {
  value: string[];
  options: string[];
  onChange: (values: string[]) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
}

const DATALIST_ID = "tag-multiselect-options";

const TagMultiSelect: React.FC<TagMultiSelectProps> = ({
  value,
  options,
  onChange,
  onBlur,
  name,
  placeholder = "Search or create tags...",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const tags = useMemo<Tag[]>(
    () => value.map((tag) => ({ id: tag, text: tag })),
    [value],
  );

  const handleSetTags = useCallback(
    (newTags: Tag[] | ((prev: Tag[]) => Tag[])) => {
      let result: Tag[];
      if (typeof newTags === "function") {
        result = newTags(tags);
      } else {
        result = newTags;
      }

      const tagStrings = (result as SharedTag[])
        .map((t) => t.text.trim())
        .filter(Boolean);
      const uniqueTags = Array.from(new Set(tagStrings));

      if (JSON.stringify(uniqueTags) !== JSON.stringify(value)) {
        onChange(uniqueTags);
      }
    },
    [onChange, tags, value],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const input = containerRef.current?.querySelector("input");
    if (input && e.target !== input) {
      e.preventDefault();
      input.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className="cursor-text border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all"
      onMouseDown={handleMouseDown}
    >
      <datalist id={DATALIST_ID}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <TagInput
        tags={tags}
        setTags={handleSetTags}
        placeholder={placeholder}
        enableAutocomplete={false}
        delimiters={[",", "Enter"]}
        maxTags={50}
        showCount={false}
        className="text-sm border-none shadow-none focus-visible:ring-0"
        styleClasses={{
          input:
            "shadow-none focus-visible:ring-0 px-3 py-2 min-w-[120px] bg-transparent",
          tagList: {
            container: "flex flex-wrap gap-1.5 p-2",
          },
          tag: {
            body: "bg-primary/10 text-primary border-none text-xs px-2 py-1 whitespace-nowrap rounded-md",
            closeButton: "text-primary hover:text-primary/70 ml-1",
          },
        }}
        activeTagIndex={null}
        setActiveTagIndex={() => {}}
        onBlur={onBlur}
        inputProps={{
          name,
          autoComplete: "off",
          list: DATALIST_ID,
        }}
      />
    </div>
  );
};

export default TagMultiSelect;
