/*
 * Resize the canvas (internal) width and height to actual width/height
 *
 * @param {!HTMLElement} canvas The canvas object
 * @param {bool} highDPI Adapt for HD-DPI displays (e.g. Retina). Default true
 */
function resizeCanvas(canvas, highDPI) {
  // if highDPI is undefined, (highDPI === false) will be false and the
  // resolution will adapt for high DPI displays
  const cssToRealPixels = highDPI === false ? 1 : (window.devicePixelRatio || 1);

  // lookup the size the browser is displaying the canvas
  const displayWidth = Math.floor(canvas.clientWidth * cssToRealPixels);
  const displayHeight = Math.floor(canvas.clientHeight * cssToRealPixels);

  // check if the canvas is not already the same size
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}


/**
 * Creates and compiles a shader
 *
 * @param {!WebGLRenderingContex} gl The WebGL Context
 * @param {string} shaderSource The GLSL source code for the shader
 * @param {number} shaderType, The type of shader, VERTEX_SHADER or
 *      FRAGMENT_SHADER 
 * @return {!WebGLShader} The shader.
 */
function compileShader(gl, shaderSource, shaderType) {
  // create the shader objecet
  const shader = gl.createShader(shaderType);

  // set the shader source code
  gl.shaderSource(shader, shaderSource);

  // compile the shader
  gl.compileShader(shader);

  // check for errors
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw `Failed to compile shader: ${log}`;
  }

  return shader;
}


/*
 * Creates a program from 2 shaders
 *
 * @param {!WebGLRenderingContext} gl The WebGL context.
 * @param {!WebGLShader} vertexShader A vertex shader.
 * @param {!WebGLShader} fragmentShader A fragment shader.
 * @return {!WebGLProgram} The program
 */
function linkProgram(gl, vertexShader, fragmentShader) {
  //create the program object
  const program = gl.createProgram();
  
  // attach the shaders 
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // link the program
  gl.linkProgram(program);

  // check for errors
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw `Failed to link program: ${log}`;
  }

  return program;
}

/*
 * Creates and sets up a texture
 *
 * @param {!WebGLRenderingContext} gl The WebGL context
 * @param {!GLenum} wrapS Value for TEXTURE_WRAP_S, default CLAMP_TO_EDGE
 * @param (!GLenum} wrapT Value for TEXTURE_WRAP_T, default CLAMP_TO_EDGE
 * @param {!GLenum} minFilter Value for TEXTURE_MIN_FILTER, default NEAREST
 * @param {!GLenum} magFilter Value for TEXTURE_MAG_FILTER, default NEAREST
 * @return {!WebGLTexture} The texture
 */
function createTexture(gl, ...texargs) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set up the texture
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, texargs[0] ? texargs[0] : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, texargs[1] ? texargs[1] : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, texargs[2] ? texargs[2] : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texargs[3] ? texargs[3] : gl.NEAREST);

  return texture;
}
