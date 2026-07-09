import { createReadStream } from "node:fs";
import { mkdir, writeFile, stat, readFile, rm } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { StorageProvider, StoredObject } from "./provider";
import { StorageError } from "./provider";

export class LocalDiskProvider implements StorageProvider {
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }

  private resolveKey(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new StorageError(`Invalid storage key: ${key}`, 400);
    }
    return full;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const full = this.resolveKey(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
    await writeFile(full + ".meta", contentType, "utf8");
  }

  async get(key: string): Promise<StoredObject> {
    const full = this.resolveKey(key);
    let size: number;
    try {
      size = (await stat(full)).size;
    } catch {
      throw new StorageError(`Object not found: ${key}`, 410);
    }
    let contentType = "application/octet-stream";
    try {
      contentType = (await readFile(full + ".meta", "utf8")).trim() || contentType;
    } catch {
      /* meta optional */
    }
    return { stream: createReadStream(full), contentType, size };
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveKey(key);
    await rm(full, { force: true });
    await rm(full + ".meta", { force: true });
  }
}
