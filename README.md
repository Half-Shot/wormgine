wormgine
--------

*Everything, including the name is subject to change.*

This project started off as an attempt to clone Worms Armageddon for the browser,
however for a few reasons the plan has changed. This will hopefully be an entirely
new game on the same foundations but with a different gameplay focus.

### Structure

The project uses [pixi.js](https://pixijs.com/) for rendering and sound, with [matter.js](https://brm.io/matter-js/) providing the physics engine. There are a few customisations to the latter to make it performant for a game
that regularly mutates it's terrain.

The rest of the game engine is largely bespoke. There is currently a (crude) entity system which defines the world,
where everything runs an update loop at render intervals. Entites may either be physics based or static.

### Requirements

Right now, the game doesn't make extensive use of shaders and doesn't use any webworkers for the number crunching. Therefore,
you can expect things to run hot. The hope is as the game develops, more of the physics logic can be farmed out to a web
worker and several of the CPU bound effects can be put into a shader or two.