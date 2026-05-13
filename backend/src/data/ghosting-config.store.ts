type GhostingSlot = {
  cycle: number;
  stage: string;
  dayOffsetHours: number;
  sendHour: number;
  sendMinute: number;
};

type GhostingSchedule = {
  cycle: number;
  slots: GhostingSlot[];
};

type GhostingConfig = {
  schedules: GhostingSchedule[];
  messages: Record<string, string>;
};

function cloneGhostingConfig(config: GhostingConfig): GhostingConfig {
  return {
    schedules: config.schedules.map((schedule) => ({
      cycle: schedule.cycle,
      slots: schedule.slots.map((slot) => ({
        cycle: slot.cycle,
        stage: slot.stage,
        dayOffsetHours: slot.dayOffsetHours,
        sendHour: slot.sendHour,
        sendMinute: slot.sendMinute,
      })),
    })),
    messages: { ...config.messages },
  };
}

export type { GhostingSlot, GhostingSchedule, GhostingConfig };

const defaultGhostingConfig: GhostingConfig = {
  schedules: [
    {
      cycle: 1,
      slots: [
        {
          cycle: 1,
          stage: "cycle1_day1_0700",
          dayOffsetHours: 24,
          sendHour: 7,
          sendMinute: 0,
        },
        {
          cycle: 1,
          stage: "cycle1_day1_1400",
          dayOffsetHours: 24,
          sendHour: 14,
          sendMinute: 0,
        },
        {
          cycle: 1,
          stage: "cycle1_day1_2100",
          dayOffsetHours: 24,
          sendHour: 21,
          sendMinute: 0,
        },
      ],
    },
    {
      cycle: 2,
      slots: [
        {
          cycle: 2,
          stage: "cycle2_day2_0900",
          dayOffsetHours: 48,
          sendHour: 9,
          sendMinute: 0,
        },
        {
          cycle: 2,
          stage: "cycle2_day2_1800",
          dayOffsetHours: 48,
          sendHour: 18,
          sendMinute: 0,
        },
      ],
    },
    {
      cycle: 3,
      slots: [
        {
          cycle: 3,
          stage: "cycle3_day3_1700",
          dayOffsetHours: 72,
          sendHour: 17,
          sendMinute: 0,
        },
      ],
    },
  ],
  messages: {
    cycle1_day1_0700:
      "Kurze Erinnerung von mir 🙂\nIst das Thema bei dir gerade noch auf dem Schirm oder ist der Alltag dazwischengekommen?",
    cycle1_day1_1400:
      "Ich halte nur kurz nach:\nIst das Thema gerade noch relevant für dich oder ist im Alltag einfach alles dazwischengegrätscht?",
    cycle1_day1_2100:
      "Kurzer Check von mir am Abend:\nIst das Thema noch offen oder ist der Tag inzwischen komplett darübergerollt?",
    cycle2_day2_0900:
      "Ich melde mich nochmal kurz 🙂\nWenn das Thema noch offen ist, schreib mir einfach kurz zurück.",
    cycle2_day2_1800:
      "Kurze ehrliche Nachfrage:\nIst das Thema für dich noch wichtig oder soll ich es erstmal wieder loslassen?",
    cycle3_day3_1700:
      "Ich schließe das Thema erstmal für den Moment.\nWenn du es wieder aufgreifen willst, reicht ein kurzes Zeichen.",
  },
};

let ghostingConfig: GhostingConfig = cloneGhostingConfig(defaultGhostingConfig);

function normalizeSlot(input: unknown): GhostingSlot {
  if (!input || typeof input !== "object") {
    throw new Error("Ungültiger Slot.");
  }

  const raw = input as Record<string, unknown>;

  const cycle = Number(raw.cycle);
  const dayOffsetHours = Number(raw.dayOffsetHours);
  const sendHour = Number(raw.sendHour);
  const sendMinute = Number(raw.sendMinute);
  const stage = String(raw.stage ?? "").trim();

  if (!Number.isInteger(cycle) || cycle < 1) {
    throw new Error(`Ungültiger cycle-Wert bei Stage "${stage || "-"}".`);
  }

  if (!stage) {
    throw new Error("Jeder Slot braucht eine stage.");
  }

  if (!Number.isInteger(dayOffsetHours) || dayOffsetHours < 0) {
    throw new Error(`Ungültiger dayOffsetHours-Wert bei Stage "${stage}".`);
  }

  if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) {
    throw new Error(`Ungültige sendHour bei Stage "${stage}".`);
  }

  if (!Number.isInteger(sendMinute) || sendMinute < 0 || sendMinute > 59) {
    throw new Error(`Ungültige sendMinute bei Stage "${stage}".`);
  }

  return {
    cycle,
    stage,
    dayOffsetHours,
    sendHour,
    sendMinute,
  };
}

function normalizeSchedules(input: unknown): GhostingSchedule[] {
  if (!Array.isArray(input)) {
    throw new Error("schedules muss ein Array sein.");
  }

  const flatSlots: GhostingSlot[] = [];

  for (const schedule of input) {
    if (!schedule || typeof schedule !== "object") {
      throw new Error("Ungültiger Schedule-Eintrag.");
    }

    const rawSchedule = schedule as Record<string, unknown>;
    const cycle = Number(rawSchedule.cycle);

    if (!Number.isInteger(cycle) || cycle < 1) {
      throw new Error("Ungültiger cycle-Wert im Schedule.");
    }

    if (!Array.isArray(rawSchedule.slots)) {
      throw new Error(`Schedule für Zyklus ${cycle} braucht slots als Array.`);
    }

    for (const rawSlot of rawSchedule.slots) {
      const slot = normalizeSlot({
        ...(rawSlot as Record<string, unknown>),
        cycle,
      });
      flatSlots.push(slot);
    }
  }

  const stageSet = new Set<string>();

  for (const slot of flatSlots) {
    if (stageSet.has(slot.stage)) {
      throw new Error(`Stage "${slot.stage}" ist doppelt vorhanden.`);
    }
    stageSet.add(slot.stage);
  }

  const grouped = new Map<number, GhostingSlot[]>();

  for (const slot of flatSlots) {
    if (!grouped.has(slot.cycle)) {
      grouped.set(slot.cycle, []);
    }
    grouped.get(slot.cycle)!.push(slot);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cycle, slots]) => ({
      cycle,
      slots: [...slots].sort((a, b) => {
        if (a.dayOffsetHours !== b.dayOffsetHours) {
          return a.dayOffsetHours - b.dayOffsetHours;
        }
        if (a.sendHour !== b.sendHour) {
          return a.sendHour - b.sendHour;
        }
        return a.sendMinute - b.sendMinute;
      }),
    }));
}

export function getGhostingConfig(): GhostingConfig {
  return cloneGhostingConfig(ghostingConfig);
}

export function updateGhostingMessages(
  partialMessages: Record<string, string>,
): GhostingConfig {
  const nextMessages = { ...ghostingConfig.messages };

  for (const [stage, text] of Object.entries(partialMessages || {})) {
    nextMessages[stage] = String(text ?? "").trim();
  }

  ghostingConfig = {
    schedules: cloneGhostingConfig(ghostingConfig).schedules,
    messages: nextMessages,
  };

  return getGhostingConfig();
}

export function updateGhostingSchedules(schedules: unknown): GhostingConfig {
  const nextSchedules = normalizeSchedules(schedules);

  const nextMessages: Record<string, string> = {};

  for (const schedule of nextSchedules) {
    for (const slot of schedule.slots) {
      nextMessages[slot.stage] =
        ghostingConfig.messages[slot.stage] ??
        defaultGhostingConfig.messages[slot.stage] ??
        "";
    }
  }

  ghostingConfig = {
    schedules: nextSchedules,
    messages: nextMessages,
  };

  return getGhostingConfig();
}

export function resetGhostingConfig(): GhostingConfig {
  ghostingConfig = cloneGhostingConfig(defaultGhostingConfig);
  return getGhostingConfig();
}
