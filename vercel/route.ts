// app/api/analyze/route.ts (Next.js app router). Keeps the Hugging Face token on the server.
// Env vars on Vercel: WOUND_API_URL (e.g. https://<owner>-<space>.hf.space), HF_TOKEN, WOUND_API_KEY
export const runtime = "nodejs";
export const maxDuration = 60; // check the limit for your Vercel plan

const MAX_BYTES = 4 * 1024 * 1024; // Vercel limits request bodies; resize photos in the browser first

export async function POST(req: Request) {
  const form = await req.formData();
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0 || image.size > MAX_BYTES) {
    return Response.json({ error: "image missing or larger than 4 MB" }, { status: 400 });
  }

  const upstream = new FormData();
  for (const key of ["image", "wound_boxes", "ref_box", "ref_cm", "wound_kind"]) {
    const value = form.get(key);
    if (value !== null) upstream.append(key, value);
  }

  const res = await fetch(`${process.env.WOUND_API_URL}/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`, // needed for a private Space
      "x-api-key": process.env.WOUND_API_KEY ?? "",
    },
    body: upstream,
  });

  const data = await res.json().catch(() => ({ error: "bad response from model service" }));
  return Response.json(data, { status: res.status });
}
