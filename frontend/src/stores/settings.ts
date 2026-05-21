"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ResponseStyle = "concise" | "detailed";

interface SettingsState {
  responseStyle: ResponseStyle;
  setResponseStyle: (style: ResponseStyle) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      responseStyle: "concise",
      setResponseStyle: (style) => set({ responseStyle: style }),
    }),
    { name: "flowmind-settings" },
  ),
);
