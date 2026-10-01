const STOP_URL = "https://kogda.by/stops/minsk/%D0%9B%D0%B5%D0%B9%D1%82%D0%B5%D0%BD%D0%B0%D0%BD%D1%82%D0%B0%20%D0%9A%D0%B8%D0%B6%D0%B5%D0%B2%D0%B0%D1%82%D0%BE%D0%B2%D0%B0";
const YANDEX_MAPS_URL = "https://yandex.ru/maps/157/minsk/?mode=transit";

// The user supplied only a time window, not a separate arrival time for each route.
// This remains an honest scheduled window; the source link lets the recipient check live data.
export async function getTransport() {
  // A lightweight availability check makes failures visible without depending on undocumented APIs.
  try {
    const response = await fetch(STOP_URL, {
      headers: { "User-Agent": "MorningMinskTelegramBot/1.0" },
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) throw new Error(String(response.status));
  } catch {
    return [
      "73 автобус, 59 троллейбус, 172 автобус — ориентировочно в интервале 08:35–08:47.",
      "Источник расписания сейчас недоступен; проверьте актуальное движение в Яндекс Картах.",
      YANDEX_MAPS_URL
    ].join("\n");
  }

  return [
    "Остановка «Лейтенанта Кижеватова».",
    "73 автобус, 59 троллейбус, 172 автобус — ориентировочно в интервале 08:35–08:47.",
    `Актуальное движение: ${YANDEX_MAPS_URL}`
  ].join("\n");
}
