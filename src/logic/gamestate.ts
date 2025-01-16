import { TeamInstance, Team, WormInstance } from "./teams";
import Logger from "../log";
import { EntityType } from "../entities/type";
import { GameWorld } from "../world";
import { IWeaponCode } from "../weapons/weapon";
import { BehaviorSubject, distinctUntilChanged, map, skip } from "rxjs";

export interface GameRules {
  roundDurationMs?: number;
  winWhenOneGroupRemains?: boolean;
  winWhenAllObjectsOfTypeDestroyed?: EntityType;
  wormHealth: number;
  ammoSchema: Record<IWeaponCode | string, number>;
}

export enum RoundState {
  WaitingToBegin = "waiting_to_begin",
  Preround = "preround",
  Playing = "playing",
  Paused = "paused",
  Finished = "finished",
}

const PREROUND_TIMER_MS = 5000;

const logger = new Logger("GameState");

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

  protected currentTeam = new BehaviorSubject<TeamInstance | undefined>(
    undefined,
  );
  public readonly currentTeam$ = this.currentTeam.asObservable();
  protected readonly teams: Map<string, TeamInstance>;
  protected nextTeamStack: TeamInstance[];

  /**
   * Wind strength. Integer between -10 and 10.
   */
  protected wind = 0;

  private readonly roundDurationMs: number;
  protected remainingRoundTimeMs = new BehaviorSubject<number>(0);
  public readonly remainingRoundTimeSeconds$ = this.remainingRoundTimeMs.pipe(
    map((v) => Math.ceil(v / 1000)),
    distinctUntilChanged(),
  );

  private stateIteration = 0;

  protected roundState = new BehaviorSubject<RoundState>(RoundState.Finished);
  public readonly roundState$ = this.roundState.asObservable();

  public iterateRound() {
    const prev = this.stateIteration;
    logger.debug("Iterating round", prev, prev + 1);
    this.stateIteration++;
  }

  get currentWind() {
    return this.wind;
  }

  get remainingRoundTime() {
    return this.remainingRoundTimeMs.value;
  }

  get isPreRound() {
    return this.roundState.value === RoundState.Preround;
  }

  /**
   * Use `this.currentTeam`
   * @deprecated
   */
  get activeTeam() {
    return this.currentTeam.value;
  }

  constructor(
    teams: Team[],
    private readonly world: GameWorld,
    private readonly rules: GameRules,
  ) {
    if (teams.length < 1) {
      throw Error("Must have at least one team");
    }
    this.teams = new Map(
      teams.map((team) => {
        const iTeam = new TeamInstance(team);
        // N.B. Skip the first health update.
        iTeam.health$.pipe(skip(1)).subscribe(() => this.iterateRound());
        return [team.uuid, iTeam];
      }),
    );
    if (this.teams.size !== teams.length) {
      throw Error("Team had duplicate uuid, cannot start");
    }
    this.nextTeamStack = [...this.teams.values()];
    this.roundDurationMs = rules.roundDurationMs ?? 45000;
  }

  public pauseTimer() {
    this.roundState.next(RoundState.Paused);
    this.iterateRound();
  }

  public unpauseTimer() {
    this.roundState.next(RoundState.Playing);
    this.iterateRound();
  }

  public setTimer(milliseconds: number) {
    logger.debug("setTimer", milliseconds);
    this.remainingRoundTimeMs.next(milliseconds);
  }

  public getTeams() {
    return [...this.teams.values()];
  }

  public getActiveTeams() {
    return this.getTeams().filter((t) => t.health > 0);
  }

  public get iteration(): number {
    return this.stateIteration;
  }

  /**
   * @deprecated Use `this.roundState$`
   */
  public get paused() {
    return this.roundState.value === RoundState.Paused;
  }

  public markAsFinished() {
    this.roundState.next(RoundState.Finished);
    this.recordGameStare();
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
    if (roundState === RoundState.Preround) {
      this.playerMoved();
    } else {
      this.roundState.next(RoundState.Finished);
      this.recordGameStare();
    }
  }

  public playerMoved() {
    this.roundState.next(RoundState.Playing);
    logger.debug("playerMoved", this.roundDurationMs);
    this.remainingRoundTimeMs.next(this.roundDurationMs);
    this.recordGameStare();
  }

  public beginRound() {
    if (this.roundState.value !== RoundState.WaitingToBegin) {
      throw Error(
        `Expected round to be WaitingToBegin for advanceRound(), but got ${this.roundState}`,
      );
    }
    this.roundState.next(RoundState.Preround);
    logger.debug("beginRound", PREROUND_TIMER_MS);
    this.remainingRoundTimeMs.next(PREROUND_TIMER_MS);
    this.recordGameStare();
  }

  public advanceRound():
    | { nextTeam: TeamInstance; nextWorm: WormInstance }
    | { winningTeams: TeamInstance[] } {
    if (this.roundState.value !== RoundState.Finished) {
      throw Error(
        `Expected round to be Finished for advanceRound(), but got ${this.roundState}`,
      );
    }
    logger.debug("Advancing round");
    this.wind = Math.ceil(Math.random() * 20 - 11);
    if (!this.currentTeam.value) {
      const [firstTeam] = this.nextTeamStack.splice(0, 1);
      this.currentTeam.next(firstTeam);

      // 5 seconds preround
      this.stateIteration++;
      this.roundState.next(RoundState.WaitingToBegin);

      this.recordGameStare();
      return {
        nextTeam: firstTeam,
        // Team *should* have at least one healthy worm.
        nextWorm: firstTeam.popNextWorm(),
      };
    }
    const previousTeam = this.currentTeam.value;
    this.nextTeamStack.push(previousTeam);

    for (let index = 0; index < this.nextTeamStack.length; index++) {
      const nextTeam = this.nextTeamStack[index];
      if (nextTeam.group === previousTeam.group) {
        continue;
      }
      if (nextTeam.health > 0) {
        this.nextTeamStack.splice(index, 1);
        this.currentTeam.next(nextTeam);
      }
    }
    if (this.rules.winWhenAllObjectsOfTypeDestroyed) {
      const hasEntityRemaining = this.world.entities
        .values()
        .some((s) => s.type === this.rules.winWhenAllObjectsOfTypeDestroyed);
      if (!hasEntityRemaining) {
        logger.debug("Game stopped because type of entity no longer exists");
        return {
          winningTeams: [previousTeam],
        };
      } else {
        logger.debug(
          "Game continues because type of entity continues to exist",
        );
      }
    }
    // We wrapped around.
    if (this.currentTeam.value === previousTeam) {
      this.stateIteration++;
      if (this.rules.winWhenOneGroupRemains) {
        // All remaining teams are part of the same group
        this.recordGameStare();
        return {
          winningTeams: this.getActiveTeams(),
        };
      } else if (previousTeam.health === 0) {
        // This is a draw
        this.recordGameStare();
        return {
          winningTeams: [],
        };
      }
    }
    this.stateIteration++;
    // 5 seconds preround
    this.remainingRoundTimeMs.next(0);
    this.roundState.next(RoundState.WaitingToBegin);
    this.recordGameStare();
    return {
      nextTeam: this.currentTeam.value,
      // We should have already validated that this team has healthy worms.
      nextWorm: this.currentTeam.value.popNextWorm(),
    };
  }

  protected recordGameStare() {
    return;
  }
}
