const clockTimeEl = document.getElementById("clockTime");
const dateLineEl = document.getElementById("dateLine");
const tzLineEl = document.getElementById("tzLine");
const hourHandEl = document.getElementById("hourHand");
const minuteHandEl = document.getElementById("minuteHand");
const secondHandEl = document.getElementById("secondHand");
const dialTicksEl = document.getElementById("dialTicks");
const dialNumbersEl = document.getElementById("dialNumbers");

const weatherCardEl = document.getElementById("weatherCard");
const weatherVisualEl = document.getElementById("weatherVisual");
const locationNameEl = document.getElementById("locationName");
const weatherRefreshBtnEl = document.getElementById("weatherRefreshBtn");
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
const showSecondsToggleEl = document.getElementById("showSecondsToggle");

const SETTINGS_KEY = "desk-clock-settings-v1";
const DEFAULT_SETTINGS = {
  theme: "aurora",
  font: "avenir",
  refreshMinutes: 10,
  showSeconds: true,
};
const QWEATHER_API_KEY = "995725a47cc546f097e1c75a8a46a876";
const QWEATHER_API_HOST = "k64d945tk8.re.qweatherapi.com";

let weatherRefreshTimer = null;
let clockTimer = null;

let lastCalendarDateKey = "";
let lastSecondStamp = -1;
let lastMinuteStamp = -1;

let preferredForecastDays = 3;
let latestForecastMode = "";
let latestOpenMeteoDaily = null;
let latestQWeatherDaily = [];
let forecastResizeRaf = null;
let weatherCardResizeObserver = null;

const solarDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

let lunarDateFormatter = null;
try {
  lunarDateFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
    month: "long",
    day: "numeric",
  });
} catch {
  lunarDateFormatter = null;
}

const timeZoneLabel = `时区：${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

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
      showSeconds:
        typeof parsed.showSeconds === "boolean" ? parsed.showSeconds : DEFAULT_SETTINGS.showSeconds,
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
  if (showSecondsToggleEl) showSecondsToggleEl.checked = Boolean(settings.showSeconds);
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

  if (weatherRefreshBtnEl) {
    weatherRefreshBtnEl.addEventListener("click", () => {
      refreshWeather({ manual: true });
    });
  }

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

  if (showSecondsToggleEl) {
    showSecondsToggleEl.addEventListener("change", (event) => {
      settings.showSeconds = Boolean(event.target.checked);
      saveSettings(settings);
      clockTimeEl.textContent = formatNow(new Date());
    });
  }
}


function initClockDial() {
  if (!dialTicksEl || !dialNumbersEl) return;

  dialTicksEl.innerHTML = "";
  dialNumbersEl.innerHTML = "";

    for (let n = 1; n <= 12; n += 1) {
    const num = document.createElement("span");
    num.className = "dial-number";
    num.textContent = String(n);

    const deg = n * 30 - 90;
    const radius = 40;
    const x = 50 + Math.cos((deg * Math.PI) / 180) * radius;
    const y = 50 + Math.sin((deg * Math.PI) / 180) * radius;
    num.style.left = `${x}%`;
    num.style.top = `${y}%`;

    dialNumbersEl.appendChild(num);
  }
}
function formatNow(now) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  if (!settings.showSeconds) return `${hh}:${mm}`;

  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatLunarDate(now) {
  if (!lunarDateFormatter) return "";
  return `农历${lunarDateFormatter.format(now)}`;
}

function renderClock(now) {
  const secondStamp = now.getSeconds();
  const minuteStamp = now.getMinutes();

  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  if (hourHandEl) {
    hourHandEl.style.transform = `translate(-50%, -100%) rotate(${hours * 30}deg)`;
  }
  if (minuteHandEl) {
    minuteHandEl.style.transform = `translate(-50%, -100%) rotate(${minutes * 6}deg)`;
  }
  if (secondHandEl) {
    secondHandEl.style.transform = `translate(-50%, -100%) rotate(${seconds * 6}deg)`;
  }

  if (secondStamp !== lastSecondStamp) {
    lastSecondStamp = secondStamp;
    clockTimeEl.textContent = formatNow(now);
  }

  if (minuteStamp !== lastMinuteStamp) {
    lastMinuteStamp = minuteStamp;

    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (lastCalendarDateKey !== dateKey) {
      lastCalendarDateKey = dateKey;
      renderCalendar(now);
    }

    const solar = solarDateFormatter.format(now);
    const lunar = formatLunarDate(now);
    dateLineEl.textContent = lunar ? `${solar} · ${lunar}` : solar;
    tzLineEl.textContent = timeZoneLabel;
  }
}

function scheduleClockTick() {
  const now = new Date();
  renderClock(now);

  const delay = 1000 - now.getMilliseconds();
  clockTimer = setTimeout(scheduleClockTick, delay + 8);
}

function startClock() {
  if (clockTimer) clearTimeout(clockTimer);
  scheduleClockTick();
}

function stopClock() {
  if (!clockTimer) return;
  clearTimeout(clockTimer);
  clockTimer = null;
}

function renderCalendar(baseDate = new Date()) {
  if (!weekHeaderEl || !calendarGridEl || !calendarTitleEl) return;

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

function stripCnRegionSuffix(name) {
  if (!name) return "";
  return String(name).trim().replace(/(特别行政区|自治区|自治州|自治县|地区|盟|省|市|区|县)$/u, "");
}

function formatCnShortLocation({ adm1, adm2, name }) {
  const city = stripCnRegionSuffix(adm1) || stripCnRegionSuffix(adm2);
  const district = stripCnRegionSuffix(name) || stripCnRegionSuffix(adm2);
  if (city && district) return `${city}，${district}`;
  return city || district || "";
}

function fallbackLocationText(lat, lon) {
  return `坐标 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function fallbackLocationContext(lat, lon) {
  return { displayName: fallbackLocationText(lat, lon), countryCode: "" };
}

function toLocationContext(displayName, countryCode = "") {
  return {
    displayName: displayName || "",
    countryCode: String(countryCode || "").toUpperCase(),
  };
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
        if (text) {
          const shortCn = countryCode === "CN"
            ? formatCnShortLocation({ adm1: place?.admin1, adm2: place?.admin2, name: place?.name })
            : "";
          return toLocationContext(shortCn || text, countryCode);
        }
      }
    }
  } catch {
    // Continue to other providers.
  }

  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("localityLanguage", "zh");

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const countryCode = String(data?.countryCode || "").toUpperCase();
      const text = joinLocationParts([
        countryCode === "CN" ? "中国" : data?.countryName,
        data?.principalSubdivision,
        data?.city || data?.locality,
        data?.locality,
      ]);
      if (text) {
        const shortCn = countryCode === "CN"
          ? formatCnShortLocation({
            adm1: data?.principalSubdivision,
            adm2: data?.city || data?.locality,
            name: data?.locality,
          })
          : "";
        return toLocationContext(shortCn || text, countryCode);
      }
    }
  } catch {
    // Continue to final provider.
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
    if (!res.ok) return fallbackLocationContext(lat, lon);

    const data = await res.json();
    const a = data?.address || {};
    const text = joinLocationParts([
      a.country_code === "cn" ? "中国" : a.country,
      a.state,
      a.city || a.town || a.county,
      a.suburb || a.city_district || a.neighbourhood,
    ]);

    const isCn = String(a.country_code || "").toLowerCase() === "cn";
    const shortCn = isCn
      ? formatCnShortLocation({
        adm1: a.state,
        adm2: a.city || a.town || a.county,
        name: a.suburb || a.city_district || a.neighbourhood,
      })
      : "";
    return toLocationContext(shortCn || text || fallbackLocationText(lat, lon), a.country_code);
  } catch {
    return fallbackLocationContext(lat, lon);
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
  setWeatherVisualByState(state);
}

function setWeatherVisualByState(state) {
  weatherVisualEl.className = `weather-visual state-${state}`;
  weatherCardEl.dataset.weatherState = state;
}

function weatherGlyphByState(state) {
  if (state === "storm") return "⚡";
  if (state === "snow") return "❄";
  if (state === "rain") return "🌧";
  if (state === "fog") return "🌫";
  if (state === "partly") return "⛅";
  if (state === "cloudy") return "☁";
  return "☀";
}

function qWeatherState(iconCode) {
  const code = Number(iconCode);
  if (Number.isNaN(code)) return "clear";
  if ([302, 303, 304].includes(code)) return "storm";
  if (code >= 300 && code <= 399) return "rain";
  if (code >= 400 && code <= 499) return "snow";
  if (code >= 500 && code <= 515) return "fog";
  if ([101, 102, 103, 104].includes(code)) return "partly";
  if (code === 100) return "clear";
  return "cloudy";
}

function detectForecastDaysByWidth() {
  const listWidth = forecastListEl?.clientWidth || weatherCardEl?.clientWidth || window.innerWidth || 0;
  const minCardWidth = 118;
  const gap = 10;
  const fitCount = Math.floor((listWidth + gap) / (minCardWidth + gap));
  return fitCount >= 7 ? 7 : 3;
}

function rerenderLatestForecast() {
  if (latestForecastMode === "qweather") {
    renderQWeatherForecast(latestQWeatherDaily);
    return;
  }

  if (latestForecastMode === "openmeteo") {
    renderForecast(
      latestOpenMeteoDaily?.time || [],
      latestOpenMeteoDaily?.weather_code || [],
      latestOpenMeteoDaily?.temperature_2m_max || [],
      latestOpenMeteoDaily?.temperature_2m_min || [],
    );
  }
}

function syncForecastLayout(options = {}) {
  const force = Boolean(options.force);
  const nextDays = detectForecastDaysByWidth();
  if (!force && nextDays === preferredForecastDays) return;

  preferredForecastDays = nextDays;
  if (forecastListEl) {
    forecastListEl.style.setProperty("--forecast-columns", String(preferredForecastDays));
  }

  if (latestForecastMode) {
    rerenderLatestForecast();
  }
}

function requestForecastLayoutSync() {
  if (forecastResizeRaf != null) return;

  forecastResizeRaf = requestAnimationFrame(() => {
    forecastResizeRaf = null;
    syncForecastLayout();
  });
}

function setupForecastLayoutObserver() {
  syncForecastLayout({ force: true });

  if (typeof ResizeObserver === "function" && weatherCardEl) {
    weatherCardResizeObserver = new ResizeObserver(() => {
      requestForecastLayoutSync();
    });
    weatherCardResizeObserver.observe(weatherCardEl);
  }

  window.addEventListener("resize", requestForecastLayoutSync);
}

function renderForecast(days = [], weatherCodes = [], tMax = [], tMin = []) {
  forecastListEl.innerHTML = "";

  const maxCount = Math.min(preferredForecastDays, Math.max(0, days.length - 1));
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

  latestForecastMode = "openmeteo";
  latestQWeatherDaily = [];
  latestOpenMeteoDaily = weatherData?.daily || null;

  renderForecast(
    latestOpenMeteoDaily?.time || [],
    latestOpenMeteoDaily?.weather_code || [],
    latestOpenMeteoDaily?.temperature_2m_max || [],
    latestOpenMeteoDaily?.temperature_2m_min || [],
  );
}

function renderQWeatherForecast(daily = []) {
  forecastListEl.innerHTML = "";
  const maxCount = Math.min(preferredForecastDays, Math.max(0, daily.length - 1));

  for (let i = 1; i <= maxCount; i += 1) {
    const day = daily[i] || {};
    const item = document.createElement("li");
    item.className = "forecast-item";
    item.style.animationDelay = `${i * 80}ms`;

    const date = day.fxDate ? new Date(day.fxDate) : new Date();
    const week = `周${WEEK_DAYS[date.getDay()]}`;
    const mmdd = `${date.getMonth() + 1}/${date.getDate()}`;
    const state = qWeatherState(day.iconDay);
    const cond = day.textDay || "天气更新中";
    const maxTemp = Number(day.tempMax);
    const minTemp = Number(day.tempMin);
    const tempText = Number.isFinite(maxTemp) && Number.isFinite(minTemp)
      ? `${Math.round(maxTemp)}° / ${Math.round(minTemp)}°`
      : "--° / --°";

    item.innerHTML = `
      <p class="forecast-day">${week} ${mmdd}</p>
      <p class="forecast-cond"><span class="forecast-icon">${weatherGlyphByState(state)}</span>${cond}</p>
      <p class="forecast-temp">${tempText}</p>
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

function renderQWeather(aqiData, weatherNowData, weatherDailyData) {
  const now = weatherNowData?.now || {};
  const daily = weatherDailyData?.daily || [];
  const today = daily[0] || {};

  weatherTextEl.textContent = now.text || "天气更新中";
  tempNowEl.textContent = Number.isFinite(Number(now.temp)) ? `${Math.round(Number(now.temp))}°C` : "--°C";
  setWeatherVisualByState(qWeatherState(now.icon));

  if (Number.isFinite(Number(today.tempMax)) && Number.isFinite(Number(today.tempMin))) {
    tempRangeEl.textContent = `H ${Math.round(Number(today.tempMax))}° / L ${Math.round(Number(today.tempMin))}°`;
  } else {
    tempRangeEl.textContent = "H --° / L --°";
  }

  feelsLikeEl.textContent = Number.isFinite(Number(now.feelsLike))
    ? `${Math.round(Number(now.feelsLike))}°C`
    : "--°C";
  humidityEl.textContent = Number.isFinite(Number(now.humidity))
    ? `${Math.round(Number(now.humidity))}%`
    : "--%";

  const uvRaw = Number(today.uvIndex ?? now.uvIndex);
  if (Number.isFinite(uvRaw)) {
    const uv = Math.max(0, uvRaw);
    uvIndexEl.textContent = `${uv.toFixed(1)} (${uvLevelText(uv)})`;
  } else {
    uvIndexEl.textContent = "--";
  }
  latestForecastMode = "qweather";
  latestOpenMeteoDaily = null;
  latestQWeatherDaily = Array.isArray(daily) ? daily : [];

  renderQWeatherForecast(latestQWeatherDaily);

  const usAqiIndex = aqiData?.indexes?.find((item) => item?.code === "us-epa");
  const qAqiIndex = aqiData?.indexes?.find((item) => item?.code === "qaqi");
  const cnAqiIndex = aqiData?.indexes?.find((item) => item?.code === "aqi" || item?.code === "cn-mee");
  const firstIndex = aqiData?.indexes?.[0];
  const pm25Pollutant = aqiData?.pollutants?.find((item) => item?.code === "pm2p5");
  const aqi = Number(
    usAqiIndex?.aqiDisplay ??
    usAqiIndex?.aqi ??
    qAqiIndex?.aqiDisplay ??
    qAqiIndex?.aqi ??
    cnAqiIndex?.aqiDisplay ??
    cnAqiIndex?.aqi ??
    firstIndex?.aqiDisplay ??
    firstIndex?.aqi ??
    aqiData?.now?.aqi,
  );
  const pm25 = Number(pm25Pollutant?.concentration?.value ?? aqiData?.now?.pm2p5);
  if (!Number.isFinite(aqi)) {
    aqiValueEl.textContent = "--";
    aqiTextEl.textContent = "AQI 暂无数据";
    return;
  }

  const rawAqi = Math.round(aqi);
  const [aqiLabel, color] = describeAqi(rawAqi);
  aqiValueEl.textContent = String(rawAqi);
  aqiValueEl.style.color = color;
  aqiTextEl.textContent = Number.isFinite(pm25)
    ? `${aqiLabel} · PM2.5 ${Math.round(pm25)}`
    : aqiLabel;
}

async function fetchQWeather(lat, lon, options = {}) {
  if (!QWEATHER_API_KEY) throw new Error("QWeather key missing");
  const forceNetwork = Boolean(options.forceNetwork);
  const requestOptions = {
    headers: {
      "X-QW-Api-Key": QWEATHER_API_KEY,
    },
  };
  if (forceNetwork) requestOptions.cache = "no-store";

  const lookupUrl = new URL(`https://${QWEATHER_API_HOST}/geo/v2/city/lookup`);
  lookupUrl.search = new URLSearchParams({
    location: `${lon},${lat}`,
    number: "1",
    lang: "zh",
    range: "cn",
  }).toString();
  if (forceNetwork) lookupUrl.searchParams.set("_ts", String(Date.now()));

  const lookupRes = await fetch(lookupUrl, requestOptions);
  if (!lookupRes.ok) throw new Error("和风地理接口不可用");

  const lookupData = await lookupRes.json();
  const city = lookupData?.location?.[0];
  if (!city?.id) throw new Error("和风地理定位失败");

  const placeText = joinLocationParts([
    city.country === "中国" || city.country === "China" ? "中国" : city.country,
    city.adm1,
    city.adm2,
    city.name,
  ]);
  const shortCn = formatCnShortLocation({ adm1: city.adm1, adm2: city.adm2, name: city.name });
  if (placeText) locationNameEl.textContent = shortCn || placeText;

  const nowUrl = new URL(`https://${QWEATHER_API_HOST}/v7/weather/now`);
  nowUrl.search = new URLSearchParams({ location: city.id, lang: "zh", unit: "m" }).toString();
  if (forceNetwork) nowUrl.searchParams.set("_ts", String(Date.now()));
  const fetchDailyWeatherResponse = async () => {
    const dailyPaths = ["/v7/weather/10d", "/v7/weather/7d"];
    for (const path of dailyPaths) {
      const dailyUrl = new URL(`https://${QWEATHER_API_HOST}${path}`);
      dailyUrl.search = new URLSearchParams({ location: city.id, lang: "zh", unit: "m" }).toString();
      if (forceNetwork) dailyUrl.searchParams.set("_ts", String(Date.now()));

      try {
        const res = await fetch(dailyUrl, requestOptions);
        if (res.ok) return res;
      } catch {
        // Try next daily endpoint.
      }
    }

    throw new Error("和风天气日预报接口不可用");
  };

  const airEndpoints = [
    `https://${QWEATHER_API_HOST}/airquality/v1/current/${lat.toFixed(2)}/${lon.toFixed(2)}`,
    `https://${QWEATHER_API_HOST}/airquality/v1/current/${lon.toFixed(2)}/${lat.toFixed(2)}`,
  ];

  const fetchAirQuality = async () => {
    for (const endpoint of airEndpoints) {
      const primaryUrl = new URL(endpoint);
      primaryUrl.search = new URLSearchParams({ lang: "zh" }).toString();
      if (forceNetwork) primaryUrl.searchParams.set("_ts", String(Date.now()));

      try {
        const primaryRes = await fetch(primaryUrl, requestOptions);
        if (primaryRes.ok) {
          return await primaryRes.json();
        }
      } catch {
        // Try fallback auth mode.
      }

      const fallbackUrl = new URL(endpoint);
      fallbackUrl.search = new URLSearchParams({
        lang: "zh",
        key: QWEATHER_API_KEY,
      }).toString();
      if (forceNetwork) fallbackUrl.searchParams.set("_ts", String(Date.now()));

      try {
        const fallbackRes = await fetch(fallbackUrl, forceNetwork ? { cache: "no-store" } : undefined);
        if (fallbackRes.ok) {
          return await fallbackRes.json();
        }
      } catch {
        // Continue to next endpoint.
      }
    }
    return null;
  };

  const [nowResult, dailyResult, airResult] = await Promise.allSettled([
    fetch(nowUrl, requestOptions),
    fetchDailyWeatherResponse(),
    fetchAirQuality(),
  ]);

  if (
    nowResult.status !== "fulfilled" ||
    dailyResult.status !== "fulfilled" ||
    !nowResult.value.ok ||
    !dailyResult.value.ok
  ) {
    throw new Error("和风天气服务暂不可用");
  }

  const weatherNowData = await nowResult.value.json();
  const weatherDailyData = await dailyResult.value.json();
  let aqiData = null;

  if (airResult.status === "fulfilled") {
    aqiData = airResult.value;
  } else {
    console.warn("QWeather AQI request failed:", airResult.reason);
  }
  renderQWeather(aqiData, weatherNowData, weatherDailyData);
}

async function fetchOpenMeteo(lat, lon, options = {}) {
  const forceNetwork = Boolean(options.forceNetwork);
  const requestOptions = forceNetwork ? { cache: "no-store" } : undefined;

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,uv_index",
    hourly: "temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,uv_index",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "8",
  }).toString();
  if (forceNetwork) weatherUrl.searchParams.set("_ts", String(Date.now()));

  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "us_aqi,pm2_5,pm10",
    hourly: "us_aqi,pm2_5,pm10",
    timezone: "auto",
  }).toString();
  if (forceNetwork) airUrl.searchParams.set("_ts", String(Date.now()));

  const [weatherResult, airResult] = await Promise.allSettled([
    fetch(weatherUrl, requestOptions),
    fetch(airUrl, requestOptions),
  ]);

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

async function fetchWeather(lat, lon, options = {}) {
  const forceNetwork = Boolean(options.forceNetwork);
  const place = await reverseGeocode(lat, lon).catch(() => fallbackLocationContext(lat, lon));
  const locationContext = place?.displayName ? place : fallbackLocationContext(lat, lon);
  locationNameEl.textContent = locationContext.displayName;

  if (locationContext.countryCode === "CN" && QWEATHER_API_KEY) {
    try {
      await fetchQWeather(lat, lon, { forceNetwork });
      return;
    } catch {
      // Fallback to Open-Meteo when QWeather fails.
    }
  }

  await fetchOpenMeteo(lat, lon, { forceNetwork });
}
function setWeatherRefreshButtonState(isLoading) {
  if (!weatherRefreshBtnEl) return;
  weatherRefreshBtnEl.disabled = isLoading;
  weatherRefreshBtnEl.classList.toggle("loading", isLoading);
  weatherRefreshBtnEl.textContent = isLoading ? "刷新中" : "刷新";
}
function getLocation(options = {}) {
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
      { enableHighAccuracy: Boolean(options.forceFresh), timeout: 6000, maximumAge: options.forceFresh ? 0 : 15 * 60 * 1000 },
    );
  });
}

async function refreshWeather(options = {}) {
  setWeatherRefreshButtonState(true);
  try {
    const forceNetwork = Boolean(options.manual);
    if (forceNetwork) {
      locationNameEl.textContent = "刷新中...";
      weatherTextEl.textContent = "刷新中...";
    }
    const { lat, lon } = await getLocation({ forceFresh: forceNetwork });
    await fetchWeather(lat, lon, { forceNetwork });
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
    latestForecastMode = "";
    latestOpenMeteoDaily = null;
    latestQWeatherDaily = [];
  } finally {
    setWeatherRefreshButtonState(false);
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    startClock();
    return;
  }
  stopClock();
});

initClockDial();
applySettings();
setupSettings();
setupForecastLayoutObserver();
startClock();
renderCalendar();
refreshWeather();
startWeatherRefreshTimer();
registerServiceWorker();


































