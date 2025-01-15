import { test, expect, describe } from "@jest/globals";
import { Team, TeamGroup, WormIdentity } from "../../../src/logic/teams";
import { GameRules, GameState } from "../../../src/logic/gamestate";
import { GameWorld } from "../../../src/world";
import { DefaultWeaponSchema } from "../../../src/weapons/schema";
import { NetGameState } from "../../../src/net/netGameState";
import { StateRecorder, StateRecorderStore } from "../../../src/state/recorder";
import { StateRecordLine, StateRecordWormGameState } from "../../../src/state/model";
import { TypedEventEmitter } from "matrix-js-sdk";
import { EventEmitter } from "pixi.js";

const DEAD_WORM: WormIdentity = {
  name: "fishbait",
  health: 0,
  maxHealth: 100,
}

const playerHost = "@one:example.org";
const playerTwo = "@two:example.org";
const playerThree = "@three:example.org";

const RED_TEAM: Team = {
  name: "Lovely Reds",
  group: TeamGroup.Red,
  worms: [{
    name: "Diabolical Steve",
    health: 25,
    maxHealth: 100,
  },{
    name: "Generous Greggory",
    health: 25,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: playerHost,
  uuid: 'red',
}


const BLUE_TEAM: Team = {
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

const GREEN_TEAM: Team = {
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

/**
 * Mock a complete test round.
 * @param gameState 
 * @returns 
 */
function completeRound(gameState: GameState) {
  const round = gameState.advanceRound();
  gameState.beginRound();
  gameState.playerMoved();
  gameState.markAsFinished();
  return round;
}

class TestRecorderStore extends EventEmitter<{
    data: (data: StateRecordLine) => void;
}> implements StateRecorderStore {
    async writeLine(data: StateRecordLine): Promise<void> {
        this.emit('data', data);
    }

}

function createEnvironment() {
    const recorderStoreOne = new TestRecorderStore();
    const recorderStoreTwo = new TestRecorderStore();
    const recorderStoreThree = new TestRecorderStore();
    const stateOne = new NetGameState([{...RED_TEAM}, {...BLUE_TEAM}, {...GREEN_TEAM}], { } as any, {...DefaultRules}, new StateRecorder(recorderStoreOne), playerHost);
    const stateTwo = new NetGameState([{...RED_TEAM}, {...BLUE_TEAM}, {...GREEN_TEAM}], { } as any, {...DefaultRules}, new StateRecorder(recorderStoreTwo), playerTwo);
    const stateThree = new NetGameState([{...RED_TEAM}, {...BLUE_TEAM}, {...GREEN_TEAM}], { } as any, {...DefaultRules}, new StateRecorder(recorderStoreThree), playerThree);

    recorderStoreOne.on('data', (d) => {
        // N.B: This needs filtering out in a different layer in runtime.
        // stateOne.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
        stateTwo.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
        stateThree.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    });
    recorderStoreTwo.on('data', (d) => {
        stateOne.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
        // stateTwo.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
        stateThree.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    });
    recorderStoreThree.on('data', (d) => {
        stateOne.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
        stateTwo.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
        // stateThree.applyGameStateUpdate(d.data as StateRecordWormGameState["data"]);
    });

    return [
        {gameState: stateOne, store: recorderStoreOne},
        {gameState: stateTwo, store: recorderStoreTwo},
        {gameState: stateThree, store: recorderStoreThree}
    ];
}

describe('NetGameState', () => {
  test('should send state', () => {
    const [one, two, three] = createEnvironment();
    one.gameState.advanceRound();
    one.gameState.beginRound();
    one.gameState.playerMoved();
    one.gameState.markAsFinished();
    // TODO: How does player two know to go next?
    two.gameState.advanceRound();
    two.gameState.beginRound();
    two.gameState.playerMoved();
    two.gameState.markAsFinished();
    three.gameState.advanceRound();
    three.gameState.beginRound();
    three.gameState.playerMoved();
    three.gameState.markAsFinished();
    one.gameState.advanceRound();
    one.gameState.beginRound();
    one.gameState.playerMoved();
    one.gameState.markAsFinished();
  });
});
