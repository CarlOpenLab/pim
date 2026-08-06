import { copyFile, mkdir, open, readFile, rename, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { parse, type ParseError, printParseErrorCode } from "jsonc-parser";
import type { ConfigDocument, Diagnostic, SaveResult } from "./types.js";

function formatParseError(error: ParseError): string {
  return `${printParseErrorCode(error.error)} at offset ${error.offset}`;
}

export async function readJsonDocument<T>(
  path: string,
  fallback: T,
  validate?: (value: unknown) => T,
): Promise<ConfigDocument<T>> {
  let content: string;
  let fileStat: Awaited<ReturnType<typeof stat>>;

  try {
    [content, fileStat] = await Promise.all([readFile(path, "utf8"), stat(path)]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { path, exists: false, data: fallback, diagnostics: [], modifiedAt: null };
    }
    throw error;
  }

  const parseErrors: ParseError[] = [];
  const parsed: unknown = parse(content, parseErrors, { allowTrailingComma: true });
  const diagnostics: Diagnostic[] = parseErrors.map((error) => ({
    level: "error",
    file: path,
    message: formatParseError(error),
  }));

  if (parseErrors.length > 0) {
    return {
      path,
      exists: true,
      data: fallback,
      diagnostics,
      modifiedAt: fileStat.mtime.toISOString(),
    };
  }

  try {
    const data = validate ? validate(parsed) : (parsed as T);
    return { path, exists: true, data, diagnostics, modifiedAt: fileStat.mtime.toISOString() };
  } catch (error) {
    diagnostics.push({
      level: "error",
      file: path,
      message: error instanceof Error ? error.message : "Configuration schema validation failed",
    });
    return {
      path,
      exists: true,
      data: fallback,
      diagnostics,
      modifiedAt: fileStat.mtime.toISOString(),
    };
  }
}

function backupName(path: string): string {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return join(dirname(path), ".pim", "backups", `${basename(path)}.${timestamp}.bak`);
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<SaveResult> {
  await mkdir(dirname(path), { recursive: true });

  let backupPath: string | null = null;
  try {
    await stat(path);
    backupPath = backupName(path);
    await mkdir(dirname(backupPath), { recursive: true });
    await copyFile(path, backupPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const temporaryPath = `${path}.${process.pid}.tmp`;
  const handle = await open(temporaryPath, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, path);

  return { path, backupPath, savedAt: new Date().toISOString() };
}
