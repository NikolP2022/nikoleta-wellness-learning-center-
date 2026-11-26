/**
 * Nikoleta Wellness Learning Center — transcription proxy
 * Deploy as a Cloudflare Worker. Set OPENAI_API_KEY as a Worker secret.
 * Accepts multipart/form-data: file, language=el, seminar_title.
 */
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
function reply(status, body, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "cache-control": "no-store",
    },
  });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "access-control-max-age": "86400",
      }});
    }
    if (request.method !== "POST") return reply(405, { error: "Χρησιμοποίησε POST." }, origin);
    if (!env.OPENAI_API_KEY) return reply(503, { error: "Δεν έχει ρυθμιστεί το μυστικό OPENAI_API_KEY στον διακομιστή." }, origin);
    let incoming;
    try { incoming = await request.formData(); }
    catch { return reply(400, { error: "Δεν διαβάστηκε το αρχείο ήχου." }, origin); }
    const file = incoming.get("file");
    if (!(file instanceof File)) return reply(400, { error: "Λείπει το αρχείο ήχου (file)." }, origin);
    if (!file.size) return reply(400, { error: "Το αρχείο ήχου είναι κενό." }, origin);
    // OpenAI file transcription accepts audio files up to 25 MB.
    if (file.size > 25 * 1024 * 1024) return reply(413, {
      error: "Το αρχείο ξεπερνά τα 25 MB. Χρειάζεται πρώτα συμπίεση ή διαχωρισμός σε μικρότερα αρχεία."
    }, origin);
    const outgoing = new FormData();
    outgoing.append("file", file, file.name || "seminar.webm");
    outgoing.append("model", "gpt-transcribe");
    outgoing.append("response_format", "json");
    outgoing.append("prompt", "Απομαγνητοφώνηση στα ελληνικά. Διατήρησε ονόματα, ορολογία, αριθμούς και τη φυσική σειρά του λόγου. Μην προσθέτεις πληροφορίες.");
    try {
      const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: outgoing,
      });
      const raw = await upstream.text();
      if (!upstream.ok) {
        return reply(upstream.status, { error: "Η υπηρεσία απομαγνητοφώνησης επέστρεψε σφάλμα.", details: raw.slice(0, 1200) }, origin);
      }
      let data;
      try { data = JSON.parse(raw); } catch { return reply(502, { error: "Μη αναμενόμενη απάντηση από την υπηρεσία." }, origin); }
      return reply(200, { text: data.text || "" }, origin);
    } catch (error) {
      return reply(502, { error: "Δεν ήταν δυνατή η σύνδεση με την υπηρεσία απομαγνητοφώνησης." }, origin);
    }
  },
};
