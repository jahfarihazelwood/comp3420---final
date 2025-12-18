// Camera position (can be modified by keyboard) - GLOBAL variables
var cameraPosition = [2, 2, 3];
var cameraTarget = [0, -0.5, 0];

'use strict';

// Fix for gl-matrix library - extract mat4 if it's namespaced
if (typeof mat4 === 'undefined' && typeof glMatrix !== 'undefined') {
  var mat4 = glMatrix.mat4;
  console.log('Extracted mat4 from glMatrix namespace');
}

// Global variables that are set and used
// across the application
let gl;

// GLSL programs
let shaderProgram;

// VAOs for the objects
let sphere, floor, lightSphere;
let lampBase, lampArm, lampHead;
let vaoSphere, vaoFloor, vaoLightSphere;
let vaoLampBase, vaoLampArm, vaoLampHead;

// textures
let woodTexture;


//
// create shapes and VAOs for objects.
// Note that you will need to bindVAO separately for each object / program based
// upon the vertex attributes found in each program
//
function createShapes() {
  sphere = new Sphere(20, 20); // The main sphere
  floor = new Cube(20); // The floor
  lightSphere = new Sphere(10, 10); // Small sphere for light visualization - the bulb of the lamp

  // Create Luxo Lamp parts
  let lamp = createLuxoLamp(shaderProgram);
  lampBase = lamp.base;  // Cube 
  lampArm = lamp.arm; // Cube
  lampHead = lamp.head; // Cone

  //Bind VAOs (vertex array object)
  vaoSphere = bindVAO(sphere, shaderProgram);
  vaoFloor = bindVAO(floor, shaderProgram);
  vaoLightSphere = bindVAO(lightSphere, shaderProgram);

  // Lamp VAOs are already bound in createLuxoLamp but we need to assign them to globals if we want to use them directly
  vaoLampBase = lampBase.VAO;
  vaoLampArm = lampArm.VAO;
  vaoLampHead = lampHead.VAO;

}

function createLuxoLamp(program) {
  // Create base (cube stretched horizontally)
  let base = new Cube(10);
  base.VAO = bindVAO(base, program);

  // Create arm (cube stretched and rotated) - we'll handle rotation in draw
  let arm = new Cube(10);
  arm.VAO = bindVAO(arm, program);

  // Create lamp head (cone)
  let head = new Cone(20, 10);
  head.VAO = bindVAO(head, program);

  return { base, arm, head };
}


//
// Here you set up your camera position, orientation, and projection
// Remember that your projection and view matrices are sent to the vertex shader
// as uniforms, using whatever name you supply in the shaders
//
function setUpCamera(program) {

  gl.useProgram(program);

  // set up your projection
  let projection = mat4.create();
  mat4.perspective(projection, Math.PI / 4, (gl.canvas.width / gl.canvas.height), 0.1, 100.0);

  // set up your view - closer camera looking down at scene
  let view = mat4.create();
  mat4.lookAt(view, cameraPosition, cameraTarget, [0, 1, 0]);

  gl.uniformMatrix4fv(program.uProjectionMatrix, false, projection);
  gl.uniformMatrix4fv(program.uViewMatrix, false, view);
}


//
// load up the textures you will use in the shader(s)
//
function setUpTextures() {

  // flip Y for WebGL
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Create WebGL texture
  woodTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, woodTexture);

  // Use Base64 encoded image data (works with file:// protocol)
  var woodImage = new Image();
  woodImage.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, woodTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, woodImage);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    console.log('Wood texture loaded from Base64');
    draw(); // Redraw with texture
  };

  // Check if woodTextureBase64 is defined (from texture_data.js)
  if (typeof woodTextureBase64 !== 'undefined') {
    woodImage.src = woodTextureBase64;
  } else {
    console.error("woodTextureBase64 is not defined! Make sure texture_data.js is included.");
    // Fallback to procedural if missing
    // ... (procedural logic could be here, but simpler to just show error) // Need to add catch code for error
  }
}

//
//  This function draws all of the shapes required for your scene
//
function drawShapes() {
  gl.useProgram(shaderProgram);
  setUpCamera(shaderProgram);

  // Draw elements that require detailed lighting control
  // --- Draw Floor ---
  // Lighting and Material for floor
  gl.uniform3fv(shaderProgram.uAmbientLight, [0.4, 0.4, 0.4]);
  gl.uniform3fv(shaderProgram.uLightColor, [1.0, 1.0, 1.0]);
  gl.uniform3fv(shaderProgram.uSpecularColor, [0.2, 0.2, 0.2]); // Low specular for wood
  gl.uniform1f(shaderProgram.uKa, 0.5);
  gl.uniform1f(shaderProgram.uKd, 0.6);
  gl.uniform1f(shaderProgram.uKs, 0.3);
  gl.uniform1f(shaderProgram.uShininess, 5.0);

  gl.bindVertexArray(vaoFloor);
  let modelFloor = mat4.create();
  mat4.translate(modelFloor, modelFloor, [0.0, -1.5, 0.0]);
  mat4.scale(modelFloor, modelFloor, [4.0, 0.1, 4.0]);
  gl.uniformMatrix4fv(shaderProgram.uModelMatrix, false, modelFloor);

  // Use texture for floor
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, woodTexture);
  gl.uniform1i(shaderProgram.uTexture, 0);
  gl.uniform1i(shaderProgram.uUseTexture, 1); // Enable texture
  gl.uniform3fv(shaderProgram.uMaterialDiffuse, [0.7, 0.7, 0.7]);

  gl.drawElements(gl.TRIANGLES, floor.indices.length, gl.UNSIGNED_SHORT, 0);

  // --- Draw Sphere and Light ---
  drawRedSphere(shaderProgram);
  drawLightSource(shaderProgram);

  // --- Draw Luxo Lamp ---
  // Lamp Parts need default material settings to work with new shader
  // Just setting some defaults before drawing them
  gl.uniform3fv(shaderProgram.uAmbientLight, [0.2, 0.2, 0.2]);
  gl.uniform3fv(shaderProgram.uLightColor, [1.0, 1.0, 1.0]);
  gl.uniform3fv(shaderProgram.uSpecularColor, [1.0, 1.0, 1.0]);
  gl.uniform1f(shaderProgram.uKa, 0.3);
  gl.uniform1f(shaderProgram.uKd, 0.7);
  gl.uniform1f(shaderProgram.uKs, 0.5);
  gl.uniform1f(shaderProgram.uShininess, 10.0);

  drawLuxoLamp([0.0, -1.35, 0.0]);
}

function drawRedSphere(program) {
  gl.useProgram(program);

  // Light and Material properties for the sphere
  gl.uniform3fv(program.uAmbientLight, [0.2, 0.2, 0.2]);   // ambient light
  gl.uniform3fv(program.uLightPosition, [0.125, 4.5, -1.0]);  // light source position (Overriding global for this object?)
  // Note: User snippet asked to set light position here. It effectively moves the light for this object shading.

  gl.uniform3fv(program.uLightColor, [1.0, 1.0, 1.0]);     // white light

  gl.uniform3fv(program.uMaterialDiffuse, [0.8, 0.2, 0.2]);      // reddish sphere (Base Color)
  gl.uniform3fv(program.uSpecularColor, [1.0, 1.0, 1.0]); // white highlight

  gl.uniform1f(program.uKa, 0.3);   // ambient coefficient
  gl.uniform1f(program.uKd, 0.7);   // diffuse coefficient
  gl.uniform1f(program.uKs, 0.8);   // specular coefficient
  gl.uniform1f(program.uShininess, 20.0);  // shininess

  gl.bindVertexArray(vaoSphere);
  let modelSphere = mat4.create();
  mat4.translate(modelSphere, modelSphere, [0.0, -0.95, 1.0]); // Control sphere position
  mat4.scale(modelSphere, modelSphere, [1.0, 1.0, 1.0]); // control sphere size
  gl.uniformMatrix4fv(program.uModelMatrix, false, modelSphere);
  gl.uniform1i(program.uUseTexture, 0); // Disable texture

  gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
}

function drawLightSource(program) {
  gl.useProgram(program);
  // Draw light source indicator (bright yellow sphere, no texture)

  // Light source ignores lighting mostly, or we want it bright.
  // We can simulate "unlit" by High Ambient, Low Diffuse/Spec? 
  // Or just rely on BaseColor + basic lighting.

  gl.uniform3fv(program.uAmbientLight, [1.0, 1.0, 1.0]); // High ambient to look bright
  gl.uniform3fv(program.uMaterialDiffuse, [1.0, 1.0, 0.0]); // Yellowish
  gl.uniform1f(program.uKa, 1.0); // Full ambient
  gl.uniform1f(program.uKd, 0.0); // No diffuse shading
  gl.uniform1f(program.uKs, 0.0); // No specular

  gl.bindVertexArray(vaoLightSphere);
  let modelLight = mat4.create();
  mat4.translate(modelLight, modelLight, [0.025, 0.075, 0.8]); // Position bulb
  mat4.scale(modelLight, modelLight, [0.15, 0.15, 0.15]); // Small sphere
  gl.uniformMatrix4fv(program.uModelMatrix, false, modelLight);
  gl.uniform1i(program.uUseTexture, 0); // Disable texture

  gl.drawElements(gl.TRIANGLES, lightSphere.indices.length, gl.UNSIGNED_SHORT, 0);
}

// Function to draw Luxo Lamp at a specific position (base center)
// Uses Hierarchical Modeling: Base -> Arm -> Head
function drawLuxoLamp(position) {


  // Matrix Stack logic simulation using local variables
  // 1. Base Transform
  let modelBase = mat4.create();
  mat4.translate(modelBase, modelBase, position);
  let baseColor = [0.3, 0.3, 0.3];

  // Draw Base
  if (vaoLampBase) {
    gl.bindVertexArray(vaoLampBase);
    // Create a copy for rendering the base itself, scaling it
    let renderBase = mat4.clone(modelBase);
    mat4.scale(renderBase, renderBase, [0.8, 0.3, 0.8]); // change size of base of lamp
    gl.uniformMatrix4fv(shaderProgram.uModelMatrix, false, renderBase);
    gl.uniform3fv(shaderProgram.uMaterialDiffuse, baseColor);
    gl.drawElements(gl.TRIANGLES, lampBase.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  // 2. Arm Transform (Child of Base)
  // Connects to center top of base. Base height scale 0.2 -> top is +0.1 relative to base center.
  let modelArmPivot = mat4.clone(modelBase);
  mat4.translate(modelArmPivot, modelArmPivot, [0.0, 0.1, 0.0]); // Move to top of base, change position or location 

  // Arm Rotation// change rotation of arm 
  // these two can change rotation of the arm for the lamp
  mat4.rotateY(modelArmPivot, modelArmPivot, Math.PI / 1.0);
  mat4.rotateX(modelArmPivot, modelArmPivot, Math.PI / -10);

  // Draw Arm
  if (vaoLampArm) {
    gl.bindVertexArray(vaoLampArm);

    let renderArm = mat4.clone(modelArmPivot);
    mat4.translate(renderArm, renderArm, [0.0, 1.0, 0.2]); // Move the arm of the lamp to the top of the base/ change position 
    mat4.scale(renderArm, renderArm, [0.10, 2.0, 0.10]); // Size the arm of the lamp

    gl.uniformMatrix4fv(shaderProgram.uModelMatrix, false, renderArm);
    gl.uniform3fv(shaderProgram.uMaterialDiffuse, [0.6, 0.6, 0.6]);
    gl.drawElements(gl.TRIANGLES, lampArm.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  // 3. Head Transform (Child of Arm)
  // Attached to end of arm. Arm length 2.0 relative to ArmPivot.
  let modelHeadPivot = mat4.clone(modelArmPivot);
  mat4.translate(modelHeadPivot, modelHeadPivot, [0.0, 2.0, 0.0]); // Move to tip of arm, change position or location

  // Draw Head
  if (vaoLampHead) {
    gl.bindVertexArray(vaoLampHead);

    let renderHead = mat4.clone(modelHeadPivot);

    // This controlls the rotation of the cone (lamp head). increase or decrease the denominator to rotate more or less.
    mat4.rotateX(renderHead, renderHead, Math.PI / 6);

    mat4.scale(renderHead, renderHead, [1.0, 1.0, 1.0]); // Change the size of the cone (lamp head)
    mat4.translate(renderHead, renderHead, [0.0, -0.1, 0.0]); // change the position of the cone

    gl.uniformMatrix4fv(shaderProgram.uModelMatrix, false, renderHead);
    gl.uniform3fv(shaderProgram.uMaterialDiffuse, [0.8, 0.8, 0.8]);
    gl.drawElements(gl.TRIANGLES, lampHead.indices.length, gl.UNSIGNED_SHORT, 0);
  }
}


//
// Note that after successfully obtaining a program using the initProgram
// function, you will beed to assign locations of attribute and unifirm variable
// based on the in variables to the shaders.   This will vary from program
// to program.
//
function initPrograms() {
  shaderProgram = initProgram('vertex-shader', 'fragment-shader');

  if (!shaderProgram) {
    console.error('Failed to initialize shader program');
    return;
  }
  console.log('Shader program initialized successfully');

  // Assign attribute/uniform locations
  shaderProgram.aVertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  shaderProgram.aNormal = gl.getAttribLocation(shaderProgram, 'aNormal');
  shaderProgram.aUV = gl.getAttribLocation(shaderProgram, 'aUV');
  shaderProgram.uModelMatrix = gl.getUniformLocation(shaderProgram, 'uModelMatrix');
  shaderProgram.uViewMatrix = gl.getUniformLocation(shaderProgram, 'uViewMatrix');
  shaderProgram.uProjectionMatrix = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');

  // Lighting + material
  shaderProgram.uLightPosition = gl.getUniformLocation(shaderProgram, 'uLightPosition');
  shaderProgram.uMaterialDiffuse = gl.getUniformLocation(shaderProgram, 'uMaterialDiffuse');
  shaderProgram.uCameraPosition = gl.getUniformLocation(shaderProgram, 'uCameraPosition');
  shaderProgram.uTexture = gl.getUniformLocation(shaderProgram, 'uTexture');
  shaderProgram.uUseTexture = gl.getUniformLocation(shaderProgram, 'uUseTexture');

  // New Uniforms
  shaderProgram.uAmbientLight = gl.getUniformLocation(shaderProgram, 'uAmbientLight');
  shaderProgram.uLightColor = gl.getUniformLocation(shaderProgram, 'uLightColor');
  shaderProgram.uSpecularColor = gl.getUniformLocation(shaderProgram, 'uSpecularColor');
  shaderProgram.uKa = gl.getUniformLocation(shaderProgram, 'uKa');
  shaderProgram.uKd = gl.getUniformLocation(shaderProgram, 'uKd');
  shaderProgram.uKs = gl.getUniformLocation(shaderProgram, 'uKs');
  shaderProgram.uShininess = gl.getUniformLocation(shaderProgram, 'uShininess');

  gl.useProgram(shaderProgram);
  // Default values just in case
  gl.uniform3fv(shaderProgram.uLightPosition, [5.0, 5.0, -3.0]);
  gl.uniform3fv(shaderProgram.uMaterialDiffuse, [1.0, 1.0, 1.0]);
  gl.uniform3fv(shaderProgram.uCameraPosition, cameraPosition);

}


// creates a VAO and returns its ID
function bindVAO(shape, program) {
  //create and bind VAO
  let theVAO = gl.createVertexArray();
  gl.bindVertexArray(theVAO);

  // create and bind vertex buffer
  let myVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, myVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shape.points), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(program.aVertexPosition);
  gl.vertexAttribPointer(program.aVertexPosition, 3, gl.FLOAT, false, 0, 0);

  // add code for any additional vertex attribute
  // add code for any additional vertex attribute - normals
  let myNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, myNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shape.normals), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(program.aNormal);
  gl.vertexAttribPointer(program.aNormal, 3, gl.FLOAT, false, 0, 0);

  // UV coordinates for textures
  if (shape.uv && shape.uv.length > 0) {
    let myUVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, myUVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shape.uv), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(program.aUV);
    gl.vertexAttribPointer(program.aUV, 2, gl.FLOAT, false, 0, 0);
  }


  // Setting up the IBO
  let myIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, myIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(shape.indices), gl.STATIC_DRAW);

  // Clean
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return theVAO;
}


/////////////////////////////////////////////////////////////////////////////
//
//  You shouldn't have to edit anything below this line...but you can
//  if you find the need
//
/////////////////////////////////////////////////////////////////////////////

// Given an id, extract the content's of a shader script
// from the DOM and return the compiled shader
function getShader(id) {
  const script = document.getElementById(id);
  const shaderString = script.text.trim();

  // Assign shader depending on the type of shader
  let shader;
  if (script.type === 'x-shader/x-vertex') {
    shader = gl.createShader(gl.VERTEX_SHADER);
  }
  else if (script.type === 'x-shader/x-fragment') {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  }
  else {
    return null;
  }

  // Compile the shader using the supplied shader code
  gl.shaderSource(shader, shaderString);
  gl.compileShader(shader);

  // Ensure the shader is valid
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}


//
// compiles, loads, links and returns a program (vertex/fragment shader pair)
//
// takes in the id of the vertex and fragment shaders (as given in the HTML file)
// and returns a program object.
//
// will return null if something went wrong
//
function initProgram(vertex_id, fragment_id) {
  const vertexShader = getShader(vertex_id);
  const fragmentShader = getShader(fragment_id);

  // Create a program
  let program = gl.createProgram();

  // Attach the shaders to this program
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Could not initialize shaders');
    return null;
  }

  return program;
}


//
// We call draw to render to our canvas
//
function draw() {
  // Clear the scene
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // draw your shapes
  drawShapes();

  // Clean
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

// Entry point to our application
function init() {

  // Retrieve the canvas
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) {
    console.error(`There is no canvas with id ${'webgl-canvas'} on this page.`);
    return null;
  }

  // deal with keypress
  window.addEventListener('keydown', gotKey, false);

  // Retrieve a WebGL context
  gl = canvas.getContext('webgl2');
  if (!gl) {
    console.error(`There is no WebGL 2.0 context`);
    return null;
  }

  // deal with keypress
  window.addEventListener('keydown', gotKey, false);

  // Set the clear color to be black
  gl.clearColor(0, 0, 0, 1);

  // some GL initialization
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);
  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.depthFunc(gl.LEQUAL)
  gl.clearDepth(1.0)

  // Read, compile, and link your shaders
  initPrograms();

  // Load textures
  setUpTextures();

  // create and bind your current object
  createShapes();

  // do a draw
  draw();
}
