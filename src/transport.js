const TARGET_ROUTES = new Set(["73", "59", "172"]);

function routeNumber(title = "") {
  return title.match(/(?:^|\s)(\d+[а-яА-Яa-zA-Z]?)(?:\s|$)/)?.[1].replace(/[^\d]/g, "") ?? "";
}

function formatArrival(route) {
  const times = [route.next_vehicle, route.second_vehicle]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => `через ${value} мин`);
  return `${route.title}${route.direction ? ` (${route.direction})` : ""} — ${times.join(", ") || "нет данных"}`;
}

/** Returns actual nearest arrivals from the EasyWay stop board. */
export async function getTransport(config = process.env) {
  const { EASYWAY_LOGIN: login, EASYWAY_PASSWORD: password, EASYWAY_CITY: city, EASYWAY_STOP_ID: stopId } = config;
  if (!login || !password || !city || !stopId) {
    return "Онлайн-табло не настроено: добавьте EASYWAY_LOGIN, EASYWAY_PASSWORD, EASYWAY_CITY и EASYWAY_STOP_ID в Railway Variables.";
  }

  const params = new URLSearchParams({
    login, password, city, id: stopId, function: "stops.GetStopInfo", lang: "ru", format: "json", v: "1.0"
  });
  const response = await fetch(`https://api.eway24.ru/?${params}`, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`EasyWay returned HTTP ${response.status}`);

  const payload = await response.json();
  const transports = payload.stop?.transports ?? payload.transports ?? [];
  const routes = transports.flatMap((group) => group.routes ?? []);
  const relevant = routes.filter((route) => TARGET_ROUTES.has(routeNumber(route.title)));
  if (!relevant.length) return "В онлайн-табло нет данных о маршрутах 73, 59 и 172.";

  return ["Остановка «Лейтенанта Кижеватова» (онлайн-табло):", ...relevant.map(formatArrival)].join("\n");
}
