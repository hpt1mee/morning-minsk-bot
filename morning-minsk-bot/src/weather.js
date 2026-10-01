const CONDITION_RU = {
  clear: "ясно", "partly-cloudy": "малооблачно", cloudy: "облачно с прояснениями",
  overcast: "пасмурно", drizzle: "морось", "light-rain": "небольшой дождь",
  rain: "дождь", "moderate-rain": "умеренный дождь", "heavy-rain": "сильный дождь",
  "continuous-heavy-rain": "длительный сильный дождь", showers: "ливень",
  "wet-snow": "дождь со снегом", "light-snow": "небольшой снег", snow: "снег",
  "snow-showers": "снегопад", hail: "град", thunderstorm: "гроза",
  "thunderstorm-with-rain": "дождь с грозой", "thunderstorm-with-hail": "гроза с градом"
};

export async function getYandexWeather(apiKey) {
  if (!apiKey) {
    return "Не настроено: добавьте YANDEX_WEATHER_API_KEY в Railway Variables.";
  }

  const response = await fetch(
    "https://api.weather.yandex.ru/v2/forecast?lat=53.9006&lon=27.5590&lang=ru_RU&limit=1",
    { headers: { "X-Yandex-Weather-Key": apiKey }, signal: AbortSignal.timeout(12_000) }
  );
  if (!response.ok) throw new Error(`Yandex Weather вернул HTTP ${response.status}`);

  const { fact } = await response.json();
  const temp = fact.temp > 0 ? `+${fact.temp}` : String(fact.temp);
  const feels = fact.feels_like > 0 ? `+${fact.feels_like}` : String(fact.feels_like);
  return `${temp} °C, ощущается как ${feels} °C, ${CONDITION_RU[fact.condition] ?? fact.condition}. Ветер ${fact.wind_speed ?? 0} м/с.`;
}
