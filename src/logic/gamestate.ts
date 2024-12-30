import { Ticker } from "pixi.js";
import { InternalTeam, Team, WormInstance } from "./teams";
import type { StateRecordWormGameState } from "../state/model";
import Logger from "../log";
import { EntityType } from "../entities/type";
import { GameWorld } from "../world";

export interface GameRules {
  roundDurationMs?: number;
  winWhenOneGroupRemains?: boolean;
  winWhenAllObjectsOfTypeDestroyed?: EntityType;
}

const logger = new Logger("GameState");

enum RoundState {
  WaitingToBegin,
  Preround,
  Playing,
  Paused,
  Finished,
}

export class GameState {
  static getTeamMaxHealth(team: Team) {
    return team.worms.map((w) => w.maxHealth).reduce((a, b) => a + b);
  }

  static getTeamHealth(team: Team) {
    return team.worms.map((w) => w.health).reduce((a, b) => a + b);
  }

  static getTeamHealthPercentage(team: Team) {
    return (
      Math.ceil(
        (team.worms.map((w) => w.health).reduce((a, b) => a + b) /
          team.worms.map((w) => w.maxHealth).reduce((a, b) => a + b)) *
          100,
      ) / 100
    );
  }

  private currentTeam?: InternalTeam;
  private readonly teams: InternalTeam[];
  private nextTeamStack: InternalTeam[];

  /**
   * Wind strength. Integer between -10 and 10.
   */
  private wind = 0;

  private readonly roundDurationMs: number;
  private remainingRoundTimeMs = 0;

  private stateIteration = 0;

  private roundState: RoundState = RoundState.Finished;

  public iterateRound() {
    const prev = this.stateIteration;
    logger.debug("Iterating round", prev, prev + 1);
    this.stateIteration++;
  }

  get currentWind() {
    return this.wind;
  }

  get remainingRoundTime() {
    return this.remainingRoundTimeMs;
  }

  get isPreRound() {
    return this.roundState === RoundState.Preround;
  }

  get activeTeam() {
    return this.currentTeam;
  }

  constructor(
    teams: Team[],
    private readonly world: GameWorld,
    private readonly rules: GameRules = { winWhenOneGroupRemains: false },
  ) {
    if (teams.length < 1) {
      throw Error("Must have at least one team");
    }
    this.teams = teams.map(
      (team) =>
        new InternalTeam(team, () => {
          this.iterateRound();
        }),
    );
    this.nextTeamStack = [...this.teams];
    this.roundDurationMs = rules.roundDurationMs ?? 45000;
  }

  public pauseTimer() {
    this.roundState = RoundState.Paused;
    this.iterateRound();
  }

  public unpauseTimer() {
    this.roundState = RoundState.Playing;
    this.iterateRound();
  }

  public setTimer(milliseconds: number) {
    this.remainingRoundTimeMs = milliseconds;
  }

  public getTeamByIndex(index: number) {
    return this.teams[index];
  }

  public getTeams() {
    return this.teams;
  }

  public getActiveTeams() {
    return this.teams.filter((t) => t.worms.some((w) => w.health > 0));
  }

  public get iteration(): number {
    return this.stateIteration;
  }

  public get paused() {
    return this.roundState === RoundState.Paused;
  }

  public update(ticker: Ticker) {
    if (
      this.roundState === RoundState.Finished ||
      this.roundState === RoundState.Paused ||
      this.roundState === RoundState.WaitingToBegin
    ) {
      return;
    }
    if (this.remainingRoundTimeMs) {
      this.remainingRoundTimeMs = Math.max(
        0,
        this.remainingRoundTimeMs - ticker.deltaMS,
      );
      return;
    }
    if (this.isPreRound) {
      this.playerMoved();
    } else {
      this.roundState = RoundState.Finished;
    }
  }

  public applyGameStateUpdate(stateUpdate: StateRecordWormGameState["data"]) {
    // TODO: Is this order garunteed?
    let index = -1;
    for (const teamData of stateUpdate.teams) {
      index++;
      const teamWormSet = this.teams[index].worms;
      for (const wormData of teamData.worms) {
        const foundWorm = teamWormSet.find((w) => w.uuid === wormData.uuid);
        if (foundWorm) {
          foundWorm.health = wormData.health;
        }
      }
    }
    const data = this.advanceRound();
    this.wind = stateUpdate.wind;
    return data;
  }

  public playerMoved() {
    this.roundState = RoundState.Playing;
    this.remainingRoundTimeMs = this.roundDurationMs;
  }

  public beginRound() {
    if (this.roundState !== RoundState.WaitingToBegin) {
      throw Error("Expected to be waiting to begin");
    }
    this.roundState = RoundState.Preround;
    this.remainingRoundTimeMs = 5000;
  }

  public advanceRound():
    | { nextTeam: InternalTeam; nextWorm: WormInstance }
    | { winningTeams: InternalTeam[] } {
    logger.debug("Advancing round");
    this.wind = Math.ceil(Math.random() * 20 - 11);
    if (!this.currentTeam) {
      const [firstTeam] = this.nextTeamStack.splice(0, 1);
      this.currentTeam = firstTeam;

      // 5 seconds preround
      this.stateIteration++;
      this.remainingRoundTimeMs = 5000;
      this.roundState = RoundState.WaitingToBegin;

      return {
        nextTeam: this.currentTeam,
        // Team *should* have at least one healthy worm.
        nextWorm: this.currentTeam.popNextWorm(),
      };
    }
    const previousTeam = this.currentTeam;
    this.nextTeamStack.push(previousTeam);

    for (let index = 0; index < this.nextTeamStack.length; index++) {
      const nextTeam = this.nextTeamStack[index];
      if (nextTeam.group === previousTeam.group) {
        continue;
      }
      if (nextTeam.worms.some((w) => w.health > 0)) {
        this.nextTeamStack.splice(index, 1);
        this.currentTeam = nextTeam;
      }
    }
    if (this.rules.winWhenAllObjectsOfTypeDestroyed) {
      const hasEntityRemaining = this.world.entities
        .values()
        .some((s) => s.type === this.rules.winWhenAllObjectsOfTypeDestroyed);
      if (!hasEntityRemaining) {
        logger.debug("Game stopped because type of entity no longer exists");
        return {
          winningTeams: [this.currentTeam],
        };
      } else {
        logger.debug(
          "Game continues because type of entity continues to exist",
        );
      }
    }
    // We wrapped around.
    if (this.currentTeam === previousTeam) {
      this.stateIteration++;
      if (this.rules.winWhenOneGroupRemains) {
        // All remaining teams are part of the same group
        return {
          winningTeams: this.getActiveTeams(),
        };
      } else if (this.currentTeam.health === 0) {
        // This is a draw
        return {
          winningTeams: [],
        };
      }
    }
    this.stateIteration++;
    // 5 seconds preround
    this.remainingRoundTimeMs = 0;
    this.roundState = RoundState.WaitingToBegin;

    return {
      nextTeam: this.currentTeam,
      // We should have already validated that this team has healthy worms.
      nextWorm: this.currentTeam.popNextWorm(),
    };
  }
}
