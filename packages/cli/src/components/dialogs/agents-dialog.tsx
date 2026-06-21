import { useCallback } from "react";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";
import { MODE } from "@kodo/database/enums";

const AVAILABLE_MODES: MODE[] = [MODE.BUILD, MODE.PLAN];
type AgentDialogProps = {
  currentMode: MODE;
  onSelectMode: (mode: MODE) => void;
};

function getModeLabel(mode: MODE) {
  return mode === MODE.BUILD ? "Build" : "Plan";
}

export const AgentsDialogs = ({
  currentMode,
  onSelectMode,
}: AgentDialogProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (nextMode: MODE) => {
      onSelectMode(nextMode);
      dialog.close();
    },
    [dialog, onSelectMode],
  );

  return (
    <DialogSearchList
      items={AVAILABLE_MODES}
      onSelect={handleSelect}
      filterfn={(mode, query) =>
        getModeLabel(mode).toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(mode, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {mode === currentMode ? "✔ " : "  "}
          {getModeLabel(mode)}
        </text>
      )}
      getKey={(mode) => mode}
      placeholder="Search agents..."
      emptyString="No agents found"
    />
  );
};
