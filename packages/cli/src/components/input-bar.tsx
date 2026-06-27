import { readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { EmptyBorder } from "./border";
import { StatusBar } from "./status-bar";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { KeyBinding, TextareaRenderable,ScrollBoxRenderable } from "@opentui/core";
import { ScrollBox, TextAttributes } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useCommandMenu } from "./command-menu/use-command-menu";
import type { Command } from "./command-menu/types";
import { CommandMenu } from "./command-menu";
import { useToast } from "../providers/toast";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useDialog } from "../providers/dialog";
import { useTheme } from "../providers/theme";
import { useNavigate } from "react-router";
import { usePromptConfig } from "../providers/prompt-config";
import { MODE } from "@kodo/database/enums";
import { set } from "date-fns/fp";
import { close } from "node:inspector/promises";
import { te } from "date-fns/locale";

const MAX_VISIBLE_MENTIONS = 8;
const CURRENT_DIRECTORY = process.cwd();
const MAX_FALLBACK_MENTION_CANDIDATES = 24;
const MENTION_QUERY_CHARACTERS = /[A-Za-z0-9._/-]/;
const RECURSIVE_MENTION_IGNORED_CHARACTERS = new Set(["node_modules"]);

type MentionMatch = {
  start: number;
  end: number;
  query: string;
}

type MentionCandidate = {
  path: string;
  kind: "file" | "directory";
}

type Props = {
  onSubmit: (input: string) => void;
  disabled?: boolean;
};

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "enter", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "enter", shift: true, action: "newline" },
];

function isWithinCurrentDirectory(path: string) {
  const relativePath = relative(CURRENT_DIRECTORY, path);
  return relativePath === "" || (!relativePath.startsWith("..")) && !isAbsolute(relativePath);
}

function isMentionQueryCharacter(character: string) {
  return MENTION_QUERY_CHARACTERS.test(character);
}

function findActiveMention(text: string, cursorOffset: number): MentionMatch | null {
  const safeOffset = Math.max(0, Math.min(cursorOffset, text.length));

  let start = safeOffset;
  while (start > 0 && !/\s/.test(text[start - 1]!)) {
    start -= 1;
  }

  let end = safeOffset;
  while (end < text.length && !/\s/.test(text[end]!)) {
    end += 1;
  }

  const token = text.slice(start, end);
  const relativeCursor = safeOffset - start;
  const mentionStart = token.lastIndexOf("@", relativeCursor);

  if (mentionStart === -1) {
    return null;
  }

  const previousCharacter = token[mentionStart - 1];
  if (previousCharacter && isMentionQueryCharacter(previousCharacter)) {
    return null;
  }

  let mentionEnd = mentionStart + 1;
  while (mentionEnd < token.length && isMentionQueryCharacter(token[mentionEnd]!)) {
    mentionEnd += 1;
  }

  if (relativeCursor < mentionStart || relativeCursor > mentionEnd) {
    return null;
  }

  return {
    start: start + mentionStart,
    end: start + mentionEnd,
    query: token.slice(mentionStart + 1, mentionEnd),
  };
}


async function getMentionedCandidates(query: string): Promise<MentionCandidate[]> {
  const normalizedQuery = query.startsWith("./") ? query.slice(2) : query;
  if (normalizedQuery.startsWith("/")) {
    return [];
  }

  const hasTrailingSlash = normalizedQuery.endsWith("/");
  const lastSlashIndex = hasTrailingSlash
    ? normalizedQuery.length - 1
    : normalizedQuery.lastIndexOf("/");

  const directoryPart = hasTrailingSlash
    ? normalizedQuery.slice(0, -1)
    : lastSlashIndex === -1
    ? ""
    : normalizedQuery.slice(0, lastSlashIndex);

  // Bug 1 fix: use the full normalizedQuery as prefix when no slash is present
  const namePrefix = hasTrailingSlash
    ? ""
    : lastSlashIndex === -1
    ? normalizedQuery
    : normalizedQuery.slice(lastSlashIndex + 1);

  const absoluteDirectory = resolve(CURRENT_DIRECTORY, directoryPart || ".");
  if (!isWithinCurrentDirectory(absoluteDirectory)) {
    return [];
  }

  try {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    const lowercasePrefix = namePrefix.toLowerCase();
    const showHiddenEntries = namePrefix.startsWith(".");

    const directMatches = entries
      .filter((entry) => showHiddenEntries || !entry.name.startsWith("."))
      .filter((entry) =>
        lowercasePrefix === "" || entry.name.toLowerCase().startsWith(lowercasePrefix)
      )
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      })
      .map((entry) => {
        const path = directoryPart ? `${directoryPart}/${entry.name}` : entry.name;
        const kind: MentionCandidate["kind"] = entry.isDirectory() ? "directory" : "file";
        return {
          path: kind === "directory" ? `${path}/` : path,
          kind,
        };
      });

    // Bug 2 fix: only skip fallback if namePrefix is empty (bare listing)
    if (directMatches.length > 0 || namePrefix === "") {
      return directMatches;
    }

    const fallBackMatches: MentionCandidate[] = [];
    const visit = async (absoluteDirectory: string, directoryPart: string): Promise<void> => {
      const entries = await readdir(absoluteDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!showHiddenEntries && entry.name.startsWith(".")) {
          continue;
        }
        if (entry.isDirectory() && RECURSIVE_MENTION_IGNORED_CHARACTERS.has(entry.name)) {
          continue;
        }
        const path = directoryPart ? `${directoryPart}/${entry.name}` : entry.name;
        const kind: MentionCandidate["kind"] = entry.isDirectory() ? "directory" : "file";
        if (entry.name.toLowerCase().startsWith(lowercasePrefix)) {
          fallBackMatches.push({
            path: kind === "directory" ? `${path}/` : path,
            kind,
          });
          if (fallBackMatches.length >= MAX_FALLBACK_MENTION_CANDIDATES) return;
        }
        if (entry.isDirectory()) {
          await visit(resolve(absoluteDirectory, entry.name), path);
          if (fallBackMatches.length >= MAX_FALLBACK_MENTION_CANDIDATES) return;
        }
      }
    };

    await visit(absoluteDirectory, "");
    return fallBackMatches.sort((left, right) => left.path.localeCompare(right.path));
  } catch {
    return [];
  }
}

type FileMentionMenuProps = {
  candidates: MentionCandidate[];
  selectedIndex: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  onSelect: (index: number) => void;
  onExecute: (index: number) => void;
};

function FileMentionMenu({
  candidates,
  selectedIndex,
  scrollRef,
  onSelect,
  onExecute,
}: FileMentionMenuProps) {
  const { colors } = useTheme();
  const visibleHeight = Math.min(candidates.length, MAX_VISIBLE_MENTIONS);

  if (candidates.length === 0) {
    return (
      <box paddingX={1}>
        <text attributes={TextAttributes.DIM}>No matching files found.</text>
      </box>
    );
  }

  return (
    <scrollbox ref={scrollRef} height={visibleHeight}>
      {candidates.map((candidate, index) => {
        const isSelected = index === selectedIndex;
        const icon = candidate.kind === "directory" ? "📁" : "📄";
        return (
          <box
            key={candidate.path}
            paddingX={1}
            flexDirection="row"
            height={1}
            overflow="hidden"
            backgroundColor={isSelected ? colors.selection : undefined}
            onMouseDown={() => onSelect(index)}
            onMouseUp={() => onExecute(index)}
          >
            {/*<text>{icon} {candidate.path}</text>*/}
            <box flexGrow={1} flexShrink={1} overflow="hidden">
              <text selectable={false} fg={isSelected ? "black" : "white"}>
                {candidate.path}
              </text>
            </box>

            <box width={8} alignItems="flex-end" flexShrink={0}>
              <text selectable={false} fg={isSelected ? "black" : "white"}>
                {candidate.kind === "directory" ? "Folder" : "File"}
              </text>
            </box>
          </box>
        );
      })}
    </scrollbox>
  );
}
export function InputBar({ onSubmit, disabled = false }: Props) {
  const { mode, model, setMode, setModel, toggleMode } = usePromptConfig();
  const textAreaRef = useRef<TextareaRenderable | null>(null);
  const onSubmitRef = useRef<() => void>(() => { });

  const activeMentionRef = useRef<MentionMatch | null>(null)
  const mentionScrollRef = useRef<ScrollBoxRenderable>(null);

  const renderer = useRenderer();
  const navigate = useNavigate();
  const toast = useToast();
  const dialog = useDialog();
  const { isTopLayer, setResponder, push, pop } = useKeyboardLayer();

  const [activeMention, setActiveMention] = useState<MentionMatch | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

  const { colors } = useTheme();

  const {
    showCommandMenu,
    commandQuery,
    selectedIndex,
    scrollRef,
    handleContentChange,
    resolveCommand,
    setSelectedIndex,
  } = useCommandMenu();

  const showMentionMenu = activeMention !== null
  const closeMentionMenu = useCallback(() => {
    activeMentionRef.current = null;
    setActiveMention(null);
    setMentionCandidates([]);
    pop("mention");
  },[pop]);

  const syncMentionMenu = useCallback((
    text: string,
    cursorOffset: number
  ) => {
    const nextMention = findActiveMention(text, cursorOffset);
    const prevMention = activeMentionRef.current;
    const mentionChanged =
      prevMention?.start !== nextMention?.start ||
      prevMention?.end !== nextMention?.end ||
      prevMention?.query !== nextMention?.query;
    if (!nextMention) {
      if (prevMention) {
        closeMentionMenu();
      }
      return;
    }
    activeMentionRef.current = nextMention;
    setActiveMention(nextMention);
    push("mention", () => {
      closeMentionMenu();
      return true;
    })
    if (mentionChanged) {
      setMentionSelectedIndex(0);
      mentionScrollRef.current?.scrollTo(0)
    }
  }, [closeMentionMenu, push]);


  const handleTextAreaContentChange = useCallback(() => {
    const textArea = textAreaRef.current;
    if (!textArea) return;
    const text = textArea.plainText;
    handleContentChange(text);
    syncMentionMenu(text, textArea.cursorOffset);
  }, [handleContentChange, syncMentionMenu]);

  const handleSubmit = useCallback(() => {
    if (disabled) return;
    const textArea = textAreaRef.current;
    if (!textArea) return;
    const text = textArea.plainText.trim();
    if (text.length === 0) return;

    onSubmit(text);
    textArea.setText("");
  }, [disabled, onSubmit]);

  const handleMentionExecute = useCallback((index: number) => {
    const textarea = textAreaRef.current;
    const mention = activeMentionRef.current;
    const candidate = mentionCandidates[index];
    if (!textarea || !mention || !candidate) return;

    const insertion = candidate.kind === "directory" ? candidate.path : `${candidate.path}`;
    const nextText = `${textarea.plainText.slice(0, mention.start)}@${insertion}${textarea.plainText.slice(mention.end)}`
    textarea.replaceText(nextText)
    textarea.cursorOffset = mention.start + insertion.length + 1;
    syncMentionMenu(nextText, textarea.cursorOffset);
  }, [mentionCandidates , syncMentionMenu]);


  const handleTextareaCursorChange = useCallback(() => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    syncMentionMenu(textarea.plainText, textarea.cursorOffset);
  }, [syncMentionMenu]);

  const handleCommand = useCallback(
    (command: Command | undefined) => {
      const textArea = textAreaRef.current;
      if (!command || !textArea) return;
      textArea.setText("");
      if (command.action) {
        command.action({
          exit: () => renderer.destroy(),
          toast,
          dialog,
          navigate,
          mode,
          setMode,
          setModel
        });
      } else {
        textArea.insertText(command.value + " ");
      }
    },
    [renderer, toast, dialog, navigate ,mode , setMode, setModel],
  );

  const handleCommandExecute = useCallback(
    (index: number) => {
      const command = resolveCommand(index);
      handleCommand(command);
    },
    [handleCommand, resolveCommand],
  );

  useKeyboard((key)=>{
    if(disabled) return;
    if(!isTopLayer("base")) return;
    if(key.name === "tab"){
      key.preventDefault();
      toggleMode();
    }
  })

  useEffect(() => {
    if (!activeMention) {
      setMentionCandidates([]);
      return
    };
    let ignore = false;
    const loadCandidates = async () => {
      const nextCandidates = await getMentionedCandidates(activeMention.query)
      if(ignore) return;
      setMentionCandidates(nextCandidates);
      setMentionSelectedIndex((currentIndex) => {
        if (nextCandidates.length === 0) {
          return 0;
        }
        return Math.min(currentIndex , nextCandidates.length-1)
      })
    }
    void loadCandidates()
    return () => {
      ignore = true;
    }
  }, [activeMention]);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (!textArea) return;

    textArea.onSubmit = () => {
      onSubmitRef.current();
    };
  }, []);

  onSubmitRef.current = () => {
    if (disabled) return;
    if (showCommandMenu) {
      const command = resolveCommand(selectedIndex);
      handleCommand(command);
      return;
    }

    if (showMentionMenu) {
      const candidate = mentionCandidates[mentionSelectedIndex];
      if (candidate) {
        handleTextareaCursorChange();
        return;
      }
    }

    handleSubmit();
  };

  useEffect(() => {
    setResponder("base", () => {
      if (disabled) return false;
      const textarea = textAreaRef.current;
      if (textarea && textarea.plainText.length > 0) {
        textarea.setText("");
        return true;
      }
      return false;
    });
    return () => {
      setResponder("base", null);
    };
  }, [disabled, setResponder]);

  useKeyboard((key) => {
    if (disabled) return;
    if (!showMentionMenu || !isTopLayer("mention")) return
    if (key.name === "escape")
    {
      key.preventDefault()
      closeMentionMenu()
    }
    else if (key.name === "down") {
      key.preventDefault()
      setMentionSelectedIndex((currentIndex) => {
        if (mentionCandidates.length === 0) {
          return 0;
        }
        const nextIndex = Math.min(mentionCandidates.length-1, currentIndex + 1)
        const scrollBox = mentionScrollRef.current
        if (scrollBox) {
          const viewportHeight = scrollBox.viewport.height
          const visibleEnd = scrollBox.scrollTop + viewportHeight - 1
          if (nextIndex > visibleEnd) {
            scrollBox.scrollTo(nextIndex - viewportHeight + 1)
          }
        }
        return nextIndex
      })
    }
    else if (key.name === "up") {
      key.preventDefault()
      setMentionSelectedIndex((currentIndex) => {
        const nextIndex = Math.max(0, currentIndex - 1)
        const scrollBox = mentionScrollRef.current
        if (scrollBox && nextIndex < scrollBox.scrollTop) {
          scrollBox.scrollTo(nextIndex)
        }
        return nextIndex
      })
    }
  })

  return (
    <box width="100%" alignItems="center">
      <box
        border={["left"]}
        borderColor={mode === MODE.PLAN ? colors.planMode : colors.primary}
        customBorderChars={{
          ...EmptyBorder,
          vertical: "┃",
          bottomLeft: "╹",
        }}
        width="100%"
      >
        <box
          position="relative"
          justifyContent="center"
          paddingX={2}
          paddingY={1}
          backgroundColor={colors.surface}
          width="100%"
          gap={1}
        >
          {showCommandMenu && (
            <box
              position="absolute"
              bottom="100%"
              left={0}
              width="100%"
              backgroundColor={colors.surface}
              zIndex={10}
            >
              <CommandMenu
                query={commandQuery}
                selectedIndex={selectedIndex}
                scrollRef={scrollRef}
                onSelect={setSelectedIndex}
                onExecute={handleCommandExecute}
              />
            </box>
          )}
          <textarea
            ref={textAreaRef}
            focused={!disabled && (isTopLayer("base") || isTopLayer("command"))}
            keyBindings={TEXTAREA_KEY_BINDINGS}
            placeholder={`Ask any thing..." Fix database schema bug"`}
            onContentChange={handleTextAreaContentChange}
            width="100%"
          />
          <StatusBar />
        </box>
      </box>
    </box>
  );
}
