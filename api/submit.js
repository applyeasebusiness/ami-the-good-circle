const ALLOWED_FORMS = new Set(["contact", "volunteer", "membership"]);
const MAX_BODY_BYTES = 12_000;

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.end(JSON.stringify(body));
}

function cleanString(value, max = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, message: "Method not allowed." });
  }

  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.toLowerCase().includes("application/json")) {
    return send(res, 415, { ok: false, message: "Send the form as JSON." });
  }

  let raw = "";
  try {
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
        return send(res, 413, { ok: false, message: "Submission is too large." });
      }
    }
  } catch {
    return send(res, 400, { ok: false, message: "Could not read submission." });
  }

  let body;
  try { body = JSON.parse(raw || "{}"); }
  catch { return send(res, 400, { ok: false, message: "Invalid submission format." }); }

  // Honeypot: silently accept bot submissions without storing them.
  if (cleanString(body.website, 200)) return send(res, 200, { ok: true, message: "Thank you. Your submission has been received." });

  const formType = cleanString(body.formType, 30);
  if (!ALLOWED_FORMS.has(formType)) return send(res, 400, { ok: false, message: "Unknown form type." });
  const p = body.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields : {};
  const name = cleanString(p.name, 120);
  const email = cleanString(p.email, 254).toLowerCase();
  const phone = cleanString(p.phone, 40);
  const consent = p.consent === true || p.consent === "yes" || p.consent === "on";

  if (name.length < 2) return send(res, 400, { ok: false, message: "Please enter your name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { ok: false, message: "Please enter a valid email address." });
  if (!consent) return send(res, 400, { ok: false, message: "Please provide consent before submitting." });

  let fields;
  if (formType === "contact") {
    const subject = cleanString(p.subject, 80);
    const message = cleanString(p.message, 4000);
    if (!subject || message.length < 5) return send(res, 400, { ok: false, message: "Please complete the subject and message." });
    fields = { name, email, subject, message, consent: true };
  } else if (formType === "volunteer") {
    const interest = cleanString(p.interest, 100);
    if (!interest) return send(res, 400, { ok: false, message: "Please select an area of interest." });
    fields = { name, email, phone, interest, consent: true };
  } else {
    const location = cleanString(p.location, 160);
    const interest = cleanString(p.interest, 2000);
    if (phone.length < 5 || interest.length < 5) return send(res, 400, { ok: false, message: "Please complete your phone number and contribution details." });
    fields = { name, email, phone, location, interest, consent: true };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return send(res, 503, { ok: false, message: "The form service is not configured yet. Please try again later." });
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/form_submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ form_type: formType, payload: fields })
    });
    if (!response.ok) {
      // Do not expose database/provider details to the public caller.
      console.error("Supabase insert failed with status", response.status);
      return send(res, 502, { ok: false, message: "We could not save your submission. Please try again later." });
    }
    return send(res, 201, { ok: true, message: "Thank you. Your submission has been received." });
  } catch (error) {
    console.error("Submission service request failed", error && error.name ? error.name : "unknown error");
    return send(res, 502, { ok: false, message: "We could not save your submission. Please try again later." });
  }
};
