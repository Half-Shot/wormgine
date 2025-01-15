import { InternalTeam, Team, WormInstance } from "./teams";
import type { StateRecordWormGameState } from "../state/model";
import Logger from "../log";
import { EntityType } from "../entities/type";
import { GameWorld } from "../world";
import { IWeaponCode } from "../weapons/weapon";

export interface GameRules {
  roundDurationMs?: number;
  winWhenOneGroupRemains?: boolean;
  winWhenAllObjectsOfTypeDestroyed?: EntityType;
  wormHealth: number;
  ammoSchema: Record<IWeaponCode | string, number>;
}

const logger = new Logger("GameState");

export enum RoundState {
  WaitingToBegin = "waiting_to_begin",
  Preround = "preround",
  Playing = "playing",
  Paused = "paused",
  Finished = "finished",
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

  protected currentTeam?: InternalTeam;
  protected readonly teams: Map<string, InternalTeam>;
  protected nextTeamStack: InternalTeam[];

  /**
   * Wind strength. Integer between -10 and 10.
   */
  protected wind = 0;

  private readonly roundDurationMs: number;
  protected remainingRoundTimeMs = 0;

  private stateIteration = 0;

  protected roundState: RoundState = RoundState.Finished;

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
    private readonly rules: GameRules,
  ) {
    if (teams.length < 1) {
      throw Error("Must have at least one team");
    }
    this.teams = new Map(teams.map(
      (team) =>
        [team.uuid, new InternalTeam(team)],
    ));
    this.nextTeamStack = [...this.teams.values()];
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
  }s

  public getTeams() {
    return [...this.teams.values()];
  }

  public getActiveTeams() {
    return this.getTeams().filter((t) => t.health > 0);
  }

  public get iteration(): number {
    return this.stateIteration;
  }

  public get paused() {
    return this.roundState === RoundState.Paused;
  }

  public markAsFinished() {
    this.roundState = RoundState.Finished;
    this.recordGameStare();
  }

  public update(ticker: { deltaMS: number}) {
    if (
      this.roundState === RoundState.Finished ||
      this.roundState === RoundState.Paused ||
      this.roundState === RoundState.WaitingToBegin
    ) {
      return;
    }
    this.remainingRoundTimeMs = Math.max(
      0,
      this.remainingRoundTimeMs - ticker.deltaMS,
    );
    if (this.remainingRoundTimeMs) {
      return;
    }
    if (this.isPreRound) {
      this.playerMoved();
    } else {
      this.roundState = RoundState.Finished;
      this.recordGameStare();
    }
  }

  public playerMoved() {
    this.roundState = RoundState.Playing;
    this.remainingRoundTimeMs = this.roundDurationMs;
    this.recordGameStare();
  }

  public beginRound() {
    if (this.roundState !== RoundState.WaitingToBegin) {
      throw Error(`Expected round to be WaitingToBegin for advanceRound(), but got ${this.roundState}`);
    }
    this.roundState = RoundState.Preround;
    this.remainingRoundTimeMs = 5000;
    this.recordGameStare();
  }

  public advanceRound():
    | { nextTeam: InternalTeam; nextWorm: WormInstance }
    | { winningTeams: InternalTeam[] } {
    if (this.roundState !== RoundState.Finished) {
      throw Error(`Expected round to be Finished for advanceRound(), but got ${this.roundState}`);
    }
    logger.debug("Advancing round");
    this.wind = Math.ceil(Math.random() * 20 - 11);
    if (!this.currentTeam) {
      const [firstTeam] = this.nextTeamStack.splice(0, 1);
      this.currentTeam = firstTeam;

      // 5 seconds preround
      this.stateIteration++;
      this.roundState = RoundState.WaitingToBegin;

      this.recordGameStare();
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
        this.recordGameStare();
        return {
          winningTeams: this.getActiveTeams(),
        };
      } else if (this.currentTeam.health === 0) {
        // This is a draw
        this.recordGameStare();
        return {
          winningTeams: [],
        };
      }
    }
    this.stateIteration++;
    // 5 seconds preround
    this.remainingRoundTimeMs = 0;
    this.roundState = RoundState.WaitingToBegin;
    this.recordGameStare();
    return {
      nextTeam: this.currentTeam,
      // We should have already validated that this team has healthy worms.
      nextWorm: this.currentTeam.popNextWorm(),
    };
  }

  protected recordGameStare() {
    return;
  }
}