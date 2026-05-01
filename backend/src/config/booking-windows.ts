export type BookingWindowKey =
  | "weekday_evening"
  | "fri_sat_daytime"
  | "flexible"
  | "unknown";

export type BookingWindowOption = {
  key: Exclude<BookingWindowKey, "unknown">;
  label: string;
};

export type BookingWindowConfig = {
  prompt: string;
  followUpByKey: Record<Exclude<BookingWindowKey, "unknown">, string>;
  options: BookingWindowOption[];
};

export const DEFAULT_BOOKING_WINDOW_CONFIG: BookingWindowConfig = {
  prompt:
    "Wann passt es dir am ehesten?\n" +
    "a) unter der Woche abends\n" +
    "b) Freitag oder Samstag tagsüber\n" +
    "c) ich bin flexibel",

  followUpByKey: {
    weekday_evening:
      "Passt. Nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich unter der Woche abends gut passt.",
    fri_sat_daytime:
      "Passt. Nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich am Freitag oder Samstag tagsüber gut passt.",
    flexible:
      "Top. Dann nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich gut passt.",
  },

  options: [
    { key: "weekday_evening", label: "unter der Woche abends" },
    { key: "fri_sat_daytime", label: "Freitag oder Samstag tagsüber" },
    { key: "flexible", label: "ich bin flexibel" },
  ],
};
