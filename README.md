# Game of Life GL

Basic implementation of [Conway's Game of
Life](https://en.wikipedia.org/wiki/Conway's_Game_of_Life) using WegGL2.

## Usage

Load
`[gameOfLife.html](https://metteurenscene.github.io/gameOfLifeGL/gameOfLifeGL.html)`
in your browser and add or remove cells with the mouse.
Press *Play* to watch its evolution or *Next* to observe it step-by-step. Cells
can be added or removed at any time.
Use the *fps* control to adjust the speed of the evolution.
Click *Clear* to remove all cells and start again with a blank grid.

### Limitations

- The grid size is currently hard coded to 40 x 40 cells;

- border cases are not handled correctly due to clamping.

