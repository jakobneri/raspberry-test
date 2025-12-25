import { readdirSync, statSync, unlinkSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

const SHARED_FILES_DIR = "shared-files";

export interface FileInfo {
  name: string;
  size: number;
  modified: string;
}

export const listFiles = (): FileInfo[] => {
  try {
    const files = readdirSync(SHARED_FILES_DIR);
    return files.map((filename) => {
      const filePath = join(SHARED_FILES_DIR, filename);
      const stats = statSync(filePath);
      return {
        name: filename,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    });
  } catch (error) {
    console.error("[Files] Error listing files:", error);
    return [];
  }
};

export const deleteFile = (filename: string): boolean => {
  try {
    const filePath = join(SHARED_FILES_DIR, basename(filename));
    unlinkSync(filePath);
    console.log(`[Files] Deleted file: ${filename}`);
    return true;
  } catch (error) {
    console.error(`[Files] Error deleting file ${filename}:`, error);
    return false;
  }
};

export const getFile = (filename: string): Buffer => {
  const filePath = join(SHARED_FILES_DIR, basename(filename));
  return readFileSync(filePath);
};

export const getFilePath = (filename: string): string => {
  return join(SHARED_FILES_DIR, basename(filename));
};
