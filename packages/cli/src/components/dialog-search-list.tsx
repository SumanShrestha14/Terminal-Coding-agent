import { useCallback, useRef, useState, type ReactNode } from "react";

import {
  TextAttributes,
  type InputRenderable,
  type ScrollBoxRenderable,
} from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useTheme } from "../providers/theme";

const MAX_VISIBLE_ITEMS = 6;
type DialogSearchListProps<T> = {
  items: T[];
  onSelect: (item: T) => void;
  onHighlight: (item: T) => ReactNode;
  filterfn: (item: T, query: string) => boolean;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  getKey: (item: T) => string;
  placeholder?: string;
  emptyString?: string;
};

export function DialogSearchList<T>({
  items,
  onSelect,
  onHighlight,
  filterfn,
  renderItem,
  getKey,
  placeholder = "Search...",
  emptyString = "No results found",
}: DialogSearchListProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<InputRenderable>(null);
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);
  const { isTopLayer } = useKeyboardLayer();
  const {colors} = useTheme();

  const handleContentChange = useCallback(() => {
    const text = inputRef.current?.value || "";
    setSearchValue(text);
    setSelectedIndex(0);
    const scrollBox = scrollBoxRef.current;
    if (scrollBox) {
      scrollBox.scrollTo(0);
    }
  }, []);
  const filtered = searchValue
    ? items.filter((item) => filterfn(item, searchValue))
    : items;
  const visibleHeight = Math.min(filtered.length, MAX_VISIBLE_ITEMS);

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;

    if (key.name === "return" || key.name === "enter") {
      const item = filtered[selectedIndex];
      if (item) {
        onSelect(item);
      }
    } else if (key.name === "up") {
      setSelectedIndex((prev) => {
        const newIndex = Math.max(0, prev - 1);
        const scrollBox = scrollBoxRef.current;
        if (scrollBox && newIndex < scrollBox.scrollTop) {
          scrollBox.scrollTo(newIndex);
        }
        const item = filtered[newIndex];
        if (item && onHighlight) onHighlight(item);
        return newIndex;
      });
    } else if (key.name === "down") {
      setSelectedIndex((prev) => {
        const newIndex = Math.min(filtered.length - 1, prev + 1);
        const scrollBox = scrollBoxRef.current;
        if (scrollBox) {
          const viewPortHeight = scrollBox.viewport.height;
          const visibleEnd = scrollBox.scrollTop + viewPortHeight - 1;
          if (newIndex > visibleEnd)
            scrollBox.scrollTo(newIndex - viewPortHeight + 1);
        }
        const item = filtered[newIndex];
        if (item && onHighlight) onHighlight(item);
        return newIndex;
      });
    }
  });
  return (
    <box flexDirection="column" gap={1}>
      <input
        ref={inputRef}
        placeholder={placeholder}
        onContentChange={handleContentChange}
        focused
      />
      {filtered.length === 0 ? (
        <text attributes={TextAttributes.DIM}>{emptyString}</text>
      ) : (
        <scrollbox ref={scrollBoxRef} height={visibleHeight}>
          {filtered.map((item, index) => {
            const isSelected = index === selectedIndex;
            const key = getKey(item);
            return (
              <box
                key={key}
                flexDirection="row"
                height={1}
                overflow="hidden"
                backgroundColor={isSelected ? colors.selection : undefined}
                onMouseMove={() => {
                  setSelectedIndex(index);
                  if (onHighlight) onHighlight(item);
                }} 
                onMouseDown={() => onSelect(item)}
              >
                {renderItem(item, isSelected)}
              </box>
            );
          })}
        </scrollbox>
      )}
    </box>
  );
}
