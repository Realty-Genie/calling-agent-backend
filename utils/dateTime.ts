import * as chrono from 'chrono-node';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Parses a natural language time string relative to a specific timezone.
 * Returns the parsed Date object or null if parsing fails.
 * 
 * @param input - The natural language time string (e.g., "tomorrow at 5pm", "in 2 hours")
 * @param timezone - The timezone to interpret the input relative to (default: "America/Vancouver")
 * @returns Date | null
 */
export const parseNaturalLanguageTime = (input: string, timezone: string = "America/Vancouver"): Date | null => {
  try {
    // Get current time in the target timezone
    const now = dayjs().tz(timezone);

    // Create a reference date for chrono-node using the target timezone's current time
    // We need to be careful here: chrono parses relative to "now".
    // If we just pass new Date(), it uses local server time.
    // We want "tomorrow" to mean "tomorrow in Vancouver".

    // Chrono parses into a Date object (which is UTC).
    // We need to pass the reference date as a Date object that represents the *local time* in the target timezone
    // effectively "tricking" chrono if the server is in a different timezone, 
    // OR we handle the offset manually.

    // Better approach: Use chrono's ability to handle timezones if supported, 
    // or shift the reference time.

    // Let's use the reference date constructed from the target timezone's components
    const referenceDate = new Date(now.year(), now.month(), now.date(), now.hour(), now.minute(), now.second());

    const parsedResults = chrono.parse(input, referenceDate, { forwardDate: true });

    const firstResult = parsedResults[0];
    if (!firstResult || !firstResult.start) {
      return null;
    }

    const parsedDate = firstResult.start.date();

    // The parsedDate is a JS Date object constructed from the components found in the string,
    // relative to the referenceDate.
    // Since we passed a "shifted" referenceDate (representing Vancouver time as if it were local),
    // the resulting parsedDate is also "shifted".
    // We need to interpret these components back into the Vancouver timezone.

    const pYear = parsedDate.getFullYear();
    const pMonth = parsedDate.getMonth();
    const pDay = parsedDate.getDate();
    const pHour = parsedDate.getHours();
    const pMinute = parsedDate.getMinutes();
    const pSecond = parsedDate.getSeconds();

    // Reconstruct the moment in the correct timezone
    // Construct a string in ISO format (without timezone) and then parse it in the target timezone
    const isoString = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}T${String(pHour).padStart(2, '0')}:${String(pMinute).padStart(2, '0')}:${String(pSecond).padStart(2, '0')}`;

    const result = dayjs.tz(isoString, timezone);

    return result.toDate();

  } catch (error) {
    console.error("Error parsing natural language time:", error);
    return null;
  }
};


export const getCanadaDateContext = () => {
  const timezone = "America/Vancouver";
  const now = dayjs().tz(timezone);

  return {
    today_day: now.format('dddd'),
    today_date: now.format('YYYY-MM-DD'),
    today_iso: now.toISOString(),
    timezone: timezone
  };
};
