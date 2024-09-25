wormgine
--------

*Everything, including the name is subject to change.*

This project started off as an attempt to clone Worms Armageddon for the browser,
however for a few reasons the plan has changed. This will hopefully be an entirely
new game on the same foundations but with a different gameplay focus.

## Requirements

Right now, the game doesn't make extensive use of shaders and doesn't use any webworkers for the number crunching. Therefore,
you can expect things to run hot. The hope is as the game develops, more of the physics logic can be farmed out to a web
worker and several of the CPU bound effects can be put into a shader or two.

## Assets

Assets are stored in src/assets/ and contain all the sounds and textures used for the game. When you add a new asset,
you must regenerate the file with `yarn assets`. This automatically creates the typings so that Typescript can check
whether all the assets are accounted for.

## Structure

The project uses [pixi.js](https://pixijs.com/) for rendering and sound, with [rapier](https://rapier.rs/) providing the physics engine.

The logic is cleanly split up into different subsystems to make development as painless as it can be.

### Startup / Menus

The menus before getting into a live game are entirely React-based. Rather than attempting to build a UI
within pixi.js, we just use a series of React components to render the menus for starting the game. Assets
are loaded before the menus are, because currentrly they are only a few MB in size. Future versions might choose
to load assets in the background however.

### Entities

The entity system is fairly basic, but lean. The interface `IGameEntity` describes all entities, which may either be
alive or destroyed. Each entity at a minimum must describe an update loop and a priority. The `GameWorld` class handles
the loops for these entities, and any physics operations between them. The `IPhysicalEntity` adds further interfaces
for entities that interace with the physical world.

Finally the `PhysicsEntity` abstract class describes any entity with a physics body and a sprite, and will handle the
interface between the physics engine and the rendering layer. IT also handles things like collisions and damage automatically.

There are several examples of physical entities in the `entities/phys` directory, which are used in the game.

### Logic

The game round logic, such as what is the composition of teams and the ruleset is based in the `logic/` directory.
This is far less fleshed out than other sections of the game due to frontloading development on the the physical world first.

### Terrain

The terrain system works by being given a Texture (which is then rendered to a canvas as a bitmap), and then breaking the alpha
channel down into a quadtree. As the map is damanged, the bitmap is altered and the quadtree is re-rendered. The system is somewhat
crude but performance is reasonable.