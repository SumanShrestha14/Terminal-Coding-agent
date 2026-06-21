import { SessionDialog,ThemeDialogs } from "../dialogs";
import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.navigate("/");
    },
  },
  {
    name: "login",
    description: "Log in to your account",
    value: "/login",
    action: (ctx) => {
      ctx.toast.show({ message: "Logging in..." });
    },
  },
  {
    name: "logout",
    description: "Log out of your account",
    value: "/logout",
    action: (ctx) => {
      ctx.toast.show({ message: "Logging out..." });
    },
  },
  {
    name: "theme",
    description: "Change the application theme",
    value: "/theme",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Theme",
        children: <ThemeDialogs />,
      });
    },
  },
  {
    name: "sessions",
    description: "Browse past sessions",
    value: "/sessions",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Sessions",
        children: <SessionDialog />,
        // children: <text>Session browsing coming soon...</text>,
      });
    },
  },
  {
    name: "models",
    description: "Select AI model to use",
    value: "/models",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Mode",
        children: <text>Model selection coming soon...</text>,
      });
    },
  },
  {
    name: "agents",
    description: "Switch between agents",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Mode",
        children: <text>Agent Selection coming soon...</text>,
      });
    },
  },
  {
    name: "usages",
    description: "Open billing portal to upgrade your plan",
    value: "/usages",
    action: (ctx) => {
      ctx.toast.show({ message: "Opening billing portal..." });
    },
  },
  {
    name: "upgrade",
    description: "Buy more credits",
    value: "/upgrade",
    action: (ctx) => {
      ctx.toast.show({ message: "Loading upgrade options..." });
    },
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
