import { test, describe } from "@jest/globals";
import { TeamDefinition, TeamGroup, WormIdentity } from "../../../src/logic/teams";
import { GameRules, GameState } from "../../../src/logic/gamestate";
import { DefaultWeaponSchema } from "../../../src/weapons/schema";
import { NetGameState } from "../../../src/net/netGameState";
import { StateRecorder, StateRecorderStore } from "../../../src/state/recorder";
import { StateRecordLine, StateRecordWormGameState } from "../../../src/state/model";
import { EventEmitter } from "pixi.js";
import { GameWorld } from "../../../src/world";
import { BehaviorSubject, of } from "rxjs";

const DEAD_WORM: WormIdentity = {
  name: "fishbait",
  health: 0,
  maxHealth: 100,
}

const playerHost = "@one:example.org";
const playerTwo = "@two:example.org";
const playerThree = "@three:example.org";

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
  playerUserId: playerHost,
  uuid: 'red',
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
  playerUserId: playerTwo,
  uuid: 'blue',
}

const GREEN_TEAM: TeamDefinition = {
  name: "Grand Greens",
  group: TeamGroup.Green,
  worms: [{
    name: "Unlucky dave",
    health: 100,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: playerThree,
  uuid: 'green',
}

const DefaultRules: GameRules = {
  winWhenOneGroupRemains: true,
  wormHealth: 100,
  ammoSchema: DefaultWeaponSchema,
  roundDurationMs: 45000,
};


class TestRecorderStore extends EventEmitter<{
  data: (data: StateRecordLine) => void;
}> implements StateRecorderStore {
  async writeLine(data: StateRecordLine): Promise<void> {
    this.emit('data', data);
  }

}


function createEnvironment(playerId: string) {
  const recorderStore = new TestRecorderStore();
  const entitiesMoving = new BehaviorSubject(false);

  const world = {
    entitiesMoving$: entitiesMoving,
  } as Partial<GameWorld> as GameWorld;
  const gameState = new NetGameState([{ ...RED_TEAM }, { ...BLUE_TEAM }, { ...GREEN_TEAM }], world, { ...DefaultRules }, new StateRecorder(recorderStore), playerId);
  gameState.begin();
  return { recorderStore, entitiesMoving, gameState }
}

function createEnvironments(): ReturnType<typeof createEnvironment>[] {
  const one = createEnvironment(playerHost);
  const two = createEnvironment(playerTwo);
  const three = createEnvironment(playerThree);

  one.recorderStore.on('data', (d) => {
    // N.B: This needs filtering out in a different layer in runtime.
    // stateOne.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    two.gameState.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    three.gameState.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
  });
  two.recorderStore.on('data', (d) => {
    one.gameState.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    // stateTwo.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    two.gameState.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
  });
  three.recorderStore.on('data', (d) => {
    one.gameState.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    two.gameState.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    // stateThree.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
  });

  return [
    one,
    two,
    three
  ];
}

// TODO: Needs reworking
describe.skip('NetGameState', () => {
  test('should send state', () => {
    const [one, two, three] = createEnvironments();
    one.gameState.advanceRound();
    one.gameState.beginRound();
    one.gameState.markAsFinished();
    // TODO: How does player two know to go next?
    two.gameState.advanceRound();
    two.gameState.beginRound();
    two.gameState.markAsFinished();
    three.gameState.advanceRound();
    three.gameState.beginRound();
    three.gameState.markAsFinished();
    one.gameState.advanceRound();
    one.gameState.beginRound();
    one.gameState.markAsFinished();

    one.gameState.stop();
    two.gameState.stop();
    three.gameState.stop();
  });
});
