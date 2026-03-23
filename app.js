const clockTimeEl = document.getElementById("clockTime");
const dateLineEl = document.getElementById("dateLine");
const tzLineEl = document.getElementById("tzLine");
const ringProgressEl = document.getElementById("ringProgress");

const weatherCardEl = document.getElementById("weatherCard");
const weatherVisualEl = document.getElementById("weatherVisual");
const locationNameEl = document.getElementById("locationName");
const weatherTextEl = document.getElementById("weatherText");
const tempNowEl = document.getElementById("tempNow");
const tempRangeEl = document.getElementById("tempRange");
const feelsLikeEl = document.getElementById("feelsLike");
const humidityEl = document.getElementById("humidity");
const uvIndexEl = document.getElementById("uvIndex");
const aqiValueEl = document.getElementById("aqiValue");
const aqiTextEl = document.getElementById("aqiText");
const forecastListEl = document.getElementById("forecastList");

const calendarTitleEl = document.getElementById("calendarTitle");
const weekHeaderEl = document.getElementById("weekHeader");
const calendarGridEl = document.getElementById("calendarGrid");

const settingsBtn = document.getElementById("settingsBtn");
const settingsClose = document.getElementById("settingsClose");
const settingsMask = document.getElementById("settingsMask");
const settingsPanel = document.getElementById("settingsPanel");
const themeSelect = document.getElementById("themeSelect");
const fontSelect = document.getElementById("fontSelect");
const refreshIntervalSelect = document.getElementById("refreshInterval");

const SETTINGS_KEY = "desk-clock-settings-v1";
const DEFAULT_SETTINGS = {
  theme: "aurora",
  font: "avenir",
  refreshMinutes: 10,
};

let weatherRefreshTimer = null;

const secondRingLength = 2 * Math.PI * 98;
ringProgressEl.style.strokeDasharray = String(secondRingLength);

const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const WEATHER_CODE_MAP = {
  0: "晴朗",
  1: "晴间多云",
  2: "局部多云",
  3: "阴",
  45: "雾",
  48: "冻雾",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "强毛毛雨",
  56: "冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "阵雨",
  81: "强阵雨",
  82: "暴雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷暴",
  96: "雷暴夹小冰雹",
  99: "雷暴夹冰雹",
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);

    return {
      theme: typeof parsed.theme === "string" ? parsed.theme : DEFAULT_SETTINGS.theme,
      font: typeof parsed.font === "string" ? parsed.font : DEFAULT_SETTINGS.font,
      refreshMinutes:
        Number.isFinite(Number(parsed.refreshMinutes)) && Number(parsed.refreshMinutes) > 0
          ? Number(parsed.refreshMinutes)
          : DEFAULT_SETTINGS.refreshMinutes,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let settings = loadSettings();

function applySettings() {
  document.body.dataset.theme = settings.theme;
  document.body.dataset.font = settings.font;

  themeSelect.value = settings.theme;
  fontSelect.value = settings.font;
  refreshIntervalSelect.value = String(settings.refreshMinutes);
}

function openSettings() {
  settingsMask.hidden = false;
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsMask.hidden = true;
}

function startWeatherRefreshTimer() {
  if (weatherRefreshTimer) {
    clearInterval(weatherRefreshTimer);
  }

  weatherRefreshTimer = setInterval(() => {
    refreshWeather();
  }, settings.refreshMinutes * 60 * 1000);
}

function setupSettings() {
  settingsBtn.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  settingsMask.addEventListener("click", closeSettings);

  themeSelect.addEventListener("change", (event) => {
    settings.theme = event.target.value;
    applySettings();
    saveSettings(settings);
  });

  fontSelect.addEventListener("change", (event) => {
    settings.font = event.target.value;
    applySettings();
    saveSettings(settings);
  });

  refreshIntervalSelect.addEventListener("change", (event) => {
    settings.refreshMinutes = Number(event.target.value) || DEFAULT_SETTINGS.refreshMinutes;
    saveSettings(settings);
    startWeatherRefreshTimer();
    refreshWeather();
  });
}

function formatNow(now) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatLunarDate(now) {
  try {
    const lunar = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "long",
      day: "numeric",
    }).format(now);
    return `农历${lunar}`;
  } catch {
    return "";
  }
}

function updateClock() {
  const now = new Date();
  clockTimeEl.textContent = formatNow(now);

  const solar = new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const lunar = formatLunarDate(now);
  dateLineEl.textContent = lunar ? `${solar} · ${lunar}` : solar;

  tzLineEl.textContent = `时区：${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  ringProgressEl.style.strokeDashoffset = String(secondRingLength * (1 - seconds / 60));
  requestAnimationFrame(updateClock);
}

function renderCalendar(baseDate = new Date()) {
  weekHeaderEl.innerHTML = "";
  calendarGridEl.innerHTML = "";

  WEEK_DAYS.forEach((d) => {
    const el = document.createElement("span");
    el.textContent = d;
    weekHeaderEl.appendChild(el);
  });

  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  calendarTitleEl.textContent = `${y}年${m + 1}月`;

  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const prevLastDay = new Date(y, m, 0);
  const offset = firstDay.getDay();
  const total = Math.ceil((offset + lastDay.getDate()) / 7) * 7;

  for (let i = 0; i < total; i += 1) {
    const dayCell = document.createElement("div");
    dayCell.className = "day-cell";

    const dateNum = i - offset + 1;
    let cellDate;

    if (dateNum < 1) {
      cellDate = new Date(y, m - 1, prevLastDay.getDate() + dateNum);
      dayCell.classList.add("muted");
    } else if (dateNum > lastDay.getDate()) {
      cellDate = new Date(y, m + 1, dateNum - lastDay.getDate());
      dayCell.classList.add("muted");
    } else {
      cellDate = new Date(y, m, dateNum);
    }

    dayCell.textContent = String(cellDate.getDate());

    const now = new Date();
    if (
      cellDate.getFullYear() === now.getFullYear() &&
      cellDate.getMonth() === now.getMonth() &&
      cellDate.getDate() === now.getDate()
    ) {
      dayCell.classList.add("today");
    }

    calendarGridEl.appendChild(dayCell);
  }
}

function describeAqi(aqi) {
  if (aqi <= 50) return ["优", "var(--ok)"];
  if (aqi <= 100) return ["良", "#a7f46a"];
  if (aqi <= 150) return ["轻度污染", "var(--warn)"];
  if (aqi <= 200) return ["中度污染", "#ff9f43"];
  if (aqi <= 300) return ["重度污染", "#ff6b6b"];
  return ["严重污染", "#d90429"];
}

function joinLocationParts(parts) {
  const clean = [];
  parts.forEach((part) => {
    if (!part) return;
    const value = String(part).trim();
    if (!value || clean.includes(value)) return;
    clean.push(value);
  });
  return clean.join("");
}

function fallbackLocationText(lat, lon) {
  return `坐标 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

async function reverseGeocode(lat, lon) {
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("language", "zh");

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const place = data?.results?.[0];
      if (place) {
        const countryCode = String(place?.country_code || "").toUpperCase();
        const text = joinLocationParts([
          countryCode === "CN" ? "中国" : place?.country,
          place?.admin1,
          place?.admin2,
          place?.name,
        ]);
        if (text) return text;
      }
    }
  } catch {
    // Continue to secondary reverse geocode provider.
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("accept-language", "zh-CN");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url);
    if (!res.ok) return fallbackLocationText(lat, lon);

    const data = await res.json();
    const a = data?.address || {};
    const text = joinLocationParts([
      a.country_code === "cn" ? "中国" : a.country,
      a.state,
      a.city || a.town || a.county,
      a.suburb || a.city_district || a.neighbourhood,
    ]);

    return text || fallbackLocationText(lat, lon);
  } catch {
    return fallbackLocationText(lat, lon);
  }
}

function weatherText(code) {
  return WEATHER_CODE_MAP[code] || "天气更新中";
}

function weatherGlyph(code) {
  if ([95, 96, 99].includes(code)) return "⚡";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧";
  if ([45, 48].includes(code)) return "🌫";
  if ([1, 2].includes(code)) return "⛅";
  if (code === 3) return "☁";
  return "☀";
}

function weatherState(code) {
  if ([95, 96, 99].includes(code)) return "storm";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([45, 48].includes(code)) return "fog";
  if ([1, 2].includes(code)) return "partly";
  if (code === 3) return "cloudy";
  return "clear";
}

function setWeatherVisual(code) {
  const state = weatherState(code);
  weatherVisualEl.className = `weather-visual state-${state}`;
  weatherCardEl.dataset.weatherState = state;
}

function renderForecast(days = [], weatherCodes = [], tMax = [], tMin = []) {
  forecastListEl.innerHTML = "";

  const maxCount = Math.min(3, Math.max(0, days.length - 1));
  for (let i = 1; i <= maxCount; i += 1) {
    const item = document.createElement("li");
    item.className = "forecast-item";
    item.style.animationDelay = `${i * 80}ms`;

    const date = new Date(days[i]);
    const week = `周${WEEK_DAYS[date.getDay()]}`;
    const mmdd = `${date.getMonth() + 1}/${date.getDate()}`;
    const code = Number(weatherCodes[i]);

    item.innerHTML = `
      <p class="forecast-day">${week} ${mmdd}</p>
      <p class="forecast-cond"><span class="forecast-icon">${weatherGlyph(code)}</span>${weatherText(code)}</p>
      <p class="forecast-temp">${Math.round(tMax[i])}° / ${Math.round(tMin[i])}°</p>
    `;

    forecastListEl.appendChild(item);
  }

  if (!maxCount) {
    const item = document.createElement("li");
    item.className = "forecast-item";
    item.innerHTML = "<p>未来预报暂不可用</p>";
    forecastListEl.appendChild(item);
  }
}

function pickCurrentWeather(weatherData) {
  const currentObj = weatherData?.current || null;
  if (
    currentObj?.temperature_2m != null &&
    currentObj?.weather_code != null &&
    currentObj?.apparent_temperature != null &&
    currentObj?.relative_humidity_2m != null
  ) {
    return {
      temperature: Number(currentObj.temperature_2m),
      weatherCode: Number(currentObj.weather_code),
      apparentTemperature: Number(currentObj.apparent_temperature),
      humidity: Number(currentObj.relative_humidity_2m),
      uvIndex: Number(currentObj.uv_index ?? NaN),
    };
  }

  const hourly = weatherData?.hourly;
  if (hourly?.temperature_2m?.length && hourly?.weather_code?.length) {
    return {
      temperature: Number(hourly.temperature_2m[0]),
      weatherCode: Number(hourly.weather_code[0]),
      apparentTemperature: Number(hourly.apparent_temperature?.[0]),
      humidity: Number(hourly.relative_humidity_2m?.[0]),
      uvIndex: Number(hourly.uv_index?.[0]),
    };
  }

  throw new Error("天气数据结构异常");
}

function uvLevelText(value) {
  if (value < 3) return "低";
  if (value < 6) return "中";
  if (value < 8) return "高";
  if (value < 11) return "很高";
  return "极高";
}

function renderAqi(airData) {
  const current = airData?.current;
  const hourly = airData?.hourly;

  const aqi = current?.us_aqi ?? hourly?.us_aqi?.[0];
  const pm25 = current?.pm2_5 ?? hourly?.pm2_5?.[0];

  if (aqi == null || Number.isNaN(Number(aqi))) {
    aqiValueEl.textContent = "--";
    aqiTextEl.textContent = "AQI 暂无数据";
    return;
  }

  const rawAqi = Math.round(Number(aqi));
  const [aqiLabel, color] = describeAqi(rawAqi);
  aqiValueEl.textContent = String(rawAqi);
  aqiValueEl.style.color = color;

  if (pm25 == null || Number.isNaN(Number(pm25))) {
    aqiTextEl.textContent = aqiLabel;
    return;
  }

  aqiTextEl.textContent = `${aqiLabel} · PM2.5 ${Math.round(Number(pm25))}`;
}

function renderWeather(weatherData) {
  const now = pickCurrentWeather(weatherData);

  weatherTextEl.textContent = weatherText(now.weatherCode);
  tempNowEl.textContent = `${Math.round(now.temperature)}°C`;
  setWeatherVisual(now.weatherCode);

  const maxToday = weatherData?.daily?.temperature_2m_max?.[0];
  const minToday = weatherData?.daily?.temperature_2m_min?.[0];
  if (maxToday != null && minToday != null) {
    tempRangeEl.textContent = `H ${Math.round(maxToday)}° / L ${Math.round(minToday)}°`;
  } else {
    tempRangeEl.textContent = "H --° / L --°";
  }

  feelsLikeEl.textContent = Number.isNaN(now.apparentTemperature)
    ? "--°C"
    : `${Math.round(now.apparentTemperature)}°C`;

  humidityEl.textContent = Number.isNaN(now.humidity)
    ? "--%"
    : `${Math.round(now.humidity)}%`;

  if (Number.isNaN(now.uvIndex)) {
    uvIndexEl.textContent = "--";
  } else {
    const uv = Math.max(0, now.uvIndex);
    uvIndexEl.textContent = `${uv.toFixed(1)} (${uvLevelText(uv)})`;
  }

  renderForecast(
    weatherData?.daily?.time || [],
    weatherData?.daily?.weather_code || [],
    weatherData?.daily?.temperature_2m_max || [],
    weatherData?.daily?.temperature_2m_min || [],
  );
}

async function fetchWeather(lat, lon) {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,uv_index",
    hourly: "temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,uv_index",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "4",
  }).toString();

  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "us_aqi,pm2_5,pm10",
    hourly: "us_aqi,pm2_5,pm10",
    timezone: "auto",
  }).toString();

  const [weatherResult, airResult, placeName] = await Promise.allSettled([
    fetch(weatherUrl),
    fetch(airUrl),
    reverseGeocode(lat, lon),
  ]);

  locationNameEl.textContent =
    placeName.status === "fulfilled" ? placeName.value : fallbackLocationText(lat, lon);

  if (weatherResult.status !== "fulfilled" || !weatherResult.value.ok) {
    throw new Error("天气服务暂不可用");
  }

  const weatherData = await weatherResult.value.json();
  renderWeather(weatherData);

  if (airResult.status === "fulfilled" && airResult.value.ok) {
    const airData = await airResult.value.json();
    renderAqi(airData);
  } else {
    aqiValueEl.textContent = "--";
    aqiTextEl.textContent = "AQI 服务暂不可用";
  }
}

function getLocation() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ lat: 31.2304, lon: 121.4737 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {
        resolve({ lat: 31.2304, lon: 121.4737 });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

async function refreshWeather() {
  try {
    const { lat, lon } = await getLocation();
    await fetchWeather(lat, lon);
  } catch {
    weatherTextEl.textContent = "天气获取失败";
    tempNowEl.textContent = "--°C";
    tempRangeEl.textContent = "H --° / L --°";
    feelsLikeEl.textContent = "--°C";
    humidityEl.textContent = "--%";
    uvIndexEl.textContent = "--";
    locationNameEl.textContent = "离线模式";
    aqiValueEl.textContent = "--";
    aqiTextEl.textContent = "网络不可用";
    weatherVisualEl.className = "weather-visual state-fog";
    forecastListEl.innerHTML = "";
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Ignore service worker registration errors to keep UI functional.
      });
    });
  }
}

applySettings();
setupSettings();
updateClock();
renderCalendar();
refreshWeather();
startWeatherRefreshTimer();
registerServiceWorker();
