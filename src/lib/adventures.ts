import type { AdventurePlan } from "@/types/adventure";

const STORAGE_KEY = "expeditionos.adventures.v1";
const MAX_ADVENTURES = 12;

export function createAdventureId() {
  return `adventure-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadAdventures(): AdventurePlan[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as AdventurePlan[];
    return Array.isArray(value) ? value.filter((item) => item?.route?.points?.length >= 2) : [];
  } catch {
    return [];
  }
}

export function saveAdventure(adventure: AdventurePlan) {
  const current = loadAdventures().filter((item) => item.id !== adventure.id);
  const next = [adventure, ...current].slice(0, MAX_ADVENTURES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteAdventure(id: string) {
  const next = loadAdventures().filter((item) => item.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
