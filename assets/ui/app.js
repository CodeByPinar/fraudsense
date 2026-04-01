const liveStatus = document.querySelector("#live-status");
const readyStatus = document.querySelector("#ready-status");
const dbStatus = document.querySelector("#db-status");
const redisStatus = document.querySelector("#redis-status");
const refreshButton = document.querySelector("#refresh-status");
const autoRefreshToggle = document.querySelector("#auto-refresh");
const liveRtt = document.querySelector("#live-rtt");
const readyRtt = document.querySelector("#ready-rtt");
const lastUpdated = document.querySelector("#last-updated");
const sparkline = document.querySelector("#health-sparkline");
const apiBaseInput = document.querySelector("#api-base-input");
const saveApiBaseButton = document.querySelector("#save-api-base");
const apiBaseCurrent = document.querySelector("#api-base-current");
const riskRange = document.querySelector("#risk-range");
const simScore = document.querySelector("#sim-score");
const simDecision = document.querySelector("#sim-decision");
const riskBarFill = document.querySelector("#risk-bar-fill");
const copyFeedback = document.querySelector("#copy-feedback");
const kpiReadiness = document.querySelector("#kpi-readiness");
const kpiDb = document.querySelector("#kpi-db");
const kpiRedis = document.querySelector("#kpi-redis");
const eventLog = document.querySelector("#event-log");
const nodeDescription = document.querySelector("#node-description");
const topologyNodes = document.querySelectorAll(".node");
const feedbackForm = document.querySelector("#feedback-form");
const feedbackAlert = document.querySelector("#feedback-alert");
const feedbackMeta = document.querySelector("#feedback-meta");
const feedbackSubmit = document.querySelector("#fb-submit");

const history = [];
let refreshInterval = null;

const topologyDescriptions = {
  api: "API katmanı tüm istekleri alır, doğrular ve domain servislerine iletir.",
  auth: "Auth katmanı JWT, RBAC ve API key HMAC kontrolleri ile erişim güvenliğini sağlar.",
  rules: "Rule Engine, transaction sinyallerini ağırlıklandırıp risk skoruna dönüştürür.",
  postgres: "PostgreSQL transaction kayıtları, refresh tokenlar ve audit verisi için kalıcı katmandır.",
  redis: "Redis nonce replay koruması, hız penceresi ve kısa ömürlü operasyonel state tutar."
};

function normalizeBase(base) {
  const trimmed = (base ?? "").trim();
  if (trimmed.length === 0) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return "";
  }
}

function inferDefaultBase() {
  const hasLivePreviewInjection = Boolean(
    document.querySelector('script[src*="___vscode_livepreview_injected_script"]')
  );

  if (hasLivePreviewInjection) {
    return `${window.location.protocol}//${window.location.hostname}:3002`;
  }

  const params = new URLSearchParams(window.location.search);
  const queryBase = normalizeBase(params.get("apiBase"));
  if (queryBase.length > 0) {
    return queryBase;
  }

  const savedBase = normalizeBase(window.localStorage.getItem("fraudsenseApiBase"));
  if (savedBase.length > 0) {
    return savedBase;
  }

  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal && window.location.port && window.location.port !== "3002") {
    return `${window.location.protocol}//${host}:3002`;
  }

  return "";
}

let apiBase = inferDefaultBase();

function maybeEscapeLivePreview() {
  const hasLivePreviewInjection = Boolean(
    document.querySelector('script[src*="___vscode_livepreview_injected_script"]')
  );
  if (!hasLivePreviewInjection) {
    return;
  }

  if (!apiBase) {
    return;
  }

  if (window.location.origin === apiBase) {
    return;
  }

  const target = `${apiBase}/?from=live-preview`;
  window.location.replace(target);
}

function buildApiUrl(path) {
  if (apiBase.length === 0) {
    return path;
  }
  return `${apiBase}${path}`;
}

function updateApiBaseView() {
  if (apiBaseInput) {
    apiBaseInput.value = apiBase;
  }
  if (apiBaseCurrent) {
    apiBaseCurrent.textContent = `Aktif hedef: ${apiBase.length > 0 ? apiBase : "aynı origin"}`;
  }
}

function setFeedbackNotice(type, message, metaText) {
  if (feedbackAlert) {
    feedbackAlert.textContent = message;
    feedbackAlert.classList.remove("success", "error", "info");
    feedbackAlert.classList.add(type);
  }

  if (feedbackMeta) {
    feedbackMeta.textContent = metaText;
  }
}

function appendEvent(message, severity = "info") {
  if (!eventLog) {
    return;
  }

  const item = document.createElement("li");
  item.style.borderColor =
    severity === "ok"
      ? "rgba(39, 207, 136, 0.45)"
      : severity === "error"
        ? "rgba(238, 90, 82, 0.45)"
        : "rgba(93, 216, 255, 0.38)";

  const stamp = document.createElement("time");
  stamp.textContent = new Date().toLocaleTimeString("tr-TR");
  item.append(stamp, document.createTextNode(message));

  eventLog.prepend(item);
  const entries = eventLog.querySelectorAll("li");
  if (entries.length > 12) {
    entries[entries.length - 1].remove();
  }
}

function setPillState(element, text, state) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.remove("ok", "bad", "waiting");
  element.classList.add(state);
}

function setChip(element, text, state) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.style.borderColor =
    state === "ok"
      ? "rgba(39, 207, 136, 0.55)"
      : state === "bad"
        ? "rgba(238, 90, 82, 0.55)"
        : "rgba(224, 165, 67, 0.55)";
}

async function fetchHealth(url) {
  const start = performance.now();
  const response = await fetch(buildApiUrl(url), {
    headers: {
      Accept: "application/json"
    }
  });

  const elapsedMs = Math.round(performance.now() - start);

  return {
    ok: response.ok,
    status: response.status,
    body: await response.json(),
    elapsedMs
  };
}

function pushHistory(isHealthy) {
  history.push(isHealthy ? 1 : 0.35);
  if (history.length > 24) {
    history.shift();
  }

  if (!sparkline) {
    return;
  }

  sparkline.innerHTML = "";
  for (const point of history) {
    const bar = document.createElement("span");
    bar.style.height = `${Math.max(10, Math.round(point * 34))}px`;
    if (point < 0.6) {
      bar.style.background = "linear-gradient(180deg, #ee5a52, rgba(238, 90, 82, 0.18))";
    }
    sparkline.append(bar);
  }
}

function updateSimulator(rawValue) {
  const score = Number(rawValue);
  if (Number.isNaN(score)) {
    return;
  }

  if (simScore) {
    simScore.textContent = String(score);
  }

  let decision = "Approve";
  let tone = "#36dd9c";

  if (score >= 35 && score < 70) {
    decision = "Manual Review";
    tone = "#ffd166";
  } else if (score >= 70) {
    decision = "Block";
    tone = "#f65d57";
  }

  if (simDecision) {
    simDecision.textContent = decision;
    simDecision.style.color = tone;
  }

  if (riskBarFill) {
    riskBarFill.style.width = `${score}%`;
  }
}

async function copyCommand(command) {
  try {
    await navigator.clipboard.writeText(command);
    if (copyFeedback) {
      copyFeedback.textContent = "Komut kopyalandı";
    }
  } catch {
    if (copyFeedback) {
      copyFeedback.textContent = "Kopyalama başarısız, manuel seçim yapın";
    }
  }
}

function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(() => {
    void refreshStatus();
  }, 15000);
}

function stopAutoRefresh() {
  if (!refreshInterval) {
    return;
  }

  clearInterval(refreshInterval);
  refreshInterval = null;
}

async function refreshStatus() {
  setPillState(liveStatus, "Kontrol ediliyor", "waiting");
  setPillState(readyStatus, "Kontrol ediliyor", "waiting");
  setPillState(dbStatus, "Bekleniyor", "waiting");
  setPillState(redisStatus, "Bekleniyor", "waiting");

  try {
    let [live, ready] = await Promise.all([fetchHealth("/health/live"), fetchHealth("/health/ready")]);

    const looksLikeWrongOrigin = [401, 404, 426].includes(live.status) || [401, 404, 426].includes(ready.status);
    if (looksLikeWrongOrigin && apiBase.length === 0) {
      apiBase = `${window.location.protocol}//${window.location.hostname}:3002`;
      updateApiBaseView();
      [live, ready] = await Promise.all([fetchHealth("/health/live"), fetchHealth("/health/ready")]);
    }

    setPillState(liveStatus, live.ok ? "Çalışıyor" : `Hata (${live.status})`, live.ok ? "ok" : "bad");

    setPillState(
      readyStatus,
      ready.ok ? "Hazır" : `Hazır değil (${ready.status})`,
      ready.ok ? "ok" : "bad"
    );

    const dbReady = Boolean(ready.body?.checks?.database);
    const redisReady = Boolean(ready.body?.checks?.redis);

    setPillState(dbStatus, dbReady ? "Bağlı" : "Bağlı değil", dbReady ? "ok" : "bad");
    setPillState(redisStatus, redisReady ? "Bağlı" : "Bağlı değil", redisReady ? "ok" : "bad");

    if (liveRtt) {
      liveRtt.textContent = `${live.elapsedMs} ms`;
    }

    if (readyRtt) {
      readyRtt.textContent = `${ready.elapsedMs} ms`;
    }

    if (lastUpdated) {
      lastUpdated.textContent = new Date().toLocaleTimeString("tr-TR");
    }

    setChip(kpiReadiness, ready.ok ? "Readiness: Hazır" : "Readiness: Sorun", ready.ok ? "ok" : "bad");
    setChip(kpiDb, dbReady ? "DB: Hazır" : "DB: Sorun", dbReady ? "ok" : "bad");
    setChip(kpiRedis, redisReady ? "Redis: Hazır" : "Redis: Sorun", redisReady ? "ok" : "bad");

    pushHistory(Boolean(live.ok && ready.ok));
    appendEvent(
      `Health taraması tamamlandı (live:${live.status} ready:${ready.status} db:${dbReady ? "ok" : "down"} redis:${redisReady ? "ok" : "down"})`,
      live.ok && ready.ok ? "ok" : "error"
    );
  } catch {
    setPillState(liveStatus, "Erişilemiyor", "bad");
    setPillState(readyStatus, "Erişilemiyor", "bad");
    setPillState(dbStatus, "Bilinmiyor", "bad");
    setPillState(redisStatus, "Bilinmiyor", "bad");
    if (liveRtt) {
      liveRtt.textContent = "- ms";
    }
    if (readyRtt) {
      readyRtt.textContent = "- ms";
    }
    if (lastUpdated) {
      lastUpdated.textContent = new Date().toLocaleTimeString("tr-TR");
    }
    setChip(kpiReadiness, "Readiness: Erişilemedi", "bad");
    setChip(kpiDb, "DB: Bilinmiyor", "bad");
    setChip(kpiRedis, "Redis: Bilinmiyor", "bad");
    pushHistory(false);
    appendEvent("Health taraması bağlantı hatası ile sonlandı", "error");
  }
}

refreshButton?.addEventListener("click", () => {
  void refreshStatus();
});

saveApiBaseButton?.addEventListener("click", () => {
  const nextBase = normalizeBase(apiBaseInput instanceof HTMLInputElement ? apiBaseInput.value : "");
  apiBase = nextBase;
  window.localStorage.setItem("fraudsenseApiBase", nextBase);
  updateApiBaseView();
  void refreshStatus();
});

apiBaseInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  saveApiBaseButton?.click();
});

autoRefreshToggle?.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.checked) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

riskRange?.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  updateSimulator(target.value);
});

document.querySelectorAll(".api-item").forEach((item) => {
  item.addEventListener("click", () => {
    const command = item.getAttribute("data-copy");
    if (!command) {
      return;
    }
    void copyCommand(command);
  });
});

feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(feedbackForm instanceof HTMLFormElement)) {
    return;
  }

  const formData = new FormData(feedbackForm);
  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    category: String(formData.get("category") ?? "improvement"),
    message: String(formData.get("message") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    pageUrl: window.location.href
  };

  if (payload.name.length < 2 || payload.message.length < 10 || payload.email.length < 5) {
    setFeedbackNotice(
      "error",
      "Lütfen zorunlu alanları doğru biçimde doldurun.",
      "Ad, e-posta ve mesaj alanları minimum kriterleri sağlamalıdır."
    );
    return;
  }

  if (feedbackSubmit instanceof HTMLButtonElement) {
    feedbackSubmit.disabled = true;
  }

  setFeedbackNotice("info", "Geri bildiriminiz güvenli şekilde gönderiliyor...", "GitHub entegrasyonu çalıştırılıyor.");

  try {
    const response = await fetch(buildApiUrl("/api/v1/feedback"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof body?.title === "string" ? body.title : "Geri bildirim gönderilemedi.";
      setFeedbackNotice("error", message, "Lütfen daha sonra tekrar deneyin veya sistem yöneticisine bildirin.");
      appendEvent(`Feedback gönderimi başarısız (${response.status})`, "error");
      return;
    }

    const issueUrl = typeof body?.issueUrl === "string" ? body.issueUrl : "";
    setFeedbackNotice(
      "success",
      "Teşekkürler, geri bildiriminiz GitHub Issue olarak kaydedildi.",
      issueUrl.length > 0 ? `Issue bağlantısı: ${issueUrl}` : "Issue bağlantısı oluşturuldu."
    );
    appendEvent("Feedback başarıyla GitHub Issue olarak kaydedildi", "ok");
    feedbackForm.reset();
  } catch {
    setFeedbackNotice(
      "error",
      "Bağlantı hatası nedeniyle geri bildirim iletilemedi.",
      "API hedefini kontrol edin ve tekrar deneyin."
    );
    appendEvent("Feedback gönderimi bağlantı hatası ile sonlandı", "error");
  } finally {
    if (feedbackSubmit instanceof HTMLButtonElement) {
      feedbackSubmit.disabled = false;
    }
  }
});

topologyNodes.forEach((node) => {
  node.addEventListener("click", () => {
    topologyNodes.forEach((it) => it.classList.remove("active"));
    node.classList.add("active");
    const key = node.getAttribute("data-node");
    if (!key || !nodeDescription) {
      return;
    }
    nodeDescription.textContent = topologyDescriptions[key] ?? topologyDescriptions.api;
  });
});

updateApiBaseView();
maybeEscapeLivePreview();
updateSimulator(riskRange instanceof HTMLInputElement ? riskRange.value : "32");
appendEvent("Panel başlatıldı ve izleme aktif", "info");
startAutoRefresh();
void refreshStatus();
