import { test, expect, describe } from "@jest/globals";
import { GameState, Team, TeamGroup, WormIdentity } from "../../../src/logic/gamestate";

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
    const blueTeam = gameState.getTeamByIndex(1);
    expect(gameState.advanceRound()).toEqual({ nextTeam: blueTeam });
  });
  test('should advance round to the next team, skipping over the same group', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM]);
    const blueTeam = gameState.getTeamByIndex(2);
    expect(gameState.advanceRound()).toEqual({ nextTeam: blueTeam });
  });
  test('should advance round to the next team, should ensure that all teams within the same group get to play', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM]);
    const blueTeam = gameState.getTeamByIndex(2);
    const redTeam2 = gameState.getTeamByIndex(1);
    const redTeam = gameState.getTeamByIndex(0);
    expect(gameState.advanceRound()).toEqual({ nextTeam: blueTeam });
    expect(gameState.advanceRound()).toEqual({ nextTeam: redTeam2 });
    expect(gameState.advanceRound()).toEqual({ nextTeam: blueTeam });
    expect(gameState.advanceRound()).toEqual({ nextTeam: redTeam });
  });
  test('should detect a win when only one group has active worms', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, {...BLUE_TEAM, worms: [DEAD_WORM]}], { winWhenOneGroupRemains: true });
    const redTeam = gameState.getTeamByIndex(0);
    const redTeam2 = gameState.getTeamByIndex(1);
    expect(gameState.advanceRound()).toEqual({ winningTeams: [redTeam, redTeam2] });
  });
});
