import fs from "fs";
import path from "path";

export function deliverToFile(markdown: string, outputDir: string, preset?: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const date = new Date().toISOString().split("T")[0];

  let filename: string;
  if (preset) {
    // Preset: 2026-03-15-morning.md — always same name, overwritten on re-run
    filename = `${date}-${preset}.md`;
  } else {
    // Custom/ad-hoc: 2026-03-15-1430.md — timestamped, unique per run
    const time = new Date().toTimeString().slice(0, 5).replace(":", "");
    filename = `${date}-${time}.md`;
  }

  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, markdown, "utf-8");

  console.log(`[deliver] Brief written to ${filePath}`);
  return filePath;
}
