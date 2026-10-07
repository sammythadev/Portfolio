import { launch, installVideoRecorder, sleep } from "./lib.mjs";
const b = await launch();
const p = await b.newPage();
await p.setViewport({width:1440,height:900});
await installVideoRecorder(p);
const errs=[]; p.on("console",m=>errs.push(m.type()+":"+m.text().slice(0,160))); p.on("pageerror",e=>errs.push("pageerror:"+e));
await p.goto("http://localhost:3000/",{waitUntil:"domcontentloaded",timeout:120000});
await sleep(9000);
console.log(JSON.stringify(await p.evaluate(()=>({
  href:location.href, title:document.title, bodyLen:document.body?.innerText.length,
  videos:document.querySelectorAll("video").length,
  media:!!window.__media, evs:(window.__media?.events||[]).length,
  h1:document.querySelector("h1")?.textContent?.slice(0,60),
})),null,1));
console.log(errs.slice(0,10));
await b.close();
