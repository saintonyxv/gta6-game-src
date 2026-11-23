// Missions for Rosa Marín, a fixer in Neon Bay. Three jobs, in order:
// 1. Sunset Pickup — reach the downtown checkpoint before the timer ends.
// 2. Parcel Run — collect the package, then deliver it across town.
// 3. Heat Wave — the police are on you; reach the safehouse and lose them.
// Each mission carries its own objective text, timer and cash reward.
import { CITY, blockX, blockY, streetX, streetY } from './config.js';

export const MISSION_COUNT = 3;

function downtownSpot() { return { x: streetX(3), y: streetY(3) }; }
function beachSpot() { return { x: streetX(6), y: streetY(1) }; }
function westSpot() { return { x: streetX(1), y: streetY(5) }; }
function safehouseSpot() { return { x: streetX(0), y: streetY(6) }; }

export function missionDef(index) {
  if (index === 0) {
    return {
      name: 'Sunset Pickup',
      intro: 'Rosa Marín needs a driver. Get to the pink marker downtown before the timer runs out.',
      objective: 'Reach the downtown checkpoint',
      target: downtownSpot(),
      time: 75,
      reward: 150,
    };
  }
  if (index === 1) {
    return {
      name: 'Parcel Run',
      intro: 'Pick up Rosa’s parcel at the beach, then deliver it to the west side. Don’t keep her waiting.',
      objective: 'Pick up the parcel at the beach',
      target: beachSpot(),
      time: 120,
      reward: 300,
      pickup: true,
      deliverTarget: westSpot(),
      deliverObjective: 'Deliver the parcel to the west side',
    };
  }
  return {
    name: 'Heat Wave',
    intro: 'A job went loud. The whole Neon Bay force is after you. Reach the safehouse and lose them.',
    objective: 'Reach the safehouse — lose the heat',
    target: safehouseSpot(),
    time: 90,
    reward: 500,
    heat: true,
  };
}

// Fresh mission progress: nothing started yet.
export function createMissions() {
  return {
    index: 0,            // which mission is current (0..2); 3 = story complete
    phase: 'idle',       // idle | active | pickup | deliver | done | failed | complete
    timer: 0,
    banner: 0,           // seconds left to show the mission-complete banner
    lastCompleted: null, // name + reward of the mission just finished
    target: null,
    objective: 'Talk to Rosa Marín — press Enter to take the first job',
  };
}

export function startMission(missions, index) {
  const def = missionDef(index);
  missions.index = index;
  missions.phase = def.pickup ? 'pickup' : 'active';
  missions.timer = def.time;
  missions.target = def.target;
  missions.objective = def.objective;
  missions.banner = 0;
  missions.lastCompleted = null;
  return def;
}

export function completeMission(missions, cash) {
  const def = missionDef(missions.index);
  missions.lastCompleted = { name: def.name, reward: def.reward };
  missions.phase = 'done';
  missions.banner = 4;
  missions.objective = `${def.name} complete — $${def.reward} earned`;
  missions.target = null;
  return cash + def.reward;
}

export function advanceMission(missions) {
  if (missions.index + 1 >= MISSION_COUNT) {
    missions.index = MISSION_COUNT;
    missions.phase = 'complete';
    missions.objective = 'Story complete — Neon Bay is yours. Free roam.';
    missions.target = null;
    return null;
  }
  return startMission(missions, missions.index + 1);
}

export function failMission(missions) {
  missions.phase = 'failed';
  missions.banner = 4;
  missions.target = null;
  missions.objective = 'Job failed — press Enter to try again';
}

export function retryMission(missions) {
  return startMission(missions, missions.index);
}
