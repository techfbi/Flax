/*
  IndexNow key file (Bing, Yandex, Seznam, Naver). Lets `npm run indexnow`
  tell those engines immediately when pages change instead of waiting
  for a crawl. Serves INDEXNOW_KEY as plain text, 404 when it is unset.
*/
export const dynamic = "force-static";

export const GET = (): Response => {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
