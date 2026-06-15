import React, { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface TagMultiSelectProps {
  value: string[];
  options: string[];
  onChange: (values: string[]) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  placeholder?: string;
}

const TagMultiSelect: React.FC<TagMultiSelectProps> = ({
  value,
  options,
  onChange,
  onBlur,
  name,
  id,
  placeholder = "Search or create tags...",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return options.filter((option) => {
      if (value.includes(option)) return false;
      if (!query) return false;
      return option.toLowerCase().includes(query);
    });
  }, [inputValue, options, value]);

  const showSuggestions = isFocused && suggestions.length > 0;

  const addTag = (tag: string) => {
    const cleaned = tag.trim();
    if (!cleaned || value.includes(cleaned)) return;
    onChange([...value, cleaned]);
    setInputValue("");
    setHighlightedIndex(0);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((v) => v !== tag));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Enter":
      case ",":
        if (inputValue.trim()) {
          e.preventDefault();
          addTag(inputValue);
        }
        break;
      case "Tab":
        if (showSuggestions) {
          e.preventDefault();
          // eslint-disable-next-line security/detect-object-injection
          addTag(suggestions[highlightedIndex]);
        }
        break;
      case "ArrowDown":
        if (showSuggestions) {
          e.preventDefault();
          setHighlightedIndex((i) => (i + 1) % suggestions.length);
        }
        break;
      case "ArrowUp":
        if (showSuggestions) {
          e.preventDefault();
          setHighlightedIndex(
            (i) => (i - 1 + suggestions.length) % suggestions.length,
          );
        }
        break;
      case "Escape":
        if (showSuggestions) {
          e.preventDefault();
          setIsFocused(false);
        }
        break;
      case "Backspace":
        if (inputValue === "" && value.length > 0) {
          removeTag(value[value.length - 1]);
        }
        break;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== inputRef.current) {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative cursor-text border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all"
      onMouseDown={handleMouseDown}
    >
      <div className="flex flex-wrap items-center gap-1.5 p-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center bg-primary/10 text-primary text-xs px-2 py-1 rounded-md whitespace-nowrap"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-primary hover:text-primary/70 ml-1"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          name={name}
          id={id}
          type="text"
          autoComplete="off"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none px-1 py-1"
        />
      </div>

      {showSuggestions && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md p-2">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                className={cn(
                  "inline-flex items-center text-xs px-2 py-1 rounded-md border border-primary/30 text-primary whitespace-nowrap transition-colors hover:bg-primary/10",
                  index === highlightedIndex &&
                    "bg-primary/10 border-primary/60",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(suggestion);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TagMultiSelect;
