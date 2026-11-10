import "server-only";

/** Server-only settings (written by `npm run deploy:local`). Never NEXT_PUBLIC_, so never sent to the browser. */
export function serverEnv() {
  const need = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} is not set. Run: npm run deploy:local`);
    return v;
  };
  return {
    apiUrl: need("API_URL"),
    cognitoRegion: need("COGNITO_REGION"),
    /** Floci locally; unset on AWS (the SDK then uses the real regional endpoint). */
    cognitoEndpoint: process.env.COGNITO_ENDPOINT || undefined,
    userPoolClientId: need("USER_POOL_CLIENT_ID"),
    /** Extra origins allowed to POST to /bff (e.g. a custom domain). Comma-separated. */
    extraOrigins: (process.env.EXTRA_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}
