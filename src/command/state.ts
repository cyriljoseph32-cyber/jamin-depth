import type { Venture } from "./types";

/**
 * L'état de pilotage : ce que Cyril met en avant, et ce qu'il met en sourdine.
 *
 * Trois valeurs seulement, mais elles ont un pouvoir réel : `paused` coupe
 * l'automatisation non critique. « Non critique » veut dire tout sauf P0 et
 * tout sauf l'alerte — mettre une activité en pause ne doit jamais empêcher un
 * incident de remonter, sinon la pause devient un silence dangereux.
 */

export interface CommandState {
  /** Activité prioritaire du moment (`/focus`). */
  focus?: Venture;
  /** Activités en pause (`/pause DIVING`). */
  pausedVentures: readonly Venture[];
  /** Agents en pause (`/pause marketing`). */
  pausedAgents: readonly string[];
  updatedAt?: string;
}

export const emptyState: CommandState = { pausedVentures: [], pausedAgents: [] };

export interface StateStore {
  read(): Promise<CommandState>;
  write(state: CommandState): Promise<CommandState>;
}

export function createStateStore(initial: CommandState = emptyState): StateStore {
  let state = initial;
  return {
    async read() {
      return state;
    },
    async write(next) {
      state = next;
      return state;
    },
  };
}

/** Une action de niveau ≥ 1 doit-elle être retenue ? Les P0 passent toujours. */
export function isPaused(
  state: CommandState,
  target: { venture: Venture; agent: string; priority: string },
): boolean {
  if (target.priority === "P0") return false;
  return (
    state.pausedVentures.includes(target.venture) ||
    state.pausedAgents.some((a) => a.toLowerCase() === target.agent.toLowerCase())
  );
}

/** `/pause <cible>` : une venture si le nom en est une, sinon un agent. */
export function pause(state: CommandState, target: Venture | string, at: string): CommandState {
  const venture = asVenture(target);
  if (venture) {
    return state.pausedVentures.includes(venture)
      ? { ...state, updatedAt: at }
      : { ...state, pausedVentures: [...state.pausedVentures, venture], updatedAt: at };
  }
  const agent = target.toLowerCase();
  return state.pausedAgents.includes(agent)
    ? { ...state, updatedAt: at }
    : { ...state, pausedAgents: [...state.pausedAgents, agent], updatedAt: at };
}

export function resume(state: CommandState, target: Venture | string, at: string): CommandState {
  const venture = asVenture(target);
  if (venture) {
    return { ...state, pausedVentures: state.pausedVentures.filter((v) => v !== venture), updatedAt: at };
  }
  const agent = target.toLowerCase();
  return { ...state, pausedAgents: state.pausedAgents.filter((a) => a !== agent), updatedAt: at };
}

function asVenture(value: string): Venture | null {
  const upper = value.trim().toUpperCase();
  return upper === "COCO" || upper === "DIVING" || upper === "RUGBY" || upper === "GLOBAL"
    ? (upper as Venture)
    : null;
}
