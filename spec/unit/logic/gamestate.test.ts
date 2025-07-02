import { test, expect, describe, afterEach, beforeEach } from "@jest/globals";
import { TeamDefinition, TeamGroup, WormIdentity } from "../../../src/logic/teams";
import { GameRules, GameState, RoundState } from "../../../src/logic/gamestate";
import { GameWorld } from "../../../src/world";
import { DefaultWeaponSchema } from "../../../src/weapons/schema";
import { BehaviorSubject, debounceTime, firstValueFrom, Observable, of } from "rxjs";
import { FireResultHitEnemy, FireResultHitOwnTeam, FireResultKilledEnemy, FireResultKilledEnemyTeam, FireResultKilledOwnTeam, templateRandomText, templateText } from "../../../src/text/toasts";
import { PREROUND_TIMER_MS } from "../../../src/consts";
import { TeamInstance } from "../../../src/logic";

const DEAD_WORM: WormIdentity = {
  name: "fishbait",
  health: 0,
  maxHealth: 100,
}

const RED_TEAM: TeamDefinition = {
  name: "Lovely Reds",
  group: TeamGroup.Red,
  worms: [{
    name: "Diabolical Steve",
    health: 25,
    maxHealth: 100,
  }, {
    name: "Generous Greggory",
    health: 25,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: null,
  uuid: "red",
}

const RED_TEAM_2: TeamDefinition = {
  name: "Passed over Reds",
  group: TeamGroup.Red,
  worms: [{
    name: "Unlucky dave",
    health: 100,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: null,
  uuid: "red2",
}

const BLUE_TEAM: TeamDefinition = {
  name: "Melodramatic Blues",
  group: TeamGroup.Blue,
  worms: [{
    name: "Swansong Stella",
    health: 75,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: null,
  uuid: "blue",
}
const YELLOW_TEAM: TeamDefinition = {
  name: "Sickly Yellows",
  group: TeamGroup.Yellow,
  worms: [{
    name: "Flu-y Florence",
    health: 75,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: null,
  uuid: "yellow",
}

const DefaultRules: Omit<Required<GameRules>, "winWhenAllObjectsOfTypeDestroyed"> = {
  winWhenOneGroupRemains: true,
  wormHealth: 100,
  ammoSchema: DefaultWeaponSchema,
  roundDurationMs: 45000,
  roundTransitionDelayMs: 50,
};





function getFinalValue<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(observable.pipe(debounceTime(250)));
}

describe('GameState', () => {
  test('requires at least one team', () => {
    expect(() => new GameState([], { entitiesMoving$: of(false) } as Partial<GameWorld> as GameWorld, DefaultRules)).toThrow();
  });
  test('should be able to get active teams', async () => {
    const gameState = new GameState([RED_TEAM, { ...BLUE_TEAM, worms: [DEAD_WORM] }], { entitiesMoving$: of(false) } as Partial<GameWorld> as GameWorld, DefaultRules);
    const teams = gameState.getActiveTeams();
    expect(teams).toHaveLength(1);
  });

  describe('Round progression', () => {
    let gameState: GameState;
    let entitiesMoving: BehaviorSubject<boolean>;

    /**
     * Mock a complete test round.
     * @param gameState 
     * @returns 
     */
    function completeRound(gameState: GameState) {
      const round = gameState.advanceRound();
      gameState.beginRound();
      entitiesMoving.next(true);
      gameState.markAsFinished();
      // Don't return toast.
      delete round.toast;
      return round;
    }


    beforeEach(() => {
      entitiesMoving = new BehaviorSubject(false);
    })

    afterEach(() => {
      gameState.stop();
    })

    test('should advance round to the next team', () => {
      gameState = new GameState([RED_TEAM, BLUE_TEAM], { entitiesMoving$: entitiesMoving } as Partial<GameWorld> as GameWorld, DefaultRules);
      const [redTeam, blueTeam] = gameState.getActiveTeams();
      gameState.begin();
      expect(completeRound(gameState)).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
      expect(completeRound(gameState)).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
    });
    test('should advance round to the next team, skipping over the same group', () => {
      gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM], { entitiesMoving$: entitiesMoving } as Partial<GameWorld> as GameWorld, DefaultRules);
      const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
      gameState.begin();
      expect(completeRound(gameState)).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
      expect(completeRound(gameState)).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
      expect(completeRound(gameState)).toEqual({ nextTeam: redTeam2, nextWorm: redTeam2.worms[0] });
    });
    test('should advance round to the next team, should ensure that all teams within the same group get to play', () => {
      gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM], { entitiesMoving$: entitiesMoving } as Partial<GameWorld> as GameWorld, DefaultRules);
      const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
      gameState.begin();
      expect(completeRound(gameState)).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
      expect(completeRound(gameState)).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
      expect(completeRound(gameState)).toEqual({ nextTeam: redTeam2, nextWorm: redTeam2.worms[0] });
      expect(completeRound(gameState)).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
      expect(completeRound(gameState)).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[1] });
    });
    test('should detect a win when only one group has active worms', () => {
      gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM], { entitiesMoving$: entitiesMoving } as Partial<GameWorld> as GameWorld, { winWhenOneGroupRemains: true, wormHealth: 100, ammoSchema: DefaultWeaponSchema });
      const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
      gameState.begin();
      completeRound(gameState);
      // Kill the blues.
      blueTeam.worms[0].setHealth(0);
      expect(gameState.advanceRound()).toEqual({ winningTeams: [redTeam, redTeam2] });
    });

    test('should handle the first round', async () => {
      gameState = new GameState([RED_TEAM, BLUE_TEAM], { entitiesMoving$: entitiesMoving } as Partial<GameWorld> as GameWorld, DefaultRules);
      gameState.begin();
      gameState.advanceRound();
      expect(gameState.iteration).toEqual(1);
      // Not in preround yet.
      expect(gameState.isPreRound).toEqual(false);
      gameState.beginRound();
      expect(gameState.isPreRound).toEqual(true);
      expect(await getFinalValue(gameState.remainingRoundTimeSeconds$)).toEqual(5);
    });

    test('should handle the player moving during preround', async () => {
      gameState = new GameState([RED_TEAM, BLUE_TEAM], { entitiesMoving$: entitiesMoving } as Partial<GameWorld> as GameWorld, DefaultRules);
      gameState.begin();
      gameState.advanceRound();
      expect(gameState.iteration).toEqual(1);
      gameState.beginRound();
      entitiesMoving.next(true);
      expect(await getFinalValue(gameState.roundState$)).toEqual(RoundState.Playing);
      expect(gameState.paused).toEqual(false);
      expect(await getFinalValue(gameState.remainingRoundTimeSeconds$)).toEqual(DefaultRules.roundDurationMs / 1000);
    });

    test('should handle preround timing out',async  () => {
      gameState = new GameState([RED_TEAM, BLUE_TEAM], {
        entitiesMoving$: of(false),
      } as Partial<GameWorld> as any, DefaultRules);
      gameState.begin();
      gameState.advanceRound();
      expect(gameState.iteration).toEqual(1);
      gameState.beginRound();
      for (let index = 0; index < 5; index++) {
        gameState.update({ deltaMS: 1000 });
      }
      expect(await getFinalValue(gameState.remainingRoundTimeSeconds$)).toEqual(45);
      expect(gameState.isPreRound).toEqual(false);
      expect(gameState.paused).toEqual(false);
    });

    test('should handle round finishing due to timeout', async () => {
      gameState = new GameState([RED_TEAM, BLUE_TEAM], { entitiesMoving$: entitiesMoving } as Partial<GameWorld> as GameWorld, DefaultRules);
      const [_redTeam, blueTeam] = gameState.getActiveTeams();
      gameState.begin();
      gameState.advanceRound();
      expect(gameState.iteration).toEqual(1);
      gameState.beginRound();
      for (let index = 0; index < 5; index++) {
        gameState.update({ deltaMS: 1000 });
      }
      expect(await getFinalValue(gameState.remainingRoundTimeSeconds$)).toEqual(DefaultRules.roundDurationMs / 1000);
      expect(gameState.isPreRound).toEqual(false);
      expect(gameState.paused).toEqual(false);
      for (let index = 0; index < DefaultRules.roundDurationMs / 100; index++) {
        gameState.update({ deltaMS: 100 });
      }
      expect(await getFinalValue(gameState.roundState$)).toEqual(RoundState.Finished);
      const state = gameState.advanceRound();
      expect(await getFinalValue(gameState.remainingRoundTimeSeconds$)).toEqual(PREROUND_TIMER_MS / 1000);
      if ('winningTeams' in state) {
        throw Error('Unexpected win');
      }
      const { nextTeam, nextWorm } = state;
      expect(nextTeam).toEqual(blueTeam);
      expect(nextWorm).toEqual(blueTeam.worms[0]);
    });
  });
  describe('Toast calculation', () => {
    let gameState: GameState;
    let redTeam: TeamInstance;
    let blueTeam: TeamInstance;
  
    beforeEach(() => {
      const world = { entitiesMoving$: of(false) } as Partial<GameWorld> as GameWorld;
      gameState = new GameState([RED_TEAM, BLUE_TEAM, YELLOW_TEAM], world, DefaultRules);
      gameState.begin();
      const teams = gameState.getActiveTeams();
      redTeam = teams[0];
      blueTeam = teams[1];
      gameState.advanceRound();
      gameState.beginRound();
      gameState.markAsFinished();
    })

    afterEach(() => {
      gameState.stop();
    })

    test('should show correct toast when the enemy was hit', () => {
      blueTeam.worms[0].setHealth(50);

      const { toast } = gameState.advanceRound();
      expect(FireResultHitEnemy.map(v => templateText(v, {
        WormName: redTeam.worms[0].name,
        TeamName: redTeam.name,
      }))).toContain(toast);
    });
    test('should show correct toast when the team hits itself', () => {
      redTeam.worms[1].setHealth(10);
      const { toast } = gameState.advanceRound();
      expect(FireResultHitOwnTeam.map(v => templateText(v, {
        WormName: redTeam.worms[0].name,
        TeamName: redTeam.name,
      }))).toContain(toast);
    });
    test('should show correct toast when the team kills itself', () => {
      redTeam.worms[1].setHealth(0);
      const { toast } = gameState.advanceRound();
      expect(FireResultKilledOwnTeam.map(v => templateText(v, {
        WormName: redTeam.worms[0].name,
        TeamName: redTeam.name,
      }))).toContain(toast);
    });
    test('should show correct toast when an enemy team is killed', () => {
      blueTeam.worms[0].setHealth(0);
      const { toast } = gameState.advanceRound();
      expect(FireResultKilledEnemyTeam.map(v => templateText(v, {
        WormName: redTeam.worms[0].name,
        OtherTeams: blueTeam.name,
      }))).toContain(toast);
    });
  });
});
