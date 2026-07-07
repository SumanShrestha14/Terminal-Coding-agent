import { useCallback } from "react";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";
import { Mode , type ModeType } from "@kodo/shared";

const AVAILABLE_MODES: ModeType[] = [Mode.BUILD, Mode.PLAN];
type AgentDialogProps = {
  currentMode: ModeType;
  onSelectMode: (mode: ModeType) => void;
};

function getModeLabel(mode: ModeType) {
  return mode === Mode.BUILD ? "Build" : "Plan";
}

export const AgentsDialogs = ({
  currentMode,
  onSelectMode,
}: AgentDialogProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (nextMode: ModeType) => {
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
