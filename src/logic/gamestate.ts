import { TeamInstance, WormInstance } from ".";
import type { TeamDefinition } from "./teams";
import Logger from "../log";
import { EntityType } from "../entities/type";
import { GameWorld } from "../world";
import { IWeaponCode } from "../weapons/weapon";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  merge,
  skip,
} from "rxjs";
import {
  EndTurnTookDamange,
  FireResultHitEnemy,
  FireResultHitOwnTeam,
  FireResultKilledEnemy,
  FireResultKilledEnemyTeam,
  FireResultKilledOwnTeam,
  FireResultKilledSelf,
  FireResultMiss,
  templateRandomText,
} from "../text/toasts";

export interface GameRules {
  roundDurationMs?: number;
  winWhenOneGroupRemains?: boolean;
  winWhenAllObjectsOfTypeDestroyed?: EntityType;
  wormHealth: number;
  ammoSchema: Record<IWeaponCode | string, number>;
}

interface RoundDamageDelta {
  teamsDamaged: Set<string>;
  teamsKilled: Set<string>;
  wormsDamaged: Set<string>;
  wormsKilled: Set<string>;
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
  static getTeamMaxHealth(team: TeamDefinition) {
    return team.worms.map((w) => w.maxHealth).reduce((a, b) => a + b);
  }

  static getTeamHealth(team: TeamDefinition) {
    return team.worms.map((w) => w.health).reduce((a, b) => a + b);
  }

  static getTeamHealthPercentage(team: TeamDefinition) {
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
  protected currentWorm = new BehaviorSubject<WormInstance | undefined>(
    undefined,
  );
  public readonly currentTeam$ = this.currentTeam.asObservable();
  public readonly currentWorm$ = this.currentWorm.asObservable();
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

  protected roundDamageDelta?: RoundDamageDelta;

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
    teams: TeamDefinition[],
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
        iTeam.health$.pipe(skip(1)).subscribe((health) => {
          this.roundDamageDelta?.teamsDamaged.add(team.uuid);
          if (health === 0) {
            this.roundDamageDelta?.teamsKilled.add(team.uuid);
          }
          this.iterateRound();
        });
        return [team.uuid, iTeam];
      }),
    );
    const obs = [...this.teams.values()].flatMap((t) =>
      t.worms.map((w) => w.health$.pipe(map((health) => ({ health, w })))),
    );
    merge(...obs).subscribe(({ health, w }) => {
      if (!this.roundDamageDelta) {
        logger.warning("No round damage delta ready!");
        return;
      }
      logger.info("Updating round health delta");
      if (health === 0) {
        this.roundDamageDelta.teamsKilled.add(w.team.uuid);
      } else {
        this.roundDamageDelta.teamsDamaged.add(w.team.uuid);
        this.roundDamageDelta.wormsDamaged.add(w.uuid);
      }
    });
    if (this.teams.size !== teams.length) {
      throw Error("Team had duplicate uuid, cannot start");
    }
    this.nextTeamStack = [...this.teams.values()];
    this.roundDurationMs = rules.roundDurationMs ?? 45000;
    this.roundState.subscribe((s) =>
      logger.info(`Round state changed => ${s}`),
    );
    this.currentTeam.subscribe((s) =>
      logger.info(`Current team is now => ${s?.name} ${s?.playerUserId}`),
    );
    combineLatest([
      this.remainingRoundTimeSeconds$,
      this.roundState$,
      this.world.entitiesMoving$,
    ])
      .pipe(filter(([seconds]) => seconds === 0))
      .subscribe(([seconds, roundState, moving]) => {
        logger.info("State accumulator", seconds, roundState, moving);
        if (roundState === RoundState.Preround) {
          logger.info("Moving round to playing");
          this.playerMoved();
        } else if (roundState === RoundState.Playing) {
          logger.info("Moving round to finished");
          this.roundState.next(RoundState.Finished);
        }
      });
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
    logger.info("Mark as finished");
    this.roundState.next(RoundState.Finished);
    this.remainingRoundTimeMs.next(0);
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
  }

  public playerMoved() {
    this.remainingRoundTimeMs.next(this.roundDurationMs);
    this.roundState.next(RoundState.Playing);
    logger.debug("playerMoved", this.roundDurationMs);
  }

  public beginRound() {
    if (this.roundState.value !== RoundState.WaitingToBegin) {
      throw Error(
        `Expected round to be WaitingToBegin for advanceRound(), but got ${this.roundState.value}`,
      );
    }
    // It is critical to advance the timer before the state.
    this.remainingRoundTimeMs.next(PREROUND_TIMER_MS);
    this.roundState.next(RoundState.Preround);
    logger.debug("beginRound", PREROUND_TIMER_MS);
  }

  private getToastForRound(): string | undefined {
    if (!this.roundDamageDelta) {
      return;
    }
    if (!this.currentTeam.value || !this.currentWorm.value) {
      throw Error("Expected team to be current for getToastForRound");
    }
    const ownTeam = this.currentTeam.value.uuid;
    const ownWorm = this.currentWorm.value.uuid;
    // Determine how much damage the worm has done.
    // Weapon has hit.
    let randomTextSet: string[];
    const { teamsDamaged, teamsKilled, wormsDamaged, wormsKilled } =
      this.roundDamageDelta;


    if (wormsKilled.has(ownWorm)) {
      randomTextSet = FireResultKilledSelf;
    } else if (teamsKilled.has(ownTeam)) {
      randomTextSet = FireResultKilledOwnTeam;
    } else if (teamsKilled.size) {
      randomTextSet = FireResultKilledEnemyTeam;
    } else if (wormsKilled.size) {
      randomTextSet = FireResultKilledEnemy;
    } else if (wormsDamaged.has(ownWorm)) {
      // Not required, will be caught by turn end.
      randomTextSet = EndTurnTookDamange;
      return;
    } else if (teamsDamaged.has(ownTeam)) {
      randomTextSet = FireResultHitOwnTeam;
    } else if (wormsDamaged.size) {
      randomTextSet = FireResultHitEnemy;
    } else {
      randomTextSet = FireResultMiss;
    }
    return templateRandomText(randomTextSet, {
      WormName: this.currentWorm.value.name,
      TeamName: this.currentTeam.value.name,
      OtherTeams: [...teamsKilled]
        .map((t) => this.teams.get(t)?.name ?? t)
        .join(", "),
    });
  }

  public advanceRound():
    | { nextTeam: TeamInstance; nextWorm: WormInstance; toast?: string }
    | { winningTeams: TeamInstance[]; toast?: string } {
    if (this.roundState.value !== RoundState.Finished) {
      throw Error(
        `Expected round to be Finished for advanceRound(), but got ${this.roundState.value}`,
      );
    }
    logger.debug("Advancing round");
    const toast = this.getToastForRound();
    this.wind = Math.ceil(Math.random() * 20 - 11);
    if (!this.currentTeam.value) {
      const [firstTeam] = this.nextTeamStack.splice(0, 1);
      this.currentTeam.next(firstTeam);
      this.roundDamageDelta = {
        teamsDamaged: new Set(),
        wormsDamaged: new Set(),
        teamsKilled: new Set(),
        wormsKilled: new Set(),
      };

      // 5 seconds preround
      this.stateIteration++;
      const nextWorm = firstTeam.popNextWorm();
      this.roundState.next(RoundState.WaitingToBegin);
      this.currentWorm.next(nextWorm);
      return {
        nextTeam: firstTeam,
        // Team *should* have at least one healthy worm.
        nextWorm: nextWorm,
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
        return {
          winningTeams: this.getActiveTeams(),
        };
      } else if (previousTeam.health === 0) {
        return {
          winningTeams: [],
        };
      }
    }
    this.stateIteration++;
    // 5 seconds preround
    this.remainingRoundTimeMs.next(PREROUND_TIMER_MS);
    const nextWorm = this.currentTeam.value.popNextWorm();
    this.roundState.next(RoundState.WaitingToBegin);
    this.currentWorm.next(nextWorm);
    this.roundDamageDelta = {
      teamsDamaged: new Set(),
      wormsDamaged: new Set(),
      teamsKilled: new Set(),
      wormsKilled: new Set(),
    };
    return {
      nextTeam: this.currentTeam.value,
      // We should have already validated that this team has healthy worms.
      nextWorm: nextWorm,
      toast,
    };
  }
}
