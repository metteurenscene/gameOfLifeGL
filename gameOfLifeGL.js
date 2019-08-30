(function () {
  'use strict'

  function main() {
    const canvas = document.getElementById('gl-canvas');

    // adjust canvas size
    const mainwidth = canvas.parentNode.clientWidth;
    const mainheight = canvas.parentNode.clientHeight;
    canvas.width = mainwidth;
    canvas.height = mainheight - 6;     // the number 6 to subtract has been
                                        // determined through tests to ensure
                                        // the canvas and footer stay within the
                                        // height of the page

    // grid configuration
    function Grid(width, height, cellWidth = 10, cellHeight = 10, borderSize = 1) {
      this.cellInnerSize = [ cellWidth, cellHeight ];
      this.cellBorderSize = borderSize;
      this.cellOuterSize = [ cellWidth + 2 * borderSize,
                             cellHeight + 2 * borderSize ];

      this.size = [
        Math.floor(width / this.cellOuterSize[0]),      // grid columns
        Math.floor(height / this.cellOuterSize[1]),     // grid rows
      ];

      this.pixelSize = [ this.size[0] * this.cellOuterSize[0],  // width in pixels
                         this.size[1] * this.cellOuterSize[1],  // height in pixels
      ];

      this.colourChannels = 4;          // the grid is stored in a RGBA texture

      // offset to centre the grid within the canvas
      this.gridX = Math.floor((width - this.pixelSize[0]) / 2);
      this.gridY = Math.floor((height - this.pixelSize[1]) / 2);

      this.grid = new Uint8Array(this.size[0] * this.size[1] * this.colourChannels);

      this.gridColours = [0.7, 0.7, 0.7, 1.0];   // colour for empty cell border
      this.gridColours.push(1.0, 1.0, 1.0, 1.0); // colour for empty cell
      this.gridColours.push(0.7, 0.7, 0.7, 1.0); // colour for living cell border
      this.gridColours.push(1.0, 0.0, 0.0, 1.0); // colour for living cell

      this.playColours = [0.95, 0.95, 0.95, 1.0]; // colour for empty cell border
      this.playColours.push(1.0, 1.0, 1.0, 1.0); // colour for empty cell
      this.playColours.push(1.0, 0.0, 0.0, 1.0); // colour for living cell border
      this.playColours.push(1.0, 0.0, 0.0, 1.0); // colour for living cell
    };

    let gridConfig = new Grid(canvas.width, canvas.height);

    //
    // Setup WebGL
    //

    // initialise the GL context
    const gl = canvas.getContext('webgl2');

    if (gl === null) {
      alert('Unable to initialise WebGL');
      return;
    }

    /*
     * Grid drawing
     */

    // the shaders
    const vertexShaderSource = `#version 300 es

    // attributes
    in vec4 a_position;
    in vec2 a_texCoord;

    uniform mat4 u_matrix;

    // varying, passed to the fragment shader
    out vec2 v_gridCoord;

    void main() {
      gl_Position = u_matrix * a_position;
      v_gridCoord = a_texCoord;
    }
    `;

    const fragmentShaderSource = `#version 300 es

    precision highp float;

    // the grid texture
    uniform sampler2D u_grid;

    uniform vec2 u_gridSize;
    uniform ivec2 u_elemSize;
    uniform int u_lineSize;
    uniform float u_colour[16];

    in vec2 v_gridCoord;

    // the colour output of the fragment shader
    out vec4 outColour;

    void main() {
      // convert fragment xy coordinates to int
      ivec2 fragCoord = ivec2(v_gridCoord * u_gridSize);

      ivec2 segmentSize = u_elemSize + 2 * u_lineSize;  // lineSize pixels on either side
      ivec2 rowsCols = fragCoord / segmentSize;         // which grid row/col are we in?
      ivec2 segmentStart = rowsCols * segmentSize;      // the start pos for row/col
      ivec2 inSegmentPos = fragCoord - segmentStart;    // position inside the grid row/col
      ivec2 pixelType = (inSegmentPos % (u_elemSize + u_lineSize)) /
        ivec2(max(inSegmentPos.x, 1), max(inSegmentPos.y, 1));  // grid pixel or line pixel

      // the cell value
      int cellvalue = int(texture(u_grid, v_gridCoord).x);
      int colourbase = (min(pixelType.x, pixelType.y) + 2 * cellvalue) * 4;

      outColour = vec4(u_colour[colourbase + 0],
                       u_colour[colourbase + 1],
                       u_colour[colourbase + 2],
                       u_colour[colourbase + 3]);
    }
    `;

    // compile the shaders and link
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

    const program = linkProgram(gl, vertexShader, fragmentShader);

    // look up attributes
    const positionAttribLocation = gl.getAttribLocation(program, 'a_position');
    const texCoordAttribLocation = gl.getAttribLocation(program, 'a_texCoord');
    // look up uniforms
    const matrixUniformLocation = gl.getUniformLocation(program, 'u_matrix');
    const gridUniformLocation = gl.getUniformLocation(program, 'u_grid');
    const gridSizeUnifLocation = gl.getUniformLocation(program, 'u_gridSize');
    const elemSizeUnifLocation = gl.getUniformLocation(program, 'u_elemSize');
    const lineSizeUnifLocation = gl.getUniformLocation(program, 'u_lineSize');
    const colourUniformLocation = gl.getUniformLocation(program, 'u_colour');

    // use a Vertex Array Object to encapsulate the grid state
    const gridVAO = gl.createVertexArray();

    gl.bindVertexArray(gridVAO);

    // vertex position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    gl.enableVertexAttribArray(positionAttribLocation);

    // specify the buffer format
    const posBufferFormat = {
      size: 3, type: gl.FLOAT, normalise: false, stride: 0, offset: 0
    };

    gl.vertexAttribPointer(positionAttribLocation,
                           posBufferFormat.size,
                           posBufferFormat.type,
                           posBufferFormat.normalise,
                           posBufferFormat.stride,
                           posBufferFormat.offset);


    // grid texture positions
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);

    gl.enableVertexAttribArray(texCoordAttribLocation);

    const texBufferFormat = {
      size: 2, type: gl.FLOAT, normalise: false, stride: 0, offset: 0
    };

    gl.vertexAttribPointer(texCoordAttribLocation,
                           texBufferFormat.size,
                           texBufferFormat.type,
                           texBufferFormat.normalise,
                           texBufferFormat.stride,
                           texBufferFormat.offset);

    const uploadBuffer = (buffer, data) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    };

    // grid texture
    gl.activeTexture(gl.TEXTURE0);

    const gridTexture = createTexture(gl);

    const mipLevel = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const uploadGrid = (grid) => gl.texImage2D(gl.TEXTURE_2D,
                                               mipLevel,
                                               internalFormat,
                                               gridConfig.size[0],
                                               gridConfig.size[1],
                                               border,
                                               srcFormat,
                                               srcType,
                                               grid);

    const gridx2 = gridConfig.gridX + gridConfig.pixelSize[0];
    const gridy2 = gridConfig.gridY + gridConfig.pixelSize[1];
    const gridPositions = [ gridConfig.gridX, gridConfig.gridY, 0,
                            gridx2, gridConfig.gridY, 0,
                            gridConfig.gridX, gridy2, 0,
                            gridConfig.gridX,  gridy2, 0,
                            gridx2, gridConfig.gridY, 0,
                            gridx2, gridy2, 0 ];

    const gridTexCoords = [ 0.0, 1.0, 1.0, 1.0, 0.0, 0.0,
                            0.0, 0.0, 1.0, 1.0, 1.0, 0.0 ];

    // matrix to transform from pixel spae to OpenGL space [-1.0 .. 1.0]
    const projectionMatrix = [
      2 / canvas.width, 0, 0, 0,
      0, 2 / canvas.height, 0, 0,
      0, 0, 0, 0,
      -1, -1, 0, 1,
    ];

    gl.useProgram(program);
    gl.uniform1i(gridUniformLocation, 0);       // we are using texture unit 0
    gl.uniformMatrix4fv(matrixUniformLocation, false, projectionMatrix);
    gl.uniform2fv(gridSizeUnifLocation, new Float32Array(gridConfig.pixelSize));
    gl.uniform2iv(elemSizeUnifLocation, new Int32Array(gridConfig.cellInnerSize));
    gl.uniform1i(lineSizeUnifLocation, gridConfig.cellBorderSize);
    gl.uniform1fv(colourUniformLocation, gridConfig.gridColours);

    uploadBuffer(positionBuffer, new Float32Array(gridPositions));
    uploadBuffer(texCoordBuffer, new Float32Array(gridTexCoords));
    uploadGrid(gridConfig.grid);

    /*
     * Grid update
     */
    const stepVertexSource = `#version 300 es

    // attributes
    in vec4 a_position;
    in vec2 a_texCoord;

    // varying, passed to the fragment shader
    out vec2 v_gridCoord;

    void main() {
      gl_Position = a_position;
      v_gridCoord = a_texCoord;
    }
    `;

    const stepFragmentSource = `#version 300 es

    precision highp float;

    // input grid texture
    uniform sampler2D u_input;
    uniform float u_lookup[10];

    in vec2 v_gridCoord;

    out vec4 outColour;

    void main() {
      // 1 pixel step
      vec2 onePixel = vec2(1) / vec2(textureSize(u_input, 0));

      // count neighbours
      int neighbours = int(texture(u_input, v_gridCoord + onePixel * vec2(-1, -1)).x);
      neighbours += int(texture(u_input, v_gridCoord + onePixel * vec2(-1, 0)).x);
      neighbours += int(texture(u_input, v_gridCoord + onePixel * vec2(-1, 1)).x);
      neighbours += int(texture(u_input, v_gridCoord + onePixel * vec2(0, 1)).x);
      neighbours += int(texture(u_input, v_gridCoord + onePixel * vec2(1, 1)).x);
      neighbours += int(texture(u_input, v_gridCoord + onePixel * vec2(1, 0)).x);
      neighbours += int(texture(u_input, v_gridCoord + onePixel * vec2(1, -1)).x);
      neighbours += int(texture(u_input, v_gridCoord + onePixel * vec2(0, -1)).x);

      int cell = int(texture(u_input, v_gridCoord).x);

      outColour = vec4(u_lookup[min(4, neighbours) * 2 + cell], 0.0, 0.0, 0.0);
    }
    `;

    // compile the shader and link
    const stepVertexShader = compileShader(gl, stepVertexSource, gl.VERTEX_SHADER);
    const stepFragmentShader = compileShader(gl, stepFragmentSource, gl.FRAGMENT_SHADER);

    const stepProgram = linkProgram(gl, stepVertexShader, stepFragmentShader);

    // look up attributes
    const stepPositionAttribLoc = gl.getAttribLocation(stepProgram, 'a_position');
    const stepTexCoordAttribLoc = gl.getAttribLocation(stepProgram, 'a_texCoord');
    // look up uniforms
    const stepInputTexUniformLoc = gl.getUniformLocation(stepProgram, 'u_input');
    const stepLookupUniformLoc = gl.getUniformLocation(stepProgram, 'u_lookup');

    // use a Vertex Array Object to encapsulate the step state
    const stepVAO = gl.createVertexArray();

    gl.bindVertexArray(stepVAO);

    // the position buffer
    const stepPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, stepPositionBuffer);

    gl.enableVertexAttribArray(stepPositionAttribLoc);

    gl.vertexAttribPointer(stepPositionAttribLoc,    // using same posBufferFormat
                           posBufferFormat.size,
                           posBufferFormat.type,
                           posBufferFormat.normalise,
                           posBufferFormat.stride,
                           posBufferFormat.offset);

    // the texture buffer
    const stepTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, stepTexCoordBuffer);

    gl.enableVertexAttribArray(stepTexCoordAttribLoc);

    gl.vertexAttribPointer(stepTexCoordAttribLoc,   // using same texBufferFormat
                           texBufferFormat.size,
                           texBufferFormat.type,
                           texBufferFormat.normalise,
                           texBufferFormat.stride,
                           texBufferFormat.offset);

    gl.activeTexture(gl.TEXTURE0);

    // create 2 textures and attach them to framebuffers
    const textures = [];
    const framebuffers = [];
    for (let i = 0; i < 2; i++) {
      const texture = createTexture(gl);
      textures.push(texture);

      uploadGrid(null); // make the texture identical to the grid but without data

      // create a framebuffer for the texture
      const fbo = gl.createFramebuffer();
      framebuffers.push(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

      // attach the texture to it
      gl.framebufferTexture2D(gl.FRAMEBUFFER,
                              gl.COLOR_ATTACHMENT0,
                              gl.TEXTURE_2D,
                              texture,
                              mipLevel);
    }

    gl.useProgram(stepProgram);
    gl.uniform1i(stepInputTexUniformLoc, 0);
    // the lookup array maps #neighbours to next cell state
    const lookup = [ 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0 ];
    gl.uniform1fv(stepLookupUniformLoc, lookup);

    const stepGridPositions = [ -1, -1, 0, 1, -1, 0, -1, 1, 0,
                            -1,  1, 0, 1, -1, 0,  1, 1, 0 ];

    const stepGridTexCoords = [ 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
                                0.0, 1.0, 1.0, 0.0, 1.0, 1.0 ];

    uploadBuffer(stepPositionBuffer, new Float32Array(stepGridPositions));
    uploadBuffer(stepTexCoordBuffer, new Float32Array(stepGridTexCoords));

    /*
     * now everything is set up, we start dealing with the drawing and updating
     */

    const setFramebuffer = (framebuffer, width, height) => {
      // select the framebuffer to render into (null means render to canvas)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

      // update viewport to match the rendering resolution
      gl.viewport(0, 0, width, height);
    };

    const draw = () => {
      // restore grid drawing state
      gl.useProgram(program);
      gl.bindVertexArray(gridVAO);

      setFramebuffer(null, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    //
    // initial draw
    //

    // clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gridTexture);

    draw();

    //
    // functionality to update the grid and playback
    //

    let step = -1;      // -1 indicates we are still in the initial phase
    let playing = false;
    let lastFrame = 0;  // to control fps
    let fps = 10;

    const calculateNextStep  = () => {
      gl.bindVertexArray(stepVAO);
      gl.useProgram(stepProgram);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }


    const updateGrid = () => {
      step = (step + 1) % 2;
      setFramebuffer(framebuffers[step], gridConfig.size[0], gridConfig.size[1]);
      calculateNextStep();
      gl.bindTexture(gl.TEXTURE_2D, textures[step]);
    }


    const play = timestamp => {
      if (!playing) return;
      if (timestamp - lastFrame > 1000 / fps) {
        lastFrame = timestamp;
        updateGrid();
        draw();
      }
      requestAnimationFrame(play);
    }

    const playButton = document.getElementById('playButton');
    const start = () => {
      if (playing) return;
      playing = true;
      // change the grid colour for playback
      gl.useProgram(program);
      gl.uniform1fv(colourUniformLocation, gridConfig.playColours);
      play();
      playButton.innerText = 'Stop';
    }

    const stop = () => {
      if (!playing) return;
      playing = false;
      // change the grid colour back to initial
      gl.useProgram(program);
      gl.uniform1fv(colourUniformLocation, gridConfig.gridColours);
      playButton.innerText = 'Start';
      draw();
    }

    //
    // event handling
    //

    const mouseToIndex = (col, row, colour) =>
      (row * gridConfig.size[0] + col) * gridConfig.colourChannels + colour;

    // OpenGL origin is bottom left, CSS origin is top left
    const topoffset = canvas.height - gridConfig.pixelSize[1] - gridConfig.gridY;

    // mouse event handler for manual placement of cells
    canvas.onmouseup = ev => {
      const mouseX = ev.clientX - canvas.offsetLeft - gridConfig.gridX;
      const mouseY = ev.clientY - canvas.offsetTop - topoffset;
      if ( mouseX < 0 || mouseX >= gridConfig.pixelSize[0] ||
           mouseY < 0 || mouseY >= gridConfig.pixelSize[1] )
        return;

      const col = Math.floor(mouseX / gridConfig.cellOuterSize[0]);
      const row = Math.floor(mouseY / gridConfig.cellOuterSize[1]);

      const index = mouseToIndex(col, row, 0);

      if (step > -1) {
        // stop playback if necessary
        if (playing) stop();
        // the grid has been updated since the last mouse placement
        // so we need to download the current grid first
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffers[step]);
        gl.readPixels(0, 0, gridConfig.size[0], gridConfig.size[1],
                      gl.RGBA, gl.UNSIGNED_BYTE, gridConfig.grid);

        step = -1;
        gl.bindTexture(gl.TEXTURE_2D, gridTexture);
      }

      gridConfig.grid[index] = 255 - gridConfig.grid[index];

      // update the canvas
      uploadGrid(gridConfig.grid);
      setFramebuffer(null, canvas.width, canvas.height);
      draw();
    };

    playButton.onclick = ev => {
      if (playing) stop();
      else start();
    };

    const nextButton = document.getElementById('nextButton');
    nextButton.onclick = ev => {
      if (playing) stop();
      updateGrid();
      draw();
    };

    const fpsInput = document.getElementById('fps');
    fpsInput.value = fps;
    fpsInput.onchange = ev => {
      fps = (fpsInput.value === '' || fpsInput.value < 1 || fpsInput.value > 100) ? fps : fpsInput.value;
    fpsInput.value = fps;
    };

    const clearButton = document.getElementById('clearButton');
    clearButton.onclick = ev => {
      if (step > -1) {
        if (playing) stop();

        step = -1;
        gl.bindTexture(gl.TEXTURE_2D, gridTexture);
      }

      gridConfig.grid = new Uint8Array(gridConfig.size[0] * gridConfig.size[1] * gridConfig.colourChannels);
      uploadGrid(gridConfig.grid);
      setFramebuffer(null, canvas.width, canvas.height);
      draw();
    };
  }

  window.onload = main;
})();
