import { createContext, useContext } from "react";
import type { User } from "./api";

export const SessionContext = createContext<{
  user: User | null;
  sessionLoading: boolean;
  openAuth: (next?: string, mode?: "login" | "signup") => void;
  toast: (message: string, kind?: "success" | "error") => void;
  // Novedades sin leer, para la campana y la pestaña de Mi espacio.
  unread: number;
  refreshUnread: () => void;
}>({
  user: null,
  sessionLoading: true,
  openAuth: () => {},
  toast: () => {},
  unread: 0,
  refreshUnread: () => {},
});
export const useApp = () => useContext(SessionContext);
