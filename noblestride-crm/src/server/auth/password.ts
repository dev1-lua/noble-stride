// argon2id hashing (OWASP baseline params: 19 MiB memory, t=2, p=1).
// DUMMY_HASH is verified against when the email has no account, so login
// timing does not reveal whether an address exists.

import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTS);
}

export async function verifyPassword(hashStr: string, password: string): Promise<boolean> {
  try {
    return await verify(hashStr, password, ARGON2_OPTS);
  } catch {
    return false; // malformed/legacy hash → never throws into callers
  }
}

// Pre-computed hash of an unguessable random value (regenerating per boot is
// fine too, but a constant keeps cold-start cheap). Matches no real password.
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$1l1nDDGqxwQrmzXSRs4t1Q$1EkMJbxLvcfMmArodyMTASW1bgIHNIyLCj523fyF8Zk";
