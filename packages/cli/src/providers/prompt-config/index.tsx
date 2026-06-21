import { MODE } from "@kodo/database/enums";
import { DEFAULT_CHAT_MODEL_ID, type SupportedChatModelId } from "@kodo/shared";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type PromptConfigContextValue = {
  mode: MODE;
  toggleMode: () => void;
  setMode: (mode: MODE) => void;
  model: SupportedChatModelId;
  setModel: (model: SupportedChatModelId) => void;
};

const PromptConfigContext = createContext<PromptConfigContextValue | null>(
  null,
);

export function usePromptConfig(): PromptConfigContextValue {
  const value = useContext(PromptConfigContext);
  if (!value) {
    throw new Error(
      "usePromptConfig must be used within a PromptConfigProvider",
    );
  }
  return value;
}

type PromptConfigProviderProps = {
  children: ReactNode;
};
export function PromptConfigProvider({ children }: PromptConfigProviderProps) {
  const [mode, setMode] = useState<MODE>(MODE.BUILD);
  const [model, setModel] = useState<SupportedChatModelId>(
    DEFAULT_CHAT_MODEL_ID,
  );

  const toggleMode = useCallback(() => {
    setMode((prevMode) => (prevMode === MODE.BUILD ? MODE.PLAN : MODE.BUILD));
  }, []);

  return (
    <PromptConfigContext.Provider
      value={{ mode, toggleMode, setMode, model, setModel }}
    >
      {children}
    </PromptConfigContext.Provider>
  );
}
