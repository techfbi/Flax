/*
  Submits every URL in the live sitemap to IndexNow, which shares it with
  Bing, Yandex, Seznam and Naver. Run after a deploy that adds or changes
  public pages:

    INDEXNOW_KEY=<your key> npm run indexnow

  The same INDEXNOW_KEY must be set in the Vercel project, so the key
  file at https://www.useflax.cc/indexnow-key.txt matches.
  Generate a key once with: node -e "console.log(crypto.randomUUID().replace(/-/g,''))"
*/
const SITE = process.env.SITE_URL ?? "https://www.useflax.cc";
const key = process.env.INDEXNOW_KEY;

if (!key) {
  console.error("INDEXNOW_KEY is not set.");
  process.exit(1);
}

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (urlList.length === 0) {
  console.error("No URLs found in the sitemap.");
  process.exit(1);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE).host,
    key,
    keyLocation: `${SITE}/indexnow-key.txt`,
    urlList,
  }),
});

console.log(`IndexNow responded ${res.status} for ${urlList.length} URLs.`);
if (res.status >= 400) process.exit(1);
