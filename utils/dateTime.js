// utils/dateTime.js
export function getCanadaDateContext() {
  const now = new Date();

  return {
    today_date: now.toLocaleDateString("en-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Vancouver",
    }),
    today_day: now.toLocaleDateString("en-CA", {
      weekday: "long",
      timeZone: "America/Vancouver",
    }),
    today_iso: now.toISOString(),
    timezone: "America/Vancouver",
  };
}
