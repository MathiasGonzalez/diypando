import { getCatalog } from "./catalog.js";
import { runDesign } from "./design.js";
import { chatDesign } from "./ai.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type debe ser application/json");
  }
  return request.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/catalog") {
        return json(getCatalog());
      }

      if (request.method === "POST" && url.pathname === "/api/design") {
        const body = await readJson(request);
        return json(runDesign(body.spec || body));
      }

      if (request.method === "POST" && url.pathname === "/api/chat") {
        const body = await readJson(request);
        const result = await chatDesign(env, body);
        return json(result);
      }

      return json({ error: "No encontrado" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      console.log(JSON.stringify({ level: "error", path: url.pathname, message }));
      return json({ error: message }, 400);
    }
  },
};
