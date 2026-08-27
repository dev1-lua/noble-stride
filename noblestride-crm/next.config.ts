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
    // NOTE: the staff upload route (src/app/api/documents/upload/route.ts) still
    // advertises the shared 50 MB MAX_FILE_BYTES, which this does not make true —
    // anything over 16 MB will still fail there. Flagged for the branch review.
    proxyClientMaxBodySize: 16 * 1024 * 1024,
  },
};

export default nextConfig;
