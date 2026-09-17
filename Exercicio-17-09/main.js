const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
    throw new Error("WebGL 2 não é suportado.");
}

const vertexShaderSource = `#version 300 es

in vec2 aPosition;

uniform mat3 u_viewTransform;
uniform mat3 u_modelTransform;

void main() {
    vec3 position =
        u_viewTransform *
        u_modelTransform *
        vec3(aPosition, 1.0);

    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es

precision mediump float;

uniform vec3 uColor;

out vec4 outColor;

void main() {
    outColor = vec4(uColor, 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(error);
    }

    return shader;
}

function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }

    return program;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);


// ==================================================
// CLASSE RENDERER
// ==================================================

class Renderer {

    constructor(gl, program) {
        this.gl = gl;
        this.program = program;

        this.positionLocation = gl.getAttribLocation(program, "aPosition");
        this.colorLocation = gl.getUniformLocation(program, "uColor");
        this.viewTransformLocation = gl.getUniformLocation(program, "u_viewTransform");
        this.modelTransformLocation = gl.getUniformLocation(program, "u_modelTransform");

        this.viewTransform = m3.identity();
        this.verticesBuffer = gl.createBuffer();
    }

    defineViewTransform(viewTransform) {
        this.viewTransform = viewTransform;
    }

    draw(object) {
        const gl = this.gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.verticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, object.vertices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.uniform3fv(this.colorLocation, object.color);
        gl.uniformMatrix3fv(this.modelTransformLocation, false, object.modelTransform);
        gl.uniformMatrix3fv(this.viewTransformLocation, false, this.viewTransform);

        gl.drawArrays(gl.TRIANGLES, 0, object.vertices.length / 2);
    }
}


// ==================================================
// FUNÇÕES AUXILIARES DE GEOMETRIA
// ==================================================

function rectangleVertices(x, y, width, height) {
    return [
        x, y,
        x + width, y + height,
        x, y + height,

        x, y,
        x + width, y,
        x + width, y + height
    ];
}

function circleVertices(radius, numSegments) {
    const vertices = [];

    for (let i = 0; i < numSegments; i++) {
        const theta1 = (i / numSegments) * 2 * Math.PI;
        const theta2 = ((i + 1) / numSegments) * 2 * Math.PI;

        vertices.push(0, 0);
        vertices.push(radius * Math.cos(theta1), radius * Math.sin(theta1));
        vertices.push(radius * Math.cos(theta2), radius * Math.sin(theta2));
    }

    return vertices;
}


// ==================================================
// GEOMETRIA DO CHÃO
// ==================================================

function floorVertices() {
    return new Float32Array(rectangleVertices(-2.0, -0.95, 4.0, 0.15));
}


// ==================================================
// GEOMETRIA DO ROBÔ (cada parte com o pivô no ponto de junção)
// ==================================================

// Tronco: centrado no meio do corpo (0,0)
function torsoVertices() {
    return new Float32Array(rectangleVertices(-0.15, -0.25, 0.30, 0.50));
}

// Cabeça: pivô na base (pescoço), cresce pra cima
function headVertices() {
    return new Float32Array(rectangleVertices(-0.09, 0.0, 0.18, 0.18));
}

// Antena: pivô na base (topo da cabeça)
function antennaVertices() {
    return new Float32Array(rectangleVertices(-0.01, 0.0, 0.02, 0.10));
}

function antennaTipVertices() {
    return new Float32Array(circleVertices(0.03, 8));
}

// Braço: pivô no ombro (topo), pendurado pra baixo
function armVertices() {
    return new Float32Array(rectangleVertices(-0.035, -0.32, 0.07, 0.32));
}

// Perna: pivô no quadril (topo), pendurada pra baixo
function legVertices() {
    return new Float32Array(rectangleVertices(-0.045, -0.40, 0.09, 0.40));
}


// ==================================================
// CLASSE BASE: SCENE OBJECT
// ==================================================

class SceneObject {

    constructor(vertices, color) {
        this.vertices = vertices;
        this.color = color;
        this.modelTransform = m3.identity();
    }

    updateModelTransform(modelTransform) {
        this.modelTransform = modelTransform;
    }
}


// ==================================================
// CLASSE FLOOR (chão, objeto estático da cena)
// ==================================================

class Floor extends SceneObject {

    constructor() {
        super(floorVertices(), new Float32Array([0.25, 0.25, 0.25]));
    }

    draw(renderer) {
        renderer.draw(this);
    }
}


// ==================================================
// CLASSE TORSO
// ==================================================

class RobotTorso extends SceneObject {

    constructor(color) {
        super(torsoVertices(), color);
    }
    // updateModelTransform herdado: o tronco recebe direto a transformação do robô (raiz da hierarquia)
}


// ==================================================
// CLASSE HEAD (gira independente, "olhando" de um lado pro outro)
// ==================================================

class RobotHead extends SceneObject {

    constructor(color) {
        super(headVertices(), color);
        this.theta = 0.0;
    }

    updateRotation(theta) {
        this.theta = theta;
    }

    // pivô relativo ao tronco: topo do tronco (0, 0.25)
    updateModelTransform(torsoTransform) {
        const localTransform = m3.multiply(
            m3.translation(0.0, 0.25),
            m3.rotation(this.theta)
        );

        this.modelTransform = m3.multiply(torsoTransform, localTransform);
    }
}


// ==================================================
// CLASSE ANTENNA (filha da cabeça, apenas herda o movimento dela)
// ==================================================

class RobotAntenna extends SceneObject {

    constructor(color) {
        super(antennaVertices(), color);
    }

    // pivô relativo à cabeça: topo da cabeça (0, 0.18)
    updateModelTransform(headTransform) {
        const localTransform = m3.translation(0.0, 0.18);
        this.modelTransform = m3.multiply(headTransform, localTransform);
    }
}

class RobotAntennaTip extends SceneObject {

    constructor(color) {
        super(antennaTipVertices(), color);
    }

    // pivô relativo à cabeça: ponta da antena (0, 0.28)
    updateModelTransform(headTransform) {
        const localTransform = m3.translation(0.0, 0.28);
        this.modelTransform = m3.multiply(headTransform, localTransform);
    }
}


// ==================================================
// CLASSE ARM (braço, movimento tipo pêndulo)
// ==================================================

class RobotArm extends SceneObject {

    constructor(color, xOffset, yOffset) {
        super(armVertices(), color);
        this.xOffset = xOffset;
        this.yOffset = yOffset;
        this.theta = 0.0;
    }

    updateRotation(theta) {
        this.theta = theta;
    }

    updateModelTransform(torsoTransform) {
        const localTransform = m3.multiply(
            m3.translation(this.xOffset, this.yOffset),
            m3.rotation(this.theta)
        );

        this.modelTransform = m3.multiply(torsoTransform, localTransform);
    }
}


// ==================================================
// CLASSE LEG (perna, movimento tipo pêndulo em fase oposta ao braço)
// ==================================================

class RobotLeg extends SceneObject {

    constructor(color, xOffset, yOffset) {
        super(legVertices(), color);
        this.xOffset = xOffset;
        this.yOffset = yOffset;
        this.theta = 0.0;
    }

    updateRotation(theta) {
        this.theta = theta;
    }

    updateModelTransform(torsoTransform) {
        const localTransform = m3.multiply(
            m3.translation(this.xOffset, this.yOffset),
            m3.rotation(this.theta)
        );

        this.modelTransform = m3.multiply(torsoTransform, localTransform);
    }
}


// ==================================================
// CLASSE ROBOT (composição: torso + cabeça + braços + pernas)
// ==================================================

class Robot {

    constructor(tx, ty, bodyColor, limbColor, speed, walkSpeed, headSpeed) {
        this.tx = tx;
        this.ty = ty;
        this.speed = speed;           // velocidade horizontal (unidades/seg)
        this.walkSpeed = walkSpeed;   // frequência do balanço de braços/pernas (rad/seg)
        this.headSpeed = headSpeed;   // frequência do giro da cabeça (independente!)
        this.time = 0.0;

        this.torso = new RobotTorso(bodyColor);
        this.head = new RobotHead(bodyColor);
        this.antenna = new RobotAntenna(limbColor);
        this.antennaTip = new RobotAntennaTip(new Float32Array([1.0, 0.2, 0.2]));

        this.leftArm = new RobotArm(limbColor, -0.185, 0.20);
        this.rightArm = new RobotArm(limbColor, 0.185, 0.20);

        this.leftLeg = new RobotLeg(limbColor, -0.07, -0.25);
        this.rightLeg = new RobotLeg(limbColor, 0.07, -0.25);
    }

    // deltaTime em segundos (independência de taxa de quadros)
    move(deltaTime) {
        this.time += deltaTime;

        // --- movimento do corpo inteiro (translação horizontal) ---
        this.tx += this.speed * deltaTime;

        if (this.tx > 1.6 || this.tx < -1.6) {
            this.speed = -this.speed;
        }

        // leve "quique" vertical do corpo, simulando o passo
        const bounce = 0.02 * Math.abs(Math.sin(this.walkSpeed * this.time));
        const robotTransform = m3.translation(this.tx, this.ty + bounce);

        this.torso.updateModelTransform(robotTransform);

        // --- cabeça: gira de um lado pro outro, com frequência PRÓPRIA ---
        const headTheta = 0.35 * Math.sin(this.headSpeed * this.time);
        this.head.updateRotation(headTheta);
        this.head.updateModelTransform(robotTransform);

        this.antenna.updateModelTransform(this.head.modelTransform);
        this.antennaTip.updateModelTransform(this.head.modelTransform);

        // --- braços: balanço tipo pêndulo ---
        const armAmplitude = 0.6;
        this.leftArm.updateRotation(armAmplitude * Math.sin(this.walkSpeed * this.time));
        this.rightArm.updateRotation(armAmplitude * Math.sin(this.walkSpeed * this.time + Math.PI));

        this.leftArm.updateModelTransform(robotTransform);
        this.rightArm.updateModelTransform(robotTransform);

        // --- pernas: balanço em fase OPOSTA aos braços (andar realista) ---
        const legAmplitude = 0.5;
        this.leftLeg.updateRotation(legAmplitude * Math.sin(this.walkSpeed * this.time + Math.PI));
        this.rightLeg.updateRotation(legAmplitude * Math.sin(this.walkSpeed * this.time));

        this.leftLeg.updateModelTransform(robotTransform);
        this.rightLeg.updateModelTransform(robotTransform);
    }

    draw(renderer) {
        renderer.draw(this.leftLeg);
        renderer.draw(this.rightLeg);
        renderer.draw(this.torso);
        renderer.draw(this.leftArm);
        renderer.draw(this.rightArm);
        renderer.draw(this.head);
        renderer.draw(this.antenna);
        renderer.draw(this.antennaTip);
    }
}


// ==================================================
// CLASSE SCENE
// ==================================================

class Scene {

    constructor(gl, program) {
        this.renderer = new Renderer(gl, program);

        this.viewTransform = m3.setClippingWindow(-2.0, -1.0, 2.0, 1.0);
        this.renderer.defineViewTransform(this.viewTransform);

        this.floor = new Floor();

        this.robots = [
            new Robot(
                -1.5, -0.15,
                new Float32Array([0.85, 0.15, 0.15]), // corpo vermelho
                new Float32Array([0.2, 0.2, 0.2]),    // membros cinza
                0.35,   // velocidade horizontal
                6.0,    // velocidade de balanço (braços/pernas)
                1.2     // velocidade da cabeça (diferente!)
            ),

            new Robot(
                0.5, -0.15,
                new Float32Array([0.15, 0.4, 0.85]),  // corpo azul
                new Float32Array([0.85, 0.85, 0.85]), // membros claros
                -0.25,
                4.5,
                2.0
            ),

            new Robot(
                -0.6, -0.15,
                new Float32Array([0.2, 0.7, 0.3]),    // corpo verde
                new Float32Array([0.15, 0.15, 0.15]), // membros pretos
                0.5,
                7.5,
                0.8
            )
        ];

        this.lastTime = 0;
    }

    update(deltaTime) {
        for (const robot of this.robots) {
            robot.move(deltaTime);
        }
    }

    draw() {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);

        this.floor.draw(this.renderer);

        for (const robot of this.robots) {
            robot.draw(this.renderer);
        }
    }

    execute(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000; // segundos
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame((t) => this.execute(t));
    }

    init() {
        requestAnimationFrame((timestamp) => {
            this.lastTime = timestamp;
            this.execute(timestamp);
        });
    }
}


// ==================================================
// CONFIGURAÇÃO INICIAL DO WEBGL
// ==================================================

gl.clearColor(0.92, 0.92, 0.92, 1.0);
gl.viewport(0, 0, canvas.width, canvas.height);


// ==================================================
// CRIAR CENA E INICIAR ANIMAÇÃO
// ==================================================

const scene = new Scene(gl, program);
scene.init();
