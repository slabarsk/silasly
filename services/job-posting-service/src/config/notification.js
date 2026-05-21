function getNotificationServiceUrl() {
  return (process.env.NOTIFICATION_SERVICE_URL || "").replace(/\/+$/, "");
}

export async function enqueueNotificationJob(job) {
  const serviceUrl = getNotificationServiceUrl();
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY;

  if (!serviceUrl || !internalServiceKey) {
    return null;
  }

  const data = typeof job.toObject === "function" ? job.toObject() : job;
  const response = await fetch(`${serviceUrl}/api/v1/internal/pending-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-key": internalServiceKey
    },
    body: JSON.stringify({ job: data })
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}
