import { GameRules, GameState, RoundState } from "../logic/gamestate";
import { StateRecorder } from "../state/recorder";
import { GameWorld } from "../world";
import { Team } from "../logic/teams";
import { StateRecordWormGameState } from "../state/model";
import { combineLatest, map } from "rxjs";
import Logger from "../log";


const log = new Logger("NetGameState");
export class NetGameState extends GameState {
  protected clientActive$ = this.currentTeam$.pipe(map(t => t?.playerUserId === this.myUserId));

  get shouldControlState(): boolean {
    return this.currentTeam.value?.playerUserId === this.myUserId;
  }

  get peekNextTeam() {
    for (let index = 0; index < this.nextTeamStack.length; index++) {
      const nextTeam = this.nextTeamStack[index];
      if (nextTeam.group === this.activeTeam?.group) {
        continue;
      }
      if (nextTeam.worms.some((w) => w.health > 0)) {
        return nextTeam;
      }
    }
    return null;
  }

  get peekNextPlayer() {
    return this.peekNextTeam?.playerUserId;
  }

  constructor(
    teams: Team[],
    world: GameWorld,
    rules: GameRules,
    private readonly recorder: StateRecorder,
    private readonly myUserId: string,
  ) {
    super(teams, world, rules);
    combineLatest([this.roundState$]).subscribe(([state]) => {
      if (this.shouldControlState) {
        this.recordGameState(state);
      }
    });
  }

  protected networkSelectNextTeam() {
    const previousTeam = this.currentTeam.value;
    if (!previousTeam) {
      const [firstTeam] = this.nextTeamStack.splice(0, 1);
      this.currentTeam.next(firstTeam);
      return;
    }
    this.nextTeamStack.push(previousTeam);

    for (let index = 0; index < this.nextTeamStack.length; index++) {
      const nextTeam = this.nextTeamStack[index];
      if (nextTeam.group === previousTeam.group) {
        continue;
      }
      if (nextTeam.worms.some((w) => w.health > 0)) {
        this.nextTeamStack.splice(index, 1);
        this.currentTeam.next(nextTeam);
      }
    }
  }

  public applyGameStateUpdate(stateUpdate: StateRecordWormGameState["data"]): ReturnType<typeof this.advanceRound>|null {
    // if (this.iteration >= stateUpdate.iteration) {
    //   log.debug("Ignoring iteration because it's stale", this.iteration, stateUpdate.iteration);
    //   // Skip
    //   return;
    // }
    log.debug("Applying round state", stateUpdate.round_state);
    for (const teamData of stateUpdate.teams) {
      const teamWormSet = this.teams.get(teamData.uuid)?.worms;
      if (!teamWormSet) {
        throw new Error(`Missing local team data for team ${teamData.uuid}`);
      }
      for (const wormData of teamData.worms) {
        const foundWorm = teamWormSet.find((w) => w.uuid === wormData.uuid);
        if (foundWorm) {
          foundWorm.setHealth(wormData.health);
        }
      }
    }
    if (
      this.roundState.value !== RoundState.Preround &&
      stateUpdate.round_state === RoundState.Preround
    ) {
      this.remainingRoundTimeMs.next(5000);
    }
    if (stateUpdate.round_state === RoundState.WaitingToBegin) {
      const result = this.advanceRound();
      this.wind = stateUpdate.wind;
      return result;
    } else if (stateUpdate.round_state === RoundState.Playing) {
      this.playerMoved();
    } else {
      // TODO?
      this.roundState.next(stateUpdate.round_state);
    }
    return null;
  }

  protected recordGameState(roundState: RoundState) {
    log.debug("Recording round state", roundState);
    const iteration = this.iteration;
    const teams = this.getTeams();
    this.recorder.recordGameState({
      round_state: roundState,
      iteration: iteration,
      wind: this.currentWind,
      teams: teams.map((t) => ({
        uuid: t.uuid,
        worms: t.worms.map((w) => ({
          uuid: w.uuid,
          name: w.name,
          health: w.health,
          maxHealth: w.maxHealth,
        })),
        ammo: t.ammo,
      })),
    });
  }

  public update(ticker: { deltaMS: number }) {
    const roundState = this.roundState.value;
    let remainingRoundTimeMs = this.remainingRoundTimeMs.value;
    if (
      roundState === RoundState.Finished ||
      roundState === RoundState.Paused ||
      roundState === RoundState.WaitingToBegin
    ) {
      return;
    }

    remainingRoundTimeMs = Math.max(0, remainingRoundTimeMs - ticker.deltaMS);
    this.remainingRoundTimeMs.next(remainingRoundTimeMs);
    if (remainingRoundTimeMs) {
      return;
    }

    if (!this.shouldControlState) {
      // Waiting for other client to make the move.
      return;
    } else {

    }

    if (roundState === RoundState.Preround) {
      this.playerMoved();
    } else {
      this.roundState.next(RoundState.Finished);
    }
  }
}
