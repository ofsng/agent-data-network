// Minimal HTTP client for the local /api/v1 (used by tests and external scripts).
// The deterministic agent itself runs in-process through src/agent/tools.ts.
export class Api {
  constructor(private base: string, private headers: Record<string, string> = {}) {}
  async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
    const r = await fetch(`${this.base}${path.startsWith("/demo") ? "/api" : "/api/v1"}${path}`, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...this.headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: await r.json() };
  }
  async ok(method: string, path: string, body?: unknown) {
    const r = await this.call(method, path, body);
    if (r.status !== 200) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r.json)}`);
    return r.json;
  }
}
