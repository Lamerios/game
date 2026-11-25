import { RaceScene } from '../race/RaceScene';

/**
 * «Полёт слов»: the plane game. It flies on the race's engine (pseudo-3D, the
 * English word, the number line and boosters, the pit stop with squats), with
 * the plane routes, its own save ('flight-progress') and the hangar where a
 * plane comes for each goal reached. See flight/logic.ts.
 */
export class FlightScene extends RaceScene {
  constructor() {
    super('Flight');
  }
}
