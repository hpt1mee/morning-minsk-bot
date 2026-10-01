import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatSchedule } from "./schedule.js";
import { getTransport } from "./transport.js";
import { getYandexWeather } from "./weather.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required. Add it in Railway Variables.");

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const SUBSCRIBERS_FILE = join(DATA_DIR, "subscribers.json");
const API = `https://api.telegram.org/bot${TOKEN}`;
const TIME_ZONE = "Europe/Minsk";
let lastSentDate = "";

function minskNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts();
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")), minute: Number(value("minute")),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday"))
  };
}

async function telegram(method, body) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000)
  });
  const json = await response.json();
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? response.status}`);
  return json.result;
}

async function subscribers() {
  try { return JSON.parse(await readFile(SUBSCRIBERS_FILE, "utf8")); }
  catch { return process.env.TELEGRAM_CHAT_ID ? [Number(process.env.TELEGRAM_CHAT_ID)] : []; }
}

async function addSubscriber(chatId) {
  await mkdir(DATA_DIR, { recursive: true });
  const existing = await subscribers();
  if (!existing.includes(chatId)) await writeFile(SUBSCRIBERS_FILE, JSON.stringify([...existing, chatId]));
}

async function morningMessage() {
  const now = minskNow();
  const [weather, transport] = await Promise.allSettled([
    getYandexWeather(process.env.YANDEX_WEATHER_API_KEY), getTransport()
  ]);
  const weatherText = weather.status === "fulfilled" ? weather.value : "Не удалось получить прогноз Яндекс Погоды.";
  const transportText = transport.status === "fulfilled" ? transport.value : "Не удалось получить расписание транспорта.";
  return [
    "Доброе утро! ☀️", "", `🌦 Погода в Минске\n${weatherText}`, "",
    `📚 Расписание\n${formatSchedule(now.weekday)}`, "", `🚌 Транспорт\n${transportText}`
  ].join("\n");
}

async function sendMorning(chatIds) {
  chatIds ??= await subscribers();
  const message = await morningMessage();
  await Promise.all(chatIds.map((chat_id) => telegram("sendMessage", {
    chat_id, text: message, disable_web_page_preview: true
  }).catch((error) => console.error(`Could not message ${chat_id}:`, error.message))));
}

async function handleUpdates(offset) {
  const updates = await telegram("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
  for (const update of updates) {
    offset = update.update_id + 1;
    const message = update.message;
    if (!message?.text) continue;
    const chatId = message.chat.id;
    if (message.text.startsWith("/start")) {
      await addSubscriber(chatId);
      await telegram("sendMessage", { chat_id: chatId, text: "Готово! Буду присылать утреннюю сводку каждый день в 08:00 по Минску. Команда /now отправит её сразу." });
    } else if (message.text.startsWith("/now")) {
      await sendMorning([chatId]);
    } else if (message.text.startsWith("/id")) {
      await telegram("sendMessage", { chat_id: chatId, text: `Ваш chat ID: ${chatId}\nДобавьте его в Railway Variables как TELEGRAM_CHAT_ID, чтобы подписка не терялась при новом развёртывании.` });
    }
  }
  return offset;
}

async function run() {
  console.log("Bot started. Waiting for /start and 08:00 Europe/Minsk.");
  let offset = 0;
  setInterval(async () => {
    const now = minskNow();
    if (now.hour === 8 && now.minute === 0 && lastSentDate !== now.date) {
      lastSentDate = now.date;
      await sendMorning();
    }
  }, 10_000);

  while (true) {
    try { offset = await handleUpdates(offset); }
    catch (error) { console.error("Polling error:", error.message); await new Promise((resolve) => setTimeout(resolve, 5_000)); }
  }
}

run().catch((error) => { console.error(error); process.exit(1); });
