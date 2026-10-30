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
  // One optional, gentle reminder only inside a fresh inbound 24h window.
  // Live sends still require all independent send/ownership/opt-out gates.
  schedules: [{
    cycle: 1,
    slots: [{
      cycle: 1,
      stage: "cycle1_within24h_6h",
      dayOffsetHours: 6,
      sendHour: 0,
      sendMinute: 0,
    }],
  }],
  messages: {
    cycle1_within24h_6h:
      "Kurze Nachfrage: Ist das Thema für dich noch aktuell? Wenn nicht, ist das völlig in Ordnung.",
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
