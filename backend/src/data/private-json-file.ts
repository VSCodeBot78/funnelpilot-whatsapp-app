import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Single-process crash-resistant JSON file replacement for local workspace.
 *
 * This is NOT: encryption at rest, a database, a transactional multi-process
 * store, a backup, or a substitute for per-coach isolation and retention rules.
 */
export function writePrivateJsonAtomic(destination: string, value: unknown): void {
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temp = path.join(parent, "." + path.basename(destination) + "." +
    process.pid + "." + crypto.randomBytes(8).toString("hex") + ".tmp");
  try {
    // Mode is enforced on POSIX for newly-created temporary files. On Windows,
    // real access restrictions still require NTFS ACLs set by the operator.
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    // Rename is atomic on the same filesystem, replacing the previous file.
    // A failed write cannot truncate the last valid destination on disk.
    fs.renameSync(temp, destination);
  } finally {
    try {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    } catch {
      // Preserve the original persistence error; temporary cleanup is best-effort.
    }
  }
}
