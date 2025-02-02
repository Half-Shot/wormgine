import { BehaviorSubject, map, Observable, of } from "rxjs";
import { GameRules } from "./gamestate";
import { StoredTeam } from "../settings";
import { Team, TeamGroup, WormIdentity } from "./teams";
import { DefaultWeaponSchema } from "../weapons/schema";
import { StateRecordLine } from "../state/model";

export enum GameStage {
  Lobby = "lobby",
  InProgress = "in_progress",
  Finished = "completed",
}

export interface ProposedTeam extends StoredTeam {
  playerUserId: string;
  group: TeamGroup;
  wormCount: number;
}

export interface IGameInstance {
  canAlterTeam(t: ProposedTeam): boolean;
  updateProposedTeam(
    t: ProposedTeam,
    updates: { wormCount?: number; teamGroup?: TeamGroup },
  ): Promise<unknown>;
  removeProposedTeam(team: ProposedTeam): Promise<unknown>;
  addProposedTeam(
    team: StoredTeam,
    maxWorms: number,
    teamGroup: TeamGroup,
  ): Promise<unknown>;
  startGame(): void;
  exitGame(): void;
  members: Observable<Record<string, string>>;
  stage: Observable<GameStage>;
  proposedRules: Observable<GameRules>;
  proposedTeams: Observable<ProposedTeam[]>;
  isHost: boolean;
  hostUserId: string;
  myUserId: string;
}

export interface IRunningGameInstance extends IGameInstance {
  writeAction(data: StateRecordLine<Record<string, unknown>>): unknown;
  gameConfigImmediate: { teams: Team[]; rules: GameRules };
}

export class LocalGameInstance implements IRunningGameInstance {
  public readonly isHost = true;
  public readonly hostUserId = "me";
  public readonly myUserId = "me";
  private readonly _stage: BehaviorSubject<GameStage>;
  public readonly stage: Observable<GameStage>;
  public members: Observable<Record<string, string>>;
  private readonly _proposedTeams: BehaviorSubject<
    Record<string, ProposedTeam>
  >;
  public readonly proposedTeams: Observable<ProposedTeam[]>;
  private readonly _rules: BehaviorSubject<GameRules>;
  public readonly proposedRules: Observable<GameRules>;

  // TODO: This is probably a bit gross. We set this once.
  public finalTeams!: Team[];

  constructor() {
    this.members = of({ [this.hostUserId]: "Me" });
    // TODO: Odd types?
    this._stage = new BehaviorSubject(GameStage.Lobby as GameStage);
    this.stage = this._stage.asObservable();
    this._rules = new BehaviorSubject({
      wormHealth: 100,
      winWhenOneGroupRemains: true,
      ammoSchema: DefaultWeaponSchema,
    } as GameRules);
    this.proposedRules = this._rules.asObservable();
    // TODO: If the player doesn't have any teams, bake some in for them.
    this._proposedTeams = new BehaviorSubject({});
    this.proposedTeams = this._proposedTeams.pipe(map((v) => Object.values(v)));
  }

  public get gameConfigImmediate() {
    return {
      rules: this._rules.value,
      teams: this.finalTeams,
    };
  }

  canAlterTeam(): true {
    return true;
  }

  async updateProposedTeam(
    t: ProposedTeam,
    updates: { wormCount?: number; teamGroup?: TeamGroup },
  ): Promise<void> {
    if (updates.teamGroup) {
      t.group = updates.teamGroup;
    }
    if (updates.wormCount) {
      t.wormCount = updates.wormCount;
    }
    this._proposedTeams.next({
      ...this._proposedTeams.value,
      [t.uuid]: t,
    });
  }

  async removeProposedTeam(team: ProposedTeam): Promise<void> {
    this._proposedTeams.next(
      Object.fromEntries(
        Object.entries(this._proposedTeams.value).filter(
          ([k]) => k !== team.uuid,
        ),
      ),
    );
  }

  async addProposedTeam(
    team: StoredTeam,
    wormCount: number,
    group: TeamGroup,
  ): Promise<void> {
    this._proposedTeams.next({
      ...this._proposedTeams.value,
      [team.uuid]: {
        ...team,
        group,
        wormCount,
        playerUserId: this.hostUserId,
      } as ProposedTeam,
    });
  }

  startGame() {
    this.finalTeams = Object.values(this._proposedTeams.value).map((v) => ({
      name: v.name,
      flag: v.flagb64,
      group: v.group,
      playerUserId: v.playerUserId,
      uuid: v.uuid,
      // Needs to come from rules.
      ammo: this._rules.value.ammoSchema,
      worms: v.worms.slice(0, v.wormCount).map(
        (w) =>
          ({
            name: w,
            health: this._rules.value.wormHealth,
            maxHealth: this._rules.value.wormHealth,
            uuid: globalThis.crypto.randomUUID(),
          }) satisfies WormIdentity,
      ),
    }));
    this._stage.next(GameStage.InProgress);
  }

  exitGame() {
    // Do nothing.
  }

  writeAction() {
    // Do nothing
  }
}
