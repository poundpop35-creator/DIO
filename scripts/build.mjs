import { readFile, writeFile } from "node:fs/promises";
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const [html, css, domain, demo, app, fonts] = await Promise.all(
  [
    "web/index.html",
    "web/styles.css",
    "web/domain.js",
    "web/demo.js",
    "web/app.js",
    "web/fonts.css",
  ].map(read),
);
const script = [domain, demo, app]
  .map((s) =>
    s
      .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, "")
      .replace(/^export /gm, ""),
  )
  .join("\n");
const built = html
  .replace("<!-- STYLES -->", () => "<style>" + fonts + css + "</style>")
  .replace(
    "<!-- APP -->",
    () => "<script>" + script.replace(/<\/script/gi, "<\\/script") + "</script>",
  );
await writeFile(new URL("../index.html", import.meta.url), built);
await writeFile(new URL("../apps-script/Index.html", import.meta.url), built);
console.log("Built standalone preview and Apps Script Index.html");
