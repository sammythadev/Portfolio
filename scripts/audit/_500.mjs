import { launch } from "./lib.mjs";
const b = await launch();
const p = await b.newPage();
p.on("response", r => { if (r.status() >= 400) console.log(r.status(), r.url()); });
await p.goto("http://localhost:3100/", { waitUntil: "load", timeout: 60000 });
await new Promise(r=>setTimeout(r,3000));
await b.close();
