import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start new conversation",
    value: "/new",
  },
  {
    name: "login",
    description: "Log in to your account",
    value: "/login",
  },
  {
    name: "logout",
    description: "Log out of your account",
    value: "/logout",
  },
  {
    name: "theme",
    description: "Change the application theme",
    value: "/theme",
  },
  {
    name: "sessions",
    description: "Browse past sessions",
    value: "/sessions",
  },
  {
    name: "models",
    description: "Select AI model to use",
    value: "/models",
  },
  {
    name: "agents",
    description: "Switch between agents",
    value: "/agents",
  },
  {
    name: "usages",
    description: "Open billing portal to upgrade your plan",
    value: "/usages",
  },
  {
    name: "upgrade",
    description: "Buy more credits",
    value: "/upgrade",
  },
  {
    name: "exit",
    description: "Exit the application",
    value: "/exit",
    action: (ctx) => {
      ctx.exit();
    },
  },
];
