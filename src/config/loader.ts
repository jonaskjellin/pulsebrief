import fs from "fs";
import path from "path";
import YAML from "yaml";
import {
  SettingsSchema,
  SourcesConfigSchema,
  PersonaSchema,
  type Settings,
  type SourcesConfig,
  type Persona,
} from "./schema";

const CONFIG_DIR = path.resolve(__dirname, "../../config");

function loadYaml<T>(filePath: string, schema: { parse: (data: unknown) => T }): T {
  const fullPath = path.resolve(CONFIG_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Config file not found: ${fullPath}`);
  }
  const raw = fs.readFileSync(fullPath, "utf-8");
  const data = YAML.parse(raw);
  return schema.parse(data);
}

export function loadSettings(): Settings {
  return loadYaml("settings.yaml", SettingsSchema);
}

export function loadSources(): SourcesConfig {
  return loadYaml("sources.yaml", SourcesConfigSchema);
}

export function loadPersona(): Persona {
  return loadYaml("persona.yaml", PersonaSchema);
}

export function loadAllConfig() {
  const settings = loadSettings();
  const sources = loadSources();
  const persona = loadPersona();
  return { settings, sources, persona };
}
