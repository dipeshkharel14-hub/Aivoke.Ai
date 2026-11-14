import { z } from "zod";
import { containsProfanity } from "./profanity";

// Keep in sync with public.username_ok() in migration 0001.
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "support", "help", "aivoke", "root", "moderator", "mod", "staff", "official",
  "null", "undefined", "api", "settings", "people", "tools", "rewards", "leaderboard", "go", "u", "login", "signup",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Use 3 to 20 lowercase letters, numbers or underscores")
  .refine((u) => !RESERVED_USERNAMES.has(u), "That username is not available")
  .refine((u) => !containsProfanity(u), "Please choose a different username");

export const profileSchema = z.object({
  username: usernameSchema,
  display_name: z
    .string().trim().min(1, "Enter a display name").max(50, "Keep it to 50 characters")
    .refine((v) => !containsProfanity(v), "Please choose a different display name"),
  bio: z
    .string().trim().max(280, "Keep it to 280 characters")
    .refine((v) => !containsProfanity(v), "Please rephrase your bio"),
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2})?$/, "Choose a country from the list"),
  links: z
    .array(z.object({ label: z.string().trim().min(1, "Add a label").max(40, "Keep the label to 40 characters"), url: z.string().trim().min(1, "Add a link").max(500) }))
    .max(5, "You can add up to 5 links"),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const privacySchema = z.object({
  is_public: z.boolean(),
  show_on_leaderboard: z.boolean(),
  featured_opt_in: z.boolean(),
});
export const notificationsSchema = z.object({ notify_product: z.boolean(), notify_social: z.boolean() });
