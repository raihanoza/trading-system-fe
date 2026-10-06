import { afterEach } from "vitest";

// RTL hanya membersihkan DOM otomatis bila `afterEach` global tersedia;
// konfigurasi ini tidak memakai globals, jadi dipanggil eksplisit.
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});
