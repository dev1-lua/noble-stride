import { describe, it, expect, afterEach } from "vitest";
import { getStorageProvider, sharePointConfigured, StorageError } from "../provider";
import { LocalDiskProvider } from "../local";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

describe("getStorageProvider", () => {
  it("returns LocalDiskProvider by default", () => {
    delete process.env.STORAGE_PROVIDER;
    expect(getStorageProvider()).toBeInstanceOf(LocalDiskProvider);
  });
  it("returns LocalDiskProvider when STORAGE_PROVIDER=sharepoint but creds missing", () => {
    process.env.STORAGE_PROVIDER = "sharepoint";
    delete process.env.SHAREPOINT_TENANT_ID;
    expect(sharePointConfigured()).toBe(false);
    expect(getStorageProvider()).toBeInstanceOf(LocalDiskProvider);
  });
});

describe("StorageError", () => {
  it("carries an http status", () => {
    expect(new StorageError("x", 502).status).toBe(502);
    expect(new StorageError("y").status).toBe(502);
  });
});
