import { Router } from "express";
import { verifyFirebaseToken } from "../config/firebase.js";

export const apiRoutes = Router();

const jobPostingUrl = process.env.JOB_POSTING_SERVICE_URL || "http://localhost:3004";
const cities = [
  "istanbul",
  "izmir",
  "ankara",
  "bursa",
  "antalya",
  "eskisehir",
  "eskişehir",
  "konya",
  "adana",
  "kocaeli",
  "kayseri",
  "samsun"
];
const positionKeywords = [
  { words: ["ios", "iphone", "swift"], value: "ios" },
  { words: ["android", "kotlin"], value: "android" },
  { words: ["mobile", "mobil"], value: "mobile" },
  { words: ["frontend", "front end"], value: "frontend" },
  { words: ["backend", "back end"], value: "backend" },
  { words: ["full stack", "fullstack"], value: "full stack" },
  { words: ["developer", "gelistirici", "geliştirici", "yazilimci", "yazılımcı"], value: "developer" },
  { words: ["web"], value: "web" }
];

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function parseMessage(message) {
  const text = normalize(message);
  const city = cities.find((item) => text.includes(item));
  const positionMatch = positionKeywords.find((item) => item.words.some((word) => text.includes(word)));

  return {
    city: city ? city.charAt(0).toLocaleUpperCase("tr-TR") + city.slice(1) : "",
    position: positionMatch?.value || ""
  };
}

function hasDetailIntent(message) {
  const text = normalize(message);
  return ["detay", "open details", "aç", "ac", "göster", "goster"].some((word) => text.includes(word));
}

function hasApplyIntent(message) {
  const text = normalize(message);
  return ["başvur", "basvur", "apply"].some((word) => text.includes(word));
}

function pickContextJob(message, contextJobs = []) {
  const text = normalize(message);

  if (!Array.isArray(contextJobs) || contextJobs.length === 0) {
    return null;
  }

  return (
    contextJobs.find((job) => text.includes(normalize(job.title)) || text.includes(normalize(job.companyName))) ||
    contextJobs.find((job) => normalize(job.title).split(/\s+/).some((word) => word.length > 3 && text.includes(word))) ||
    contextJobs[0]
  );
}

async function findJobs({ position, city }) {
  const params = new URLSearchParams({ page: "1", limit: "5" });

  if (position) {
    params.set("position", position);
  }

  if (city) {
    params.set("city", city);
  }

  const response = await fetch(`${jobPostingUrl}/api/v1/jobs?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Job search request failed.");
  }

  const data = await response.json();
  return (data.items || []).slice(0, 5).map((job) => ({
    id: job._id,
    title: job.title,
    companyName: job.companyName,
    city: job.city,
    country: job.country,
    workType: job.workType
  }));
}

apiRoutes.get("/health", (req, res) => {
  res.json({ service: "agent-service", status: "ok" });
});

apiRoutes.post("/agent/message", async (req, res) => {
  const message = req.body.message || "";
  const contextJobs = req.body.contextJobs || [];

  if (hasApplyIntent(message)) {
    const job = pickContextJob(message, contextJobs);

    if (job?.id) {
      return res.json({
        reply: `${job.title} ilanı için başvuru sayfasını açıyorum.`,
        jobs: [],
        actions: [{ type: "applyToJob", jobId: job.id }]
      });
    }

    return res.json({
      reply: "Başvurmak istediğin ilanı seçebilmem için önce bir arama yapalım.",
      jobs: [],
      actions: []
    });
  }

  if (hasDetailIntent(message)) {
    const job = pickContextJob(message, contextJobs);

    if (job?.id) {
      return res.json({
        reply: `${job.title} ilanının detayını açıyorum.`,
        jobs: [],
        actions: [{ type: "openJobDetail", jobId: job.id }]
      });
    }
  }

  try {
    const filters = parseMessage(message);
    const jobs = await findJobs(filters);

    if (jobs.length === 0) {
      return res.json({
        reply: "Bu aramayla eşleşen ilan bulamadım. Farklı bir şehir veya pozisyon deneyebilirsin.",
        jobs: [],
        actions: []
      });
    }

    return res.json({
      reply: "Sana uygun olabilecek birkaç ilan buldum. İstersen birinin detayını açabilir veya başvuruya geçebilirsin.",
      jobs,
      actions: []
    });
  } catch {
    return res.status(503).json({
      reply: "İlanlara şu anda ulaşamıyorum. Lütfen biraz sonra tekrar dene.",
      jobs: [],
      actions: []
    });
  }
});

apiRoutes.post("/agent/jobs", verifyFirebaseToken, (req, res) => {
  res.status(202).json({ status: "queued" });
});
