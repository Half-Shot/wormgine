# Net protocol

> Note, some of these aspects are currently aspirational in nature. Anything not implemented or diverges from the
> ideal is documented as a footnote.

The networking engine for this game uses [Matrix](https://matrix.org). Each player has one Matrix account.
Each game is tied to a particular Matrix room, which does the following:

- Contains the set of players for the game, represented as members.
- Spectators can join and watch the game simply by joining the room.
- There will be a hard cap on teams by default (8), although this could be extended.
- The game configuration is stored in room state (`uk.half-shot.wormgine.game_config`)
- The game map is stored in the content repository as a `.tiled` map file and bitmap.[^1]

Power levels are used to determine who can change the game state. With the exception of proposing teams,
players may not alter this state.

## Game sequence.

The sequence of events for a game is as follows.

1. A new room is created.
2. Players join the room.
3. Players propose new teams via `uk.half-shot.uk.wormgine.proposed_team`
4. The game host may alter the game rules.
5. The game host starts the game by sending a `uk.half-shot.uk.wormgine.game_stage` `in_progress` event.
6. The players load in, the host waits for them all to send a `uk.half-shot.uk.wormgine.ready`.
7. The game proceeds, using `uk.half-shot.wormgine.game_action` to keep players in sync.
   - The next player (starting with the host) sends a `game_state` action for `RoundState.WaitingToBegin`
   - The player then sends a `preround` signal to note the player will now begin their turn.
   - The player moves or times out, and the `playing` signal is sent.
   - Entity updates are sent via `uk.half-shot.wormgine.game_state` updates.
   - The player finishes their turn with a `finished` signal.
   - The game either finishes if there is a winner, or the next team is selected.
8. The last player sends a `uk.half-shot.uk.wormgine.game_stage` `completed` and clients
   display the end of game lobby[^2]

Extra details:

- If a player leaves the room, their teams are automatically dropped.[^3]

## Instances

`kcore.half-shot.uk` is currently run by me (Half-Shot) and is dedicated to the project.

## Deployment notes

The Matrix server needs to allow for fairly high volumes of messages. I suspect rather than having a harsh ratelimit, it would be prudent to look at
limiting users who stress the server out over a longer period of time.

[^1]: Currently the project is hardcoded to one test map.

[^2]: Currently, games do not end.

[^3]: This is not implemented.
