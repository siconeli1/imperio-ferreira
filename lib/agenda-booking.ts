import {
  AGENDA_CONFIG,
  filterPastSlotsForDate,
  generateCandidateStartTimes,
  isAppointmentWithinSchedule,
  minutesToTime,
  reduceVisibleSlots,
  timeToMinutes,
} from "@/lib/agenda";
import { getBusyIntervals, overlaps } from "@/lib/agenda-conflicts";
import { listActiveBarbeiros } from "@/lib/barbeiros";

export type AvailableSlot = {
  hora_inicio: string;
  hora_fim: string;
  barbeiros_disponiveis: string[];
};

type SlotValidationResult =
  | { ok: false; erro: string }
  | { ok: true; day: number; inicioReserva: number; fimReserva: number };

function buildFreeSlots(data: string, day: number, duration: number, busyState: Awaited<ReturnType<typeof getBusyIntervals>>) {
  if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
    return [];
  }

  const slots = filterPastSlotsForDate(
    data,
    generateCandidateStartTimes(day, duration).map((inicio) => ({
      hora_inicio: minutesToTime(inicio),
      hora_fim: minutesToTime(inicio + duration),
    }))
  );

  return slots
    .map((slot) => ({
      ...slot,
      inicio: timeToMinutes(slot.hora_inicio),
      fim: timeToMinutes(slot.hora_fim),
    }))
    .filter((slot) => {
      return !busyState.intervalos.some((intervalo) =>
        overlaps(slot.inicio, slot.fim, intervalo.inicio, intervalo.fim)
      );
    })
    .map(({ hora_inicio, hora_fim }) => ({ hora_inicio, hora_fim }));
}

export async function getAvailableSlots(params: {
  data: string;
  duracao: number;
  barbeiroId?: string | null;
}) {
  const d = new Date(`${params.data}T00:00:00`);
  const day = d.getDay();

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return {
      horarios: [] as AvailableSlot[],
      horarios_completos: [] as AvailableSlot[],
    };
  }

  if (params.barbeiroId) {
    const busyState = await getBusyIntervals(params.data, params.barbeiroId);
    const completos = buildFreeSlots(params.data, day, params.duracao, busyState).map((slot) => ({
      ...slot,
      barbeiros_disponiveis: [params.barbeiroId!],
    }));

    return {
      horarios: reduceVisibleSlots(completos),
      horarios_completos: completos,
    };
  }

  const barbeiros = await listActiveBarbeiros();
  const slotMap = new Map<string, AvailableSlot>();

  for (const barbeiro of barbeiros) {
    const busyState = await getBusyIntervals(params.data, barbeiro.id);
    const livres = buildFreeSlots(params.data, day, params.duracao, busyState);

    for (const slot of livres) {
      const key = `${slot.hora_inicio}-${slot.hora_fim}`;
      const current = slotMap.get(key);

      if (current) {
        current.barbeiros_disponiveis.push(barbeiro.id);
      } else {
        slotMap.set(key, {
          ...slot,
          barbeiros_disponiveis: [barbeiro.id],
        });
      }
    }
  }

  const completos = Array.from(slotMap.values()).sort((a, b) =>
    a.hora_inicio.localeCompare(b.hora_inicio)
  );

  return {
    horarios: reduceVisibleSlots(completos),
    horarios_completos: completos,
  };
}

export function validateBusinessSlot(
  data: string,
  horaInicio: string,
  duracao: number
): SlotValidationResult {
  const day = new Date(`${data}T00:00:00`).getDay();
  const inicioReserva = timeToMinutes(horaInicio);

  if (!AGENDA_CONFIG.openDays.includes(day)) {
    return { ok: false, erro: "Data fora do funcionamento" };
  }

  if (!isAppointmentWithinSchedule(day, inicioReserva, duracao)) {
    return { ok: false, erro: "Nao ha tempo suficiente para este servico nesse horario" };
  }

  return {
    ok: true,
    day,
    inicioReserva,
    fimReserva: inicioReserva + duracao,
  };
}
