import { z } from "zod";

// Source definition
export const SourceSchema = z.object({
  name: z.string(),
  type: z.enum(["rss", "api", "scrape"]),
  url: z.string().url(),
  domain: z.string(),
  auth: z
    .object({
      type: z.enum(["bearer", "api_key", "basic"]),
      env_var: z.string(),
    })
    .optional(),
  filters: z.record(z.string(), z.string()).optional(),
});

export const SourcesConfigSchema = z.object({
  sources: z.array(SourceSchema),
});

// Delivery channel
const FileChannelSchema = z.object({
  type: z.literal("file"),
  path: z.string(),
});

const EmailChannelSchema = z.object({
  type: z.literal("email"),
  smtp_host: z.string(),
  smtp_port: z.number(),
  smtp_user_env: z.string(),
  smtp_pass_env: z.string(),
  from: z.string(),
  to: z.string(),
});

const ResendChannelSchema = z.object({
  type: z.literal("resend"),
  from: z.string(),
  to: z.array(z.string()),
});

const DeliveryChannelSchema = z.discriminatedUnion("type", [
  FileChannelSchema,
  EmailChannelSchema,
  ResendChannelSchema,
]);

// Brief preset definition
const BriefPresetSchema = z.object({
  anchor: z.string(),      // "07:00" — fixed time of day
  since: z.string(),       // name of previous preset to look back to
});

// Settings
export const SettingsSchema = z.object({
  briefs: z.record(z.string(), BriefPresetSchema),
  ai: z.object({
    model: z.string(),
    max_items_per_brief: z.number(),
  }),
  delivery: z.object({
    channels: z.array(DeliveryChannelSchema),
  }),
});

// Persona
export const PersonaSchema = z.object({
  profile: z.object({
    name: z.string().optional(),
    role: z.string(),
    organization_type: z.string().optional(),
    reports_to: z.string().optional(),
    location: z.string().optional(),
    experience_years: z.number().optional(),
    background: z.string(),
  }),
  focus: z.object({
    current: z.array(z.string()),
    standing: z.array(z.string()),
  }),
  reading_lens: z.string().optional(),
  exclusions: z.object({
    topics: z.array(z.string()),
    source_types: z.array(z.string()),
  }),
  preferences: z.object({
    tone: z.string(),
    depth: z.string(),
    format: z.string().optional(),
    max_items: z.number(),
    flag_marketing: z.boolean().optional(),
    variable_count: z.boolean().optional(),
  }),
});

// Inferred types
export type Source = z.infer<typeof SourceSchema>;
export type SourcesConfig = z.infer<typeof SourcesConfigSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type DeliveryChannel = z.infer<typeof DeliveryChannelSchema>;
