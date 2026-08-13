import type { AdventurePlan } from "@/types/adventure";

const LEGACY_STORAGE_KEY = "expeditionos.adventures.v1";
const STORAGE_KEY_PREFIX = "expeditionos.adventures.v2";
const MAX_ADVENTURES = 12;

function storageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

export function createAdventureId() {
  return `adventure-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadAdventures(userId: string): AdventurePlan[] {
  if (typeof window === "undefined") return [];
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const value = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "[]") as AdventurePlan[];
    return Array.isArray(value) ? value.filter((item) => item?.route?.points?.length >= 2).map((item) => ({ ...item, visibility: item.visibility ?? "private" })) : [];
  } catch {
    return [];
  }
}

export function saveAdventure(adventure: AdventurePlan, userId: string) {
  const current = loadAdventures(userId).filter((item) => item.id !== adventure.id);
  const next = [adventure, ...current].slice(0, MAX_ADVENTURES);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}

export function replaceLocalAdventures(adventures: AdventurePlan[], userId: string) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(adventures.slice(0, MAX_ADVENTURES)));
  return adventures;
}

export function deleteAdventure(id: string, userId: string) {
  const next = loadAdventures(userId).filter((item) => item.id !== id);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}

export function clearAdventureCache(userId: string) {
  window.localStorage.removeItem(storageKey(userId));
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}
