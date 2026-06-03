import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { COMMANDS } from "./commands";
import type { RefObject } from "react";
import { getFilteredCommands } from "./filter-command";

const MAX_VISISBLE_COMMANDS = 8;
const COMMAND_COL_WIDTH =
  Math.max(...COMMANDS.map((cmd) => cmd.name.length)) + 4;

type CommandMenuProps = {
  query: string;
  selectedIndex: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  onSelect: (index: number) => void;
  onExecute: (index: number) => void;
};

export function CommandMenu({
  query,
  selectedIndex,
  scrollRef,
  onSelect,
  onExecute,
}: CommandMenuProps) {
  const filteredCommands = getFilteredCommands(query);
  const visibleCommands = Math.min(
    filteredCommands.length,
    MAX_VISISBLE_COMMANDS,
  );

  if (filteredCommands.length === 0) {
    return (
      <box paddingX={1}>
        <text attributes={TextAttributes.DIM}>No commands found</text>
      </box>
    );
  }

  return (
    <scrollbox ref={scrollRef} height={visibleCommands}>
      {filteredCommands.map((cmd, index) => {
        const isSelected = index === selectedIndex;

        return (
          <box
            key={cmd.name}
            flexDirection="row"
            paddingX={1}
            height={1}
            overflow="hidden"
            backgroundColor={isSelected ? "#89B4FA" : undefined}
            onMouseMove={() => onSelect(index)}
            onMouseDown={() => onExecute(index)}
          >
            <box width={COMMAND_COL_WIDTH} flexShrink={0}>
              <text selectable={false} fg={isSelected ? "black" : "white"}>
                /{cmd.name}
              </text>
            </box>
            <box flexShrink={0}>
              <text selectable={false} fg={isSelected ? "black" : "gray"}>
                {cmd.description}
              </text>
            </box>
          </box>
        );
      })}
    </scrollbox>
  );
}
