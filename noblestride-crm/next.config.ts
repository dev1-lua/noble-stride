import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads are read with request.formData() in route handlers. Next truncates
    // the request body at 10 MB by default and then FAILS to parse the truncated
    // multipart payload, which surfaces as an opaque 500 rather than "your file
    // is too large". The applicant tracker advertises a 15 MB limit (see
    // src/app/apply/status/upload/route.ts), so the platform ceiling is raised
    // just past it and each route still enforces its own real limit.
    //
    // Must stay equal to MAX_FILE_BYTES in src/server/storage/validation.ts.
    // Past this ceiling Next truncates the request body and the multipart parse
    // throws, so a mismatch shows up as an opaque 500 rather than a size error.
    proxyClientMaxBodySize: 16 * 1024 * 1024,
  },
};

export default nextConfig;
