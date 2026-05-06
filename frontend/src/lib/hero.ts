import { Hero } from "@/lib/types";

const HERO_SLUG_OVERRIDES: Record<string, string> = {
  "Anti-Mage": "antimage",
  "Clockwerk": "rattletrap",
  "Doom": "doom_bringer",
  "Io": "wisp",
  "Lifestealer": "life_stealer",
  "Magnus": "magnataur",
  "Nature's Prophet": "furion",
  "Necrophos": "necrolyte",
  "Outworld Destroyer": "obsidian_destroyer",
  "Queen of Pain": "queenofpain",
  "Shadow Fiend": "nevermore",
  "Timbersaw": "shredder",
  "Treant Protector": "treant",
  "Underlord": "abyssal_underlord",
  "Vengeful Spirit": "vengefulspirit",
  "Windranger": "windrunner",
  "Wraith King": "skeleton_king",
  "Zeus": "zuus",
};

const normalizeLocalizedSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const createHeroImageResolver = (heroes: Hero[]) => {
  const slugById = new Map<string, string>();

  heroes.forEach((hero) => {
    const rawName = hero.name?.trim();
    let slug = "";

    if (rawName) {
      if (rawName.startsWith("npc_dota_hero_")) {
        slug = rawName.replace("npc_dota_hero_", "");
      } else if (rawName.includes("_") && !rawName.includes(" ")) {
        slug = rawName;
      } else if (!rawName.includes(" ")) {
        slug = rawName.toLowerCase();
      }
    }

    if (!slug) {
      const override = HERO_SLUG_OVERRIDES[hero.localizedName];
      if (override) {
        slug = override;
      }
    }

    if (!slug) {
      slug = normalizeLocalizedSlug(hero.localizedName);
    }

    if (slug) {
      slugById.set(hero.id, slug);
    }
  });

  return (heroId?: string | null) => {
    if (!heroId) {
      return null;
    }
    const slug = slugById.get(heroId);
    if (!slug) {
      return null;
    }
    return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/${slug}_sb.png`;
  };
};
