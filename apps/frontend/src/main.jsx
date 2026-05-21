import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { clearSession, getSession, saveSession, sessionEventName } from "./session.js";
import "./styles.css";

function normalizeApiBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

const configuredApiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const apiBaseUrl = configuredApiBaseUrl || "/api/v1";
const firebaseWebApiKey = import.meta.env.VITE_FIREBASE_WEB_API_KEY || "";
const jobLimit = 5;
const filterKeys = ["position", "city", "town", "workType"];
const adminRoles = ["admin", "company"];
const turkeyCities = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Amasya",
  "Ankara",
  "Antalya",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkari",
  "Hatay",
  "Isparta",
  "Mersin",
  "İstanbul",
  "İzmir",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kırklareli",
  "Kırşehir",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Kahramanmaraş",
  "Mardin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Rize",
  "Sakarya",
  "Samsun",
  "Siirt",
  "Sinop",
  "Sivas",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Şanlıurfa",
  "Uşak",
  "Van",
  "Yozgat",
  "Zonguldak",
  "Aksaray",
  "Bayburt",
  "Karaman",
  "Kırıkkale",
  "Batman",
  "Şırnak",
  "Bartın",
  "Ardahan",
  "Iğdır",
  "Yalova",
  "Karabük",
  "Kilis",
  "Osmaniye",
  "Düzce"
];
const workTypeOptions = [
  { value: "Full-time", label: "Tam zamanlı" },
  { value: "Part-time", label: "Yarı zamanlı" },
  { value: "Remote", label: "Uzaktan" },
  { value: "Hybrid", label: "Hibrit" },
  { value: "On-site", label: "Ofisten" }
];
const filterLabels = {
  position: "Pozisyon",
  city: "Şehir",
  town: "İlçe",
  workType: "Çalışma şekli"
};

function translateWorkType(value) {
  return workTypeOptions.find((option) => option.value === value)?.label || value;
}

function formatFilterValue(key, value) {
  return key === "workType" ? translateWorkType(value) : value;
}

function uniqueSuggestions(primaryItems, fallbackItems = []) {
  const seen = new Set();
  const items = [];

  for (const value of [...primaryItems, ...fallbackItems]) {
    if (!value) {
      continue;
    }

    const key = value.toLocaleLowerCase("tr-TR");

    if (!seen.has(key)) {
      seen.add(key);
      items.push(value);
    }
  }

  return items;
}

function getPreferredCity(session) {
  return session.claims?.city || localStorage.getItem("userCity") || "";
}

async function apiGet(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error("Veri yüklenemedi");
  }

  return response.json();
}

async function apiGetWithToken(path, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Veri yüklenemedi");
  }

  return response.json();
}

async function apiPost(path, body, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.message || "İşlem tamamlanamadı");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function apiPut(path, body, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "İşlem tamamlanamadı");
  }

  return response.json();
}

async function apiPatch(path, body, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "İşlem tamamlanamadı");
  }

  return response.json();
}

async function apiDelete(path, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "İşlem tamamlanamadı");
  }

  return response.json();
}

async function notificationGet(path, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Veri yüklenemedi");
  }

  return response.json();
}

async function agentPost(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.reply || "Yanıt alınamadı");
  }

  return data;
}

async function firebaseLogin(email, password) {
  if (!firebaseWebApiKey) {
    throw new Error("Firebase web API anahtarı yapılandırılmamış");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseWebApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || "Giriş başarısız");
  }

  return data;
}

async function firebaseRegister(email, password) {
  if (!firebaseWebApiKey) {
    throw new Error("Firebase web API anahtarı yapılandırılmamış");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseWebApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || "Kayıt başarısız");
  }

  return data;
}

function readFilters(search = window.location.search) {
  const params = new URLSearchParams(search);

  return filterKeys.reduce((values, key) => {
    values[key] = params.get(key) || "";
    return values;
  }, {});
}

function buildJobsPath(filters, page = 1, limit = jobLimit) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });

  for (const key of filterKeys) {
    if (filters[key]) {
      params.set(key, filters[key]);
    }
  }

  return `/jobs?${params.toString()}`;
}

function buildSearchUrl(filters) {
  const params = new URLSearchParams();

  for (const key of filterKeys) {
    if (filters[key]) {
      params.set(key, filters[key]);
    }
  }

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("tr-TR");
}

function hasAnyRole(session, roles) {
  return session.roles?.some((role) => roles.includes(role)) || false;
}

function App() {
  const [session, setSession] = useState(() => getSession());
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [locationState, setLocationState] = useState({
    pathname: window.location.pathname,
    search: window.location.search
  });

  function navigate(url) {
    window.history.pushState(null, "", url);
    setLocationState({
      pathname: window.location.pathname,
      search: window.location.search
    });
  }

  useEffect(() => {
    function handleSessionChange(event) {
      setSession(event.detail || getSession());
    }

    function handleStorageChange(event) {
      if (event.key === "firebaseToken" || event.key === "userId") {
        setSession(getSession());
      }
    }

    function handlePopState() {
      setLocationState({
        pathname: window.location.pathname,
        search: window.location.search
      });
    }

    window.addEventListener(sessionEventName, handleSessionChange);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener(sessionEventName, handleSessionChange);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  async function loadUnreadNotifications(activeSession = session) {
    if (!activeSession.token || !activeSession.userId) {
      setUnreadNotifications(0);
      return;
    }

    try {
      const data = await notificationGet(`/notifications/${activeSession.userId}/unread-count`, activeSession.token);
      setUnreadNotifications(data.count || 0);
    } catch {
      setUnreadNotifications(0);
    }
  }

  function clearUnreadNotifications() {
    setUnreadNotifications(0);
  }

  useEffect(() => {
    loadUnreadNotifications(session);
  }, [session.token, session.userId]);

  let page = <HomePage session={session} navigate={navigate} />;

  if (locationState.pathname === "/search") {
    page = <SearchPage locationSearch={locationState.search} navigate={navigate} />;
  }

  if (locationState.pathname === "/login") {
    page = <LoginPage navigate={navigate} />;
  }

  if (locationState.pathname === "/alerts") {
    page = <AlertsPage session={session} onNotificationsRead={clearUnreadNotifications} navigate={navigate} />;
  }

  if (locationState.pathname === "/admin") {
    page = <AdminPage session={session} navigate={navigate} />;
  }

  if (locationState.pathname.startsWith("/jobs/")) {
    page = <JobDetailPage jobId={locationState.pathname.split("/")[2]} session={session} navigate={navigate} />;
  }

  return (
    <div className="app">
      <Header session={session} unreadNotifications={unreadNotifications} navigate={navigate} />
      {page}
      <ChatWindow session={session} navigate={navigate} />
    </div>
  );
}

function Header({ session, unreadNotifications, navigate }) {
  const isLoggedIn = Boolean(session.token);
  const canManageJobs = hasAnyRole(session, adminRoles);

  function goTo(event, path) {
    event.preventDefault();
    navigate(path);
  }

  function handleLogout() {
    clearSession();
    navigate("/");
  }

  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="/" onClick={(event) => goTo(event, "/")}>
          <span>Silasly</span>
          <small>iş arama platformu</small>
        </a>
        <nav className="nav-links">
          {isLoggedIn && (
            <a className="nav-alert-link" href="/alerts" onClick={(event) => goTo(event, "/alerts")}>
              İş Alarmlarım
              {unreadNotifications > 0 && <span className="notification-dot" aria-label="Yeni bildirim var" />}
            </a>
          )}
          {canManageJobs && (
            <a href="/admin" onClick={(event) => goTo(event, "/admin")}>
              Yönetim
            </a>
          )}
          {!isLoggedIn ? (
            <a className="login-link" href="/login" onClick={(event) => goTo(event, "/login")}>
              Giriş Yap
            </a>
          ) : (
            <button className="link-button" type="button" onClick={handleLogout}>
              Çıkış Yap
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

function HomePage({ session, navigate }) {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [position, setPosition] = useState(initialParams.get("position") || "");
  const [city, setCity] = useState(initialParams.get("city") || getPreferredCity(session));
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [positionSuggestions, setPositionSuggestions] = useState([]);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadJobs(searchValues, allowFallback = false) {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await apiGet(buildJobsPath(searchValues, 1, jobLimit));

      if (allowFallback && searchValues.city && data.items.length < jobLimit) {
        const fallbackData = await apiGet(buildJobsPath({ ...searchValues, city: "" }, 1, jobLimit));
        const jobsById = new Map();

        for (const job of [...data.items, ...fallbackData.items]) {
          jobsById.set(job._id, job);
        }

        const mergedJobs = Array.from(jobsById.values())
          .sort((firstJob, secondJob) => new Date(secondJob.lastUpdatedAt) - new Date(firstJob.lastUpdatedAt))
          .slice(0, jobLimit);

        setJobs(mergedJobs);
        return;
      }

      setJobs(data.items);
    } catch {
      setMessage("İlanlar yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadHistory(activeSession = session) {
    if (!activeSession.token || !activeSession.userId) {
      setHistory([]);
      return;
    }

    try {
      const data = await apiGetWithToken(`/search-history/${activeSession.userId}`, activeSession.token);
      setHistory(data.history);
    } catch {
      setHistory([]);
    }
  }

  async function saveSearch(nextPosition, nextCity) {
    if (!session.token || !session.userId) {
      return;
    }

    try {
      await apiPost(
        "/search-history",
        {
          userId: session.userId,
          position: nextPosition,
          city: nextCity,
          country: "Türkiye"
        },
        session.token
      );
      await loadHistory(session);
    } catch {
      setMessage("Arama kaydedilemedi");
    }
  }

  async function handleSearch(event) {
    event.preventDefault();

    const nextPosition = position.trim();
    const nextCity = city.trim();
    await saveSearch(nextPosition, nextCity);
    navigate(buildSearchUrl({ position: nextPosition, city: nextCity, town: "", workType: "" }));
  }

  async function loadSuggestions(type, value) {
    const search = value.trim();
    const path =
      type === "position"
        ? `/jobs/autocomplete/positions?search=${encodeURIComponent(search)}`
        : `/jobs/autocomplete/cities?search=${encodeURIComponent(search)}`;

    try {
      const data = await apiGet(path);

      if (type === "position") {
        setPositionSuggestions(data.items);
      } else {
        setCitySuggestions(uniqueSuggestions(data.items, turkeyCities));
      }
    } catch {
      if (type === "position") {
        setPositionSuggestions([]);
      } else {
        setCitySuggestions(turkeyCities);
      }
    }
  }

  useEffect(() => {
    const preferredCity = getPreferredCity(session);
    setCity((currentCity) => currentCity || preferredCity);
    loadJobs({ position: "", city: preferredCity, town: "", workType: "" }, Boolean(preferredCity));
  }, [session.userId]);

  useEffect(() => {
    loadHistory(session);
  }, [session.token, session.userId]);

  useEffect(() => {
    const timer = setTimeout(() => loadSuggestions("position", position), 250);
    return () => clearTimeout(timer);
  }, [position]);

  useEffect(() => {
    const timer = setTimeout(() => loadSuggestions("city", city), 250);
    return () => clearTimeout(timer);
  }, [city]);

  return (
    <main className="content">
      <section className="search-area">
        <h1>İş İlanları</h1>
        <form className="search-form" onSubmit={handleSearch}>
          <SearchInputs
            position={position}
            city={city}
            positionSuggestions={positionSuggestions}
            citySuggestions={citySuggestions}
            onPositionChange={setPosition}
            onCityChange={setCity}
          />
          <button type="submit">Ara</button>
        </form>
        {message && <p className="message">{message}</p>}
      </section>

      <section className="layout">
        <aside className="history">
          <h2>Son Aramalarım</h2>
          {history.length > 0 ? (
            <ul>
              {history.map((item) => (
                <li key={item._id}>{[item.position, item.city, item.country].filter(Boolean).join(" / ")}</li>
              ))}
            </ul>
          ) : (
            <p>{session.token ? "Kayıtlı aramanız yok." : "Son aramalarınızı görmek için giriş yapın."}</p>
          )}
        </aside>

        <section className="jobs">
          <div className="section-title">
            <h2>Güncel İlanlar</h2>
            {isLoading && <span>Yükleniyor</span>}
          </div>
          {!isLoading && jobs.length === 0 && <p className="empty">Uygun ilan bulunamadı.</p>}
          <JobList jobs={jobs} navigate={navigate} />
        </section>
      </section>
    </main>
  );
}

function SearchPage({ locationSearch, navigate }) {
  const queryFilters = useMemo(() => readFilters(locationSearch), [locationSearch]);
  const [filters, setFilters] = useState(queryFilters);
  const [draftFilters, setDraftFilters] = useState(queryFilters);
  const [jobs, setJobs] = useState([]);
  const [positionSuggestions, setPositionSuggestions] = useState([]);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [message, setMessage] = useState("");

  async function loadJobs(nextFilters, nextPage = 1, append = false) {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    setMessage("");

    try {
      const data = await apiGet(buildJobsPath(nextFilters, nextPage, jobLimit));
      setJobs((currentJobs) => (append ? [...currentJobs, ...data.items] : data.items));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setMessage("İlanlar yüklenemedi");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  function updateDraft(key, value) {
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value
    }));
  }

  function applyFilters(event) {
    event.preventDefault();
    const nextFilters = cleanFilters(draftFilters);
    navigate(buildSearchUrl(nextFilters));
  }

  function removeFilter(key) {
    const nextFilters = cleanFilters({ ...filters, [key]: "" });
    navigate(buildSearchUrl(nextFilters));
  }

  function clearFilters() {
    navigate("/search");
  }

  function loadMore() {
    loadJobs(filters, page + 1, true);
  }

  async function loadSuggestions(type, value) {
    const search = value.trim();
    const path =
      type === "position"
        ? `/jobs/autocomplete/positions?search=${encodeURIComponent(search)}`
        : `/jobs/autocomplete/cities?search=${encodeURIComponent(search)}`;

    try {
      const data = await apiGet(path);

      if (type === "position") {
        setPositionSuggestions(data.items);
      } else {
        setCitySuggestions(uniqueSuggestions(data.items, turkeyCities));
      }
    } catch {
      if (type === "position") {
        setPositionSuggestions([]);
      } else {
        setCitySuggestions(turkeyCities);
      }
    }
  }

  useEffect(() => {
    const nextFilters = readFilters(locationSearch);
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
    setJobs([]);
    setPage(1);
    loadJobs(nextFilters, 1, false);
  }, [locationSearch]);

  useEffect(() => {
    const timer = setTimeout(() => loadSuggestions("position", draftFilters.position), 250);
    return () => clearTimeout(timer);
  }, [draftFilters.position]);

  useEffect(() => {
    const timer = setTimeout(() => loadSuggestions("city", draftFilters.city), 250);
    return () => clearTimeout(timer);
  }, [draftFilters.city]);

  const activeFilters = filterKeys.filter((key) => filters[key]);
  const canLoadMore = page < totalPages;

  return (
    <main className="content">
      <section className="search-area">
        <form className="search-form" onSubmit={applyFilters}>
          <SearchInputs
            position={draftFilters.position}
            city={draftFilters.city}
            positionSuggestions={positionSuggestions}
            citySuggestions={citySuggestions}
            onPositionChange={(value) => updateDraft("position", value)}
            onCityChange={(value) => updateDraft("city", value)}
            listPrefix="search"
          />
          <button type="submit">Ara</button>
        </form>
      </section>

      <section className="results-layout">
        <aside className="filter-panel">
          <h2>Filtreler</h2>
          <form className="filter-form" onSubmit={applyFilters}>
            <label>
              Şehir
              <select value={draftFilters.city} onChange={(event) => updateDraft("city", event.target.value)}>
                <option value="">Tüm Türkiye</option>
                {turkeyCities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              İlçe
              <input value={draftFilters.town} onChange={(event) => updateDraft("town", event.target.value)} />
            </label>
            <label>
              Çalışma şekli
              <select value={draftFilters.workType} onChange={(event) => updateDraft("workType", event.target.value)}>
                <option value="">Tümü</option>
                {workTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Filtrele</button>
          </form>
        </aside>

        <section className="jobs">
          <div className="section-title">
            <h2>Arama Sonuçları</h2>
            {isLoading && <span>Yükleniyor</span>}
          </div>

          {activeFilters.length > 0 && (
            <div className="chips">
              {activeFilters.map((key) => (
                <button className="chip" key={key} type="button" onClick={() => removeFilter(key)}>
                  {filterLabels[key]}: {formatFilterValue(key, filters[key])} <span aria-hidden="true">X</span>
                </button>
              ))}
              <button className="clear-filters" type="button" onClick={clearFilters}>
                Filtreyi Temizle
              </button>
            </div>
          )}

          {message && <p className="message">{message}</p>}
          {!isLoading && jobs.length === 0 && <p className="empty">Seçtiğiniz filtrelerle eşleşen ilan bulunamadı.</p>}
          <JobList jobs={jobs} navigate={navigate} />

          {canLoadMore && (
            <button className="load-more" type="button" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? "Yükleniyor" : "Daha Fazla Göster"}
            </button>
          )}
        </section>
      </section>
    </main>
  );
}

function SearchInputs({
  position,
  city,
  positionSuggestions,
  citySuggestions,
  onPositionChange,
  onCityChange,
  listPrefix = "home"
}) {
  const positionOptionsId = `${listPrefix}-position-options`;
  const cityOptionsId = `${listPrefix}-city-options`;

  return (
    <>
      <label>
        Pozisyon
        <input
          list={positionOptionsId}
          value={position}
          onChange={(event) => onPositionChange(event.target.value)}
          placeholder="Frontend Developer"
        />
      </label>
      <datalist id={positionOptionsId}>
        {positionSuggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <label>
        Şehir
        <input
          list={cityOptionsId}
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          placeholder="İzmir"
        />
      </label>
      <datalist id={cityOptionsId}>
        {citySuggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </>
  );
}

function LoginPage({ navigate }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const isRegistering = mode === "register";

  function changeMode(nextMode) {
    setMode(nextMode);
    setPasswordAgain("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isRegistering && password !== passwordAgain) {
      setMessage("Şifreler eşleşmiyor");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const data = isRegistering
        ? await firebaseRegister(email.trim(), password)
        : await firebaseLogin(email.trim(), password);
      saveSession({ token: data.idToken, userId: data.localId });
      navigate("/");
    } catch (error) {
      setMessage(error.message || (isRegistering ? "Kayıt başarısız" : "Giriş başarısız"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="content narrow-content">
      <section className="filter-panel">
        <div className="auth-heading">
          <h1>{isRegistering ? "Kaydol" : "Giriş Yap"}</h1>
          <div className="auth-tabs" aria-label="Hesap işlemi seçimi">
            <button
              type="button"
              className={!isRegistering ? "active" : ""}
              onClick={() => changeMode("login")}
              aria-pressed={!isRegistering}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              className={isRegistering ? "active" : ""}
              onClick={() => changeMode("register")}
              aria-pressed={isRegistering}
            >
              Kaydol
            </button>
          </div>
        </div>
        <form className="filter-form" onSubmit={handleSubmit}>
          <label>
            E-posta
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Şifre
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {isRegistering && (
            <label>
              Şifre Tekrarı
              <input
                type="password"
                value={passwordAgain}
                onChange={(event) => setPasswordAgain(event.target.value)}
                required
              />
            </label>
          )}
          <button type="submit" disabled={isLoading}>
            {isLoading ? (isRegistering ? "Kaydediliyor" : "Giriş yapılıyor") : isRegistering ? "Kaydol" : "Giriş Yap"}
          </button>
        </form>
        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}

function JobDetailPage({ jobId, session, navigate }) {
  const canManageJobs = hasAnyRole(session, adminRoles);
  const [job, setJob] = useState(null);
  const [relatedJobs, setRelatedJobs] = useState([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [message, setMessage] = useState("");

  async function loadJobDetail() {
    setIsLoading(true);
    setMessage("");
    setHasApplied(false);

    try {
      const [jobData, relatedData] = await Promise.all([
        apiGet(`/jobs/${jobId}`),
        apiGet(`/jobs/${jobId}/related`)
      ]);

      setJob(jobData.job);
      setRelatedJobs(relatedData.items);

      if (session.token && !canManageJobs) {
        const statusData = await apiGetWithToken(`/jobs/${jobId}/application-status`, session.token);
        setHasApplied(statusData.applied);
      }
    } catch {
      setMessage("İlan detayı yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApply(event) {
    event.preventDefault();

    if (!session.token || !session.userId) {
      navigate("/login");
      return;
    }

    setIsApplying(true);
    setMessage("");

    try {
      const data = await apiPost(
        `/jobs/${jobId}/apply`,
        {
          fullName: fullName.trim(),
          email: email.trim()
        },
        session.token
      );

      setJob(data.job);
      setHasApplied(true);
      setMessage("Başvurunuz alındı");
    } catch (error) {
      if (error.status === 409) {
        setHasApplied(true);
        setMessage("Bu ilana zaten başvurdunuz.");
        return;
      }

      setMessage("Başvuru gönderilemedi");
    } finally {
      setIsApplying(false);
    }
  }

  useEffect(() => {
    loadJobDetail();
  }, [jobId, session.token]);

  if (isLoading) {
    return (
      <main className="content">
        <section className="jobs">
          <p className="empty">Yükleniyor</p>
        </section>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="content">
        <section className="jobs">
          <p className="empty">{message || "İlan bulunamadı"}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="content">
      <section className="detail-layout">
        <article className="job-detail">
          <div className="detail-head">
            <div>
              <h1>{job.title}</h1>
              <p>{job.companyName}</p>
            </div>
            <span>{translateWorkType(job.workType)}</span>
          </div>

          <div className="job-meta detail-meta">
            <span>{[job.city, job.town, job.country].filter(Boolean).join(", ")}</span>
            <span>{job.positionLevel}</span>
            <span>{job.department}</span>
            <span>{formatDate(job.lastUpdatedAt)}</span>
            <span>{job.applicationCount || 0} başvuru</span>
          </div>

          <section className="detail-section">
            <h2>Açıklama</h2>
            <p>{job.description}</p>
          </section>

          <section className="detail-section">
            <h2>Aranan Nitelikler</h2>
            {job.requirements?.length > 0 ? (
              <ul>
                {job.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>Aranan nitelik belirtilmemiş.</p>
            )}
          </section>
        </article>

        <aside className="apply-panel">
          {canManageJobs ? (
            <>
              <h2>Yönetici Görünümü</h2>
              <p className="empty">Bu ilanı yönetim panelinden düzenleyebilir veya pasifleştirebilirsiniz.</p>
              <button type="button" onClick={() => navigate("/admin")}>
                Yönetim Paneline Git
              </button>
            </>
          ) : !session.token ? (
            <>
              <h2>Başvur</h2>
              <button type="button" onClick={() => navigate("/login")}>
                Başvur
              </button>
            </>
          ) : hasApplied ? (
            <>
              <h2>Başvur</h2>
              <button type="button" disabled>
                Başvuruldu
              </button>
            </>
          ) : (
            <>
              <h2>Başvur</h2>
              <form className="filter-form" onSubmit={handleApply}>
                <label>
                  Ad Soyad
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                </label>
                <label>
                  E-posta
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                <button type="submit" disabled={isApplying}>
                  {isApplying ? "Gönderiliyor" : "Başvur"}
                </button>
              </form>
            </>
          )}
          {message && <p className="message">{message}</p>}

          <section className="related">
            <h2>İlgini Çekebilecek İlanlar</h2>
            {relatedJobs.length > 0 ? (
              <JobList jobs={relatedJobs} navigate={navigate} />
            ) : (
              <p className="empty">Benzer ilan bulunamadı.</p>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

function AlertsPage({ session, onNotificationsRead, navigate }) {
  const [form, setForm] = useState({
    keywords: "",
    country: "Türkiye",
    city: "",
    town: "",
    workType: ""
  });
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function updateForm(key, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  async function loadAlerts() {
    if (!session.token || !session.userId) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const [alertData, notificationData] = await Promise.all([
        notificationGet(`/alerts/${session.userId}`, session.token),
        notificationGet(`/notifications/${session.userId}?page=1&limit=10`, session.token)
      ]);

      setAlerts(alertData.alerts);
      setNotifications(notificationData.items);

      if (notificationData.items.length > 0) {
        await apiPatch(`/notifications/${session.userId}/read`, {}, session.token);
        onNotificationsRead();
      }
    } catch {
      setMessage("Bildirimler yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateAlert(event) {
    event.preventDefault();

    if (!session.token || !session.userId) {
      navigate("/login");
      return;
    }

    setMessage("");

    try {
      await apiPost("/alerts", form, session.token);
      setForm({ keywords: "", country: "Türkiye", city: "", town: "", workType: "" });
      await loadAlerts();
      setMessage("İş alarmı oluşturuldu");
    } catch {
      setMessage("İş alarmı oluşturulamadı");
    }
  }

  async function handleDisableAlert(alertId) {
    if (!session.token) {
      navigate("/login");
      return;
    }

    try {
      await apiDelete(`/alerts/${alertId}`, session.token);
      await loadAlerts();
      setMessage("İş alarmı pasifleştirildi");
    } catch {
      setMessage("İş alarmı güncellenemedi");
    }
  }

  async function handleToggleAlert(alert) {
    try {
      await apiPut(
        `/alerts/${alert._id}`,
        {
          keywords: alert.keywords,
          country: alert.country,
          city: alert.city,
          town: alert.town,
          workType: alert.workType,
          isActive: !alert.isActive
        },
        session.token
      );
      await loadAlerts();
    } catch {
      setMessage("İş alarmı güncellenemedi");
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [session.token, session.userId]);

  return (
    <main className="content">
      <section className="alert-layout">
        <section className="filter-panel">
          <h2>İş Alarmı</h2>
          <form className="filter-form" onSubmit={handleCreateAlert}>
            <label>
              Anahtar kelimeler
              <input value={form.keywords} onChange={(event) => updateForm("keywords", event.target.value)} />
            </label>
            <label>
              Ülke
              <input value={form.country} onChange={(event) => updateForm("country", event.target.value)} />
            </label>
            <label>
              Şehir
              <select value={form.city} onChange={(event) => updateForm("city", event.target.value)}>
                <option value="">Tüm Türkiye</option>
                {turkeyCities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              İlçe
              <input value={form.town} onChange={(event) => updateForm("town", event.target.value)} />
            </label>
            <label>
              Çalışma şekli
              <select value={form.workType} onChange={(event) => updateForm("workType", event.target.value)}>
                <option value="">Tümü - çalışma şekline bakma</option>
                {workTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="helper-text">Çalışma şekli seçerseniz yalnızca aynı çalışma şekline sahip yeni ilanlar bildirim üretir.</p>
            <button type="submit">Alarm Oluştur</button>
          </form>
          {message && <p className="message">{message}</p>}
        </section>

        <section className="jobs">
          <div className="section-title">
            <h2>Alarmlarım</h2>
            {isLoading && <span>Yükleniyor</span>}
          </div>
          {!isLoading && alerts.length === 0 && <p className="empty">Kayıtlı alarmınız yok.</p>}
          <div className="alert-list">
            {alerts.map((alert) => (
              <article className="alert-card" key={alert._id}>
                <div>
                  <h3>{alert.keywords?.join(", ") || "Tüm ilanlar"}</h3>
                  <p>
                    {[alert.city, alert.town, alert.country, translateWorkType(alert.workType)]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                </div>
                <div className="alert-actions">
                  <button type="button" onClick={() => handleToggleAlert(alert)}>
                    {alert.isActive ? "Pasifleştir" : "Aktifleştir"}
                  </button>
                  <button className="danger-button" type="button" onClick={() => handleDisableAlert(alert._id)}>
                    Sil
                  </button>
                </div>
              </article>
            ))}
          </div>

          <section className="notifications">
            <h2>Bildirimler</h2>
            {!isLoading && notifications.length === 0 && <p className="empty">Bildirim bulunmuyor.</p>}
            <div className="notification-list">
              {notifications.map((item) => (
                <article
                  className="notification-card clickable-notification"
                  key={item._id}
                  onClick={() => navigate(`/jobs/${item.jobId}`)}
                >
                  <h3>{item.title}</h3>
                  <p>{item.message}</p>
                  <span>{formatDate(item.sentAt)}</span>
                </article>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

const emptyJobForm = {
  title: "",
  companyName: "",
  country: "Türkiye",
  city: "",
  town: "",
  workType: "On-site",
  positionLevel: "",
  department: "",
  description: "",
  requirements: ""
};

function AdminPage({ session, navigate }) {
  const canManageJobs = hasAnyRole(session, adminRoles);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(emptyJobForm);
  const [editingJobId, setEditingJobId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isApplicationsLoading, setIsApplicationsLoading] = useState(true);
  const [message, setMessage] = useState("");

  function updateForm(key, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  async function loadJobs() {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await apiGet("/jobs?page=1&limit=20");
      setJobs(data.items);
    } catch {
      setMessage("İlanlar yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadApplications() {
    if (!session.token) {
      return;
    }

    setIsApplicationsLoading(true);

    try {
      const data = await apiGetWithToken("/applications?page=1&limit=20", session.token);
      setApplications(data.applications || []);
    } catch {
      setApplications([]);
      setMessage("Başvurular yüklenemedi");
    } finally {
      setIsApplicationsLoading(false);
    }
  }

  function editJob(job) {
    setEditingJobId(job._id);
    setForm({
      title: job.title || "",
      companyName: job.companyName || "",
      country: job.country || "Türkiye",
      city: job.city || "",
      town: job.town || "",
      workType: job.workType || "On-site",
      positionLevel: job.positionLevel || "",
      department: job.department || "",
      description: job.description || "",
      requirements: Array.isArray(job.requirements) ? job.requirements.join("\n") : ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingJobId("");
    setForm(emptyJobForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!session.token) {
      navigate("/login");
      return;
    }

    if (!canManageJobs) {
      setMessage("Bu sayfa için admin veya şirket yetkisi gerekir");
      return;
    }

    const payload = {
      ...form,
      requirements: form.requirements
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
    };

    try {
      if (editingJobId) {
        await apiPut(`/jobs/${editingJobId}`, payload, session.token);
        setMessage("İlan güncellendi");
      } else {
        await apiPost("/jobs", payload, session.token);
        setMessage("İlan oluşturuldu");
      }

      resetForm();
      await loadJobs();
    } catch (error) {
      setMessage(error.message || "İlan kaydedilemedi");
    }
  }

  async function handleDeactivate(jobId) {
    if (!session.token) {
      navigate("/login");
      return;
    }

    try {
      await apiDelete(`/jobs/${jobId}`, session.token);
      await loadJobs();
      setMessage("İlan pasifleştirildi");
    } catch (error) {
      setMessage(error.message || "İlan pasifleştirilemedi");
    }
  }

  useEffect(() => {
    if (!session.token) {
      navigate("/login");
      return;
    }

    if (!canManageJobs) {
      setIsLoading(false);
      setMessage("Bu sayfa için admin veya şirket yetkisi gerekir");
      return;
    }

    loadJobs();
    loadApplications();
  }, [session.token, canManageJobs]);

  return (
    <main className="content">
      <section className="admin-layout">
        <section className="filter-panel">
          <h1>{editingJobId ? "İlanı Güncelle" : "İlan Ekle"}</h1>
          <form className="filter-form" onSubmit={handleSubmit}>
            <label>
              Başlık
              <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} required />
            </label>
            <label>
              Şirket
              <input
                value={form.companyName}
                onChange={(event) => updateForm("companyName", event.target.value)}
                required
              />
            </label>
            <label>
              Ülke
              <input value={form.country} onChange={(event) => updateForm("country", event.target.value)} required />
            </label>
            <label>
              Şehir
              <select value={form.city} onChange={(event) => updateForm("city", event.target.value)} required>
                <option value="">Şehir seçin</option>
                {turkeyCities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              İlçe
              <input value={form.town} onChange={(event) => updateForm("town", event.target.value)} />
            </label>
            <label>
              Çalışma şekli
              <select value={form.workType} onChange={(event) => updateForm("workType", event.target.value)}>
                {workTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pozisyon seviyesi
              <input
                value={form.positionLevel}
                onChange={(event) => updateForm("positionLevel", event.target.value)}
              />
            </label>
            <label>
              Departman
              <input value={form.department} onChange={(event) => updateForm("department", event.target.value)} />
            </label>
            <label>
              Açıklama
              <textarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                required
              />
            </label>
            <label>
              Aranan nitelikler
              <textarea
                value={form.requirements}
                onChange={(event) => updateForm("requirements", event.target.value)}
                placeholder="Her maddeyi ayrı satıra yazın"
              />
            </label>
            <div className="form-actions">
              <button type="submit">{editingJobId ? "Güncelle" : "Kaydet"}</button>
              {editingJobId && (
                <button className="secondary-button" type="button" onClick={resetForm}>
                  Vazgeç
                </button>
              )}
            </div>
          </form>
          {message && <p className="message">{message}</p>}
        </section>

        <section className="jobs">
          <div className="section-title">
            <h2>İlan Yönetimi</h2>
            {isLoading && <span>Yükleniyor</span>}
          </div>
          {!isLoading && jobs.length === 0 && <p className="empty">İlan bulunmuyor.</p>}
          <div className="job-list">
            {jobs.map((job) => (
              <article className="job-card manage-card" key={job._id}>
                <div onClick={() => navigate(`/jobs/${job._id}`)}>
                  <h3>{job.title}</h3>
                  <p>{job.companyName}</p>
                  <div className="job-meta">
                    <span>{[job.city, job.town, job.country].filter(Boolean).join(", ")}</span>
                    <span>{translateWorkType(job.workType)}</span>
                    <span>{formatDate(job.lastUpdatedAt)}</span>
                  </div>
                </div>
                <div className="manage-actions">
                  <button type="button" onClick={() => editJob(job)}>
                    Düzenle
                  </button>
                  <button className="danger-button" type="button" onClick={() => handleDeactivate(job._id)}>
                    Pasifleştir
                  </button>
                </div>
              </article>
            ))}
          </div>

          <section className="applications-section">
            <div className="section-title">
              <h2>Başvurular</h2>
              {isApplicationsLoading && <span>Yükleniyor</span>}
            </div>
            {!isApplicationsLoading && applications.length === 0 && (
              <p className="empty">Henüz başvuru bulunmuyor.</p>
            )}
            <div className="application-list">
              {applications.map((application) => {
                const applicationJob = application.jobId;
                const jobTitle =
                  typeof applicationJob === "object" && applicationJob
                    ? applicationJob.title
                    : "İlan bilgisi bulunamadı";
                const jobMeta =
                  typeof applicationJob === "object" && applicationJob
                    ? [
                        applicationJob.companyName,
                        [applicationJob.city, applicationJob.town, applicationJob.country].filter(Boolean).join(", "),
                        translateWorkType(applicationJob.workType)
                      ]
                        .filter(Boolean)
                        .join(" / ")
                    : "";

                return (
                  <article className="application-card" key={application._id}>
                    <div>
                      <h3>{application.fullName}</h3>
                      <p>{application.email}</p>
                      <div className="job-meta">
                        <span>{jobTitle}</span>
                        {jobMeta && <span>{jobMeta}</span>}
                        <span>{formatDate(application.appliedAt)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function getInitialChatItems() {
  return [
    {
      role: "assistant",
      text: "Pozisyon ve şehir yazarak iş ilanı arayabilirsin.",
      jobs: []
    }
  ];
}

function ChatWindow({ session, navigate }) {
  const chatSessionKey = session.userId || "guest";
  const chatSessionKeyRef = useRef(chatSessionKey);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState(getInitialChatItems);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    chatSessionKeyRef.current = chatSessionKey;
    setMessage("");
    setItems(getInitialChatItems());
    setIsLoading(false);
  }, [chatSessionKey]);

  function getContextJobs() {
    return items.flatMap((item) => item.jobs || []).slice(-10);
  }

  function handleAgentActions(actions = []) {
    const action = actions[0];

    if (!action?.jobId) {
      return;
    }

    if (action.type === "applyToJob" && (!session.token || !session.userId)) {
      navigate("/login");
      return;
    }

    if (["openJobDetail", "applyToJob"].includes(action.type)) {
      navigate(`/jobs/${action.jobId}`);
    }
  }

  async function handleSend(event) {
    event.preventDefault();

    const nextMessage = message.trim();

    if (!nextMessage) {
      return;
    }

    setItems((currentItems) => [...currentItems, { role: "user", text: nextMessage, jobs: [] }]);
    setMessage("");
    setIsLoading(true);

    const requestSessionKey = chatSessionKeyRef.current;

    try {
      const data = await agentPost("/agent/message", {
        message: nextMessage,
        userId: session.userId || "",
        contextJobs: getContextJobs()
      });

      if (chatSessionKeyRef.current !== requestSessionKey) {
        return;
      }

      setItems((currentItems) => [
        ...currentItems,
        {
          role: "assistant",
          text: data.reply,
          jobs: data.jobs || []
        }
      ]);
      handleAgentActions(data.actions || []);
    } catch {
      if (chatSessionKeyRef.current !== requestSessionKey) {
        return;
      }

      setItems((currentItems) => [
        ...currentItems,
        {
          role: "assistant",
          text: "Şu anda yanıt alamıyorum. Lütfen biraz sonra tekrar dene.",
          jobs: []
        }
      ]);
    } finally {
      if (chatSessionKeyRef.current === requestSessionKey) {
        setIsLoading(false);
      }
    }
  }

  function handleApply(jobId) {
    if (!session.token || !session.userId) {
      navigate("/login");
      return;
    }

    navigate(`/jobs/${jobId}`);
  }

  return (
    <section className={`chat-widget ${isOpen ? "open" : ""}`}>
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <h2>İş Asistanı</h2>
            <button type="button" onClick={() => setIsOpen(false)}>
              X
            </button>
          </div>

          <div className="chat-messages">
            {items.map((item, index) => (
              <article className={`chat-message ${item.role}`} key={`${item.role}-${index}`}>
                <p>{item.text}</p>
                {item.jobs.length > 0 && (
                  <div className="chat-jobs">
                    {item.jobs.map((job) => (
                      <div className="chat-job-card" key={job.id}>
                        <h3>{job.title}</h3>
                        <p>{job.companyName}</p>
                        <span>
                          {[job.city, job.country, translateWorkType(job.workType)].filter(Boolean).join(" / ")}
                        </span>
                        <div className="chat-job-actions">
                          <button type="button" onClick={() => navigate(`/jobs/${job.id}`)}>
                            Detay
                          </button>
                          <button type="button" onClick={() => handleApply(job.id)}>
                            Başvur
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {isLoading && <p className="chat-loading">Yanıt hazırlanıyor</p>}
          </div>

          <form className="chat-form" onSubmit={handleSend}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="İstanbul web developer"
            />
            <button type="submit" disabled={isLoading}>
              Gönder
            </button>
          </form>
        </div>
      )}

      {!isOpen && (
        <button className="chat-toggle" type="button" onClick={() => setIsOpen(true)} aria-label="İş asistanı">
          <span className="chat-bubble">Bana sor</span>
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQvdRdl9_Pbd8HEjgmQlsnjV70stw5rZ8YAWA&s"
            alt=""
          />
        </button>
      )}
    </section>
  );
}

function JobList({ jobs, navigate }) {
  return (
    <div className="job-list">
      {jobs.map((job) => (
        <article className="job-card" key={job._id} onClick={() => navigate(`/jobs/${job._id}`)}>
          <h3>{job.title}</h3>
          <p>{job.companyName}</p>
          <div className="job-meta">
            <span>{[job.city, job.town, job.country].filter(Boolean).join(", ")}</span>
            <span>{translateWorkType(job.workType)}</span>
            <span>{formatDate(job.lastUpdatedAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function cleanFilters(filters) {
  return filterKeys.reduce((values, key) => {
    values[key] = filters[key]?.trim() || "";
    return values;
  }, {});
}

createRoot(document.getElementById("root")).render(<App />);
