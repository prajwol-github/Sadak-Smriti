/**
 * The 7 provinces by their official number, with current names (the boundary source still uses
 * pre-2022 names like "Province No 1"). Shared by the map build and the places import.
 */
export const PROVINCES: Record<number, { en: string; np: string; slug: string }> = {
  1: { en: "Koshi", np: "कोशी", slug: "koshi" },
  2: { en: "Madhesh", np: "मधेश", slug: "madhesh" },
  3: { en: "Bagmati", np: "बागमती", slug: "bagmati" },
  4: { en: "Gandaki", np: "गण्डकी", slug: "gandaki" },
  5: { en: "Lumbini", np: "लुम्बिनी", slug: "lumbini" },
  6: { en: "Karnali", np: "कर्णाली", slug: "karnali" },
  7: { en: "Sudurpashchim", np: "सुदूरपश्चिम", slug: "sudurpashchim" },
};
