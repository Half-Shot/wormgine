### Net protocol

So the main aspect of this is that each player is tied to a Matrix account. I'll probably set up a wormy.half-shot.uk Matrix server,
for users to obtain a profile for. 

Each game is tied to a particular Matrix room, which does the following:

 - Contains a set of players, using `m.room.message` for chat functionality.
 - Spectators can join the game simply by joining the room.
 - There will be a hard cap on teams by default (8), although this could be extended.
 - The game configuration is stored in room state (`uk.half-shot.uk.wormgine.game_config`)
 - The game map is stored in the content repository as a PNG.
 - The game entity state / placement is stored in the yet-to-be-defined JSON file in the content repository.

Power levels are used to determine who can change the game state, by default this is only the
owner.

To start the game, the admin will send a `uk.half-shot.uk.wormgine.start` event which will trigger all the clients
to begin a load sequence. Once everyone has loaded in, they will reply to the even with a `uk.half-shot.uk.wormgine.loaded`
event.

Then, the admin of the game takes over arbitrating the round. The sequence is roughly as follows:

 - `uk.half-shot.uk.wormgine.game_state` -> new round, full copy of all entity states.
 - `uk.half-shot.uk.wormgine.ack` -> is sent by the player who's turn it is. If they take longer than 10 seconds to respond, their turn is forfeit.
 - `uk.half-shot.uk.wormgine.control` -> the active player will send control events to move their worm.
 - (The game will simulate a controller being pressed, the worm state should be synced up)
 - `uk.half-shot.uk.wormgine.bitmap` -> updated area of the bitmap whenever damage is dealt to it, encoded as b64.
 - Once the player has taken their turn, the logic rotates and a new round has begun.

Extra details:

 - 
 - If a player leaves the room, their teams are automatically dropped.
 - If there is a win or a draw, the game ends with a final `uk.half-shot.uk.wormgine.game_state` before being dumped back into the lobby.
 - A new `uk.half-shot.uk.wormgine.start` can be issued to start another game.
