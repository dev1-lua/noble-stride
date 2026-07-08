// Password policy (real-auth spec §6): length ≥ 10, not a top-common password,
// must not contain the email local-part. Returns a user-safe error or null.

const COMMON_PASSWORDS = new Set([
  "password12", "password123", "1234567890", "qwertyuiop", "1q2w3e4r5t",
  "iloveyou12", "admin12345", "welcome123", "letmein123", "monkey12345",
  "dragon12345", "sunshine123", "princess123", "football123", "baseball123",
  "trustno1234", "superman123", "noblestride", "noblestride1", "noblestride123",
]);

export function validatePassword(password: string, email?: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common — pick something less guessable.";
  if (email) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
      return "Password must not contain your email name.";
    }
  }
  return null;
}
