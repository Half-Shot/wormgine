import { test, expect, describe } from "@jest/globals";
import { Team, TeamGroup, WormIdentity } from "../../../src/logic/teams";
import { GameState } from "../../../src/logic/gamestate";

const DEAD_WORM: WormIdentity = {
  name: "fishbait",
  health: 0,
  maxHealth: 100,
}

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
  }]
}

const RED_TEAM_2: Team = {
  name: "Passed over Reds",
  group: TeamGroup.Red,
  worms: [{
    name: "Unlucky dave",
    health: 100,
    maxHealth: 100,
  }]
}

const BLUE_TEAM: Team = {
  name: "Melodramatic Blues",
  group: TeamGroup.Blue,
  worms: [{
    name: "Swansong Stella",
    health: 75,
    maxHealth: 100,
  }]
}

describe('GameState', () => {
  test('requires at least one team', () => {
    expect(() => new GameState([])).toThrow();
  });
  test('should be able to get active teams', () => {
    const gameState = new GameState([RED_TEAM, {...BLUE_TEAM, worms: [DEAD_WORM]}]);
    const redTeam = gameState.getTeamByIndex(0);
    const teams = gameState.getActiveTeams();
    expect(teams).toEqual([redTeam]);
  });
  test('should advance round to the next team', () => {
    const gameState = new GameState([RED_TEAM, BLUE_TEAM]);
    const [redTeam, blueTeam] = gameState.getActiveTeams();
    expect(gameState.advanceRound()).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
    expect(gameState.advanceRound()).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
  });
  test('should advance round to the next team, skipping over the same group', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM]);
    const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
    expect(gameState.advanceRound()).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
    expect(gameState.advanceRound()).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
    expect(gameState.advanceRound()).toEqual({ nextTeam: redTeam2, nextWorm: redTeam2.worms[0] });
  });
  test('should advance round to the next team, should ensure that all teams within the same group get to play', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM]);
    const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
    expect(gameState.advanceRound()).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
    expect(gameState.advanceRound()).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
    expect(gameState.advanceRound()).toEqual({ nextTeam: redTeam2, nextWorm: redTeam2.worms[0] });
    expect(gameState.advanceRound()).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
    expect(gameState.advanceRound()).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[1] });
  });
  test('should detect a win when only one group has active worms', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM], { winWhenOneGroupRemains: true });
    const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
    gameState.advanceRound();
    // Kill the blues.
    blueTeam.worms[0].health = 0;
    expect(gameState.advanceRound()).toEqual({ winningTeams: [redTeam, redTeam2] });
  });
});
