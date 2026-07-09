import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDiskProvider } from "../local";
import { StorageError } from "../provider";

async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

const dirs: string[] = [];
async function freshRoot() {
  const d = await mkdtemp(join(tmpdir(), "nsstore-"));
  dirs.push(d);
  return d;
}
afterAll(async () => { for (const d of dirs) await rm(d, { recursive: true, force: true }); });

describe("LocalDiskProvider", () => {
  it("round-trips bytes and content type", async () => {
    const p = new LocalDiskProvider(await freshRoot());
    const bytes = Buffer.from("hello pdf");
    await p.put("a/b/c/v1-x.pdf", bytes, "application/pdf");
    const got = await p.get("a/b/c/v1-x.pdf");
    expect(got.contentType).toBe("application/pdf");
    expect(got.size).toBe(bytes.length);
    expect((await collect(got.stream)).equals(bytes)).toBe(true);
  });

  it("delete removes the object", async () => {
    const p = new LocalDiskProvider(await freshRoot());
    await p.put("k/v1-x.pdf", Buffer.from("z"), "application/pdf");
    await p.delete("k/v1-x.pdf");
    await expect(p.get("k/v1-x.pdf")).rejects.toBeInstanceOf(StorageError);
  });

  it("get on a missing key throws StorageError(410)", async () => {
    const p = new LocalDiskProvider(await freshRoot());
    await expect(p.get("nope")).rejects.toMatchObject({ status: 410 });
  });

  it("rejects a key that escapes the root", async () => {
    const p = new LocalDiskProvider(await freshRoot());
    await expect(p.put("../escape.pdf", Buffer.from("z"), "application/pdf")).rejects.toBeInstanceOf(StorageError);
  });
});
