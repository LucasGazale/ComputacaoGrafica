// ==================================================
// CLASS - SCENE
// ==================================================

class Scene {

    constructor(gl, program) {

        this.renderer =
            new Renderer(gl, program);

        // Figura que será exibida
        this.helicopterBody = new HelicopterBody();

        this.helicopterTopShaft = new HelicopterTopShaft();

        this.helicopterTail = new HelicopterTail();

        this.helicopterPropellers = new HelicopterPropellers();

        this.helicopterTailPropeller = new HelicopterTailPropeller();

        // ==============================================
        // POSIÇÃO DO HELICÓPTERO NA CENA
        // (não há matriz de projeção/câmera neste projeto,
        // então x e y do modelo já correspondem a
        // esquerda/direita e cima/baixo na tela)
        // ==============================================
        this.posX = 0.0;
        this.posY = 0.0;
        this.moveSpeed = 0.015;

        // Limites para o helicóptero não sair da área visível
        this.limits = {
            minX: -0.7, maxX: 0.4,
            minY: -0.75, maxY: 0.75
        };

        // ==============================================
        // ROTAÇÃO DAS HÉLICES
        // ==============================================
        this.mainRotorAngle = 0.0;
        this.tailRotorAngle = 0.0;

        this.mainRotorSpeed = 0.35; // rad/frame - hélice superior
        this.tailRotorSpeed = 0.6;  // rad/frame - hélice de cauda

        // Pivô (centro) da hélice de cauda, para ela girar
        // em torno do próprio eixo, e não do eixo global.
        // Calculado a partir das coordenadas dela em
        // helicopterGeometry.js (x ~0.55–0.85, z ~0.05–0.07).
        this.tailRotorPivot = [0.7, 0.0, 0.06];

        // ==============================================
        // TECLADO
        // ==============================================
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false
        };

        this._bindKeyboardEvents();
    }

    _bindKeyboardEvents() {

        window.addEventListener("keydown", (e) => {
            if (e.key in this.keys) {
                this.keys[e.key] = true;
                e.preventDefault(); // evita rolar a página com as setas
            }
        });

        window.addEventListener("keyup", (e) => {
            if (e.key in this.keys) {
                this.keys[e.key] = false;
                e.preventDefault();
            }
        });
    }

    updatePosition() {

        if (this.keys.ArrowUp)    this.posY += this.moveSpeed;
        if (this.keys.ArrowDown)  this.posY -= this.moveSpeed;
        if (this.keys.ArrowLeft)  this.posX -= this.moveSpeed;
        if (this.keys.ArrowRight) this.posX += this.moveSpeed;

        // Mantém o helicóptero dentro da área visível
        this.posX = Math.min(Math.max(this.posX, this.limits.minX), this.limits.maxX);
        this.posY = Math.min(Math.max(this.posY, this.limits.minY), this.limits.maxY);
    }

    update() {

        this.updatePosition();

        // As hélices giram sempre, mesmo parado ou em movimento
        this.mainRotorAngle += this.mainRotorSpeed;
        this.tailRotorAngle += this.tailRotorSpeed;

        // Transformação base: posição atual do helicóptero na cena
        const baseTransform =
            m4.translation(this.posX, this.posY, 0);

        // Corpo, haste e cauda só acompanham a posição (não giram)
        this.helicopterBody.update(baseTransform);
        this.helicopterTopShaft.update(baseTransform);
        this.helicopterTail.update(baseTransform);

        // --------------------------------------------------
        // Hélice superior: gira em torno do próprio eixo Y
        // (já está centralizada em x=0, z=0), e acompanha
        // a posição do helicóptero.
        // --------------------------------------------------
        const mainRotorTransform = m4.multiply(
            baseTransform,
            m4.yRotation(this.mainRotorAngle)
        );
        this.helicopterPropellers.update(mainRotorTransform);

        // --------------------------------------------------
        // Hélice de cauda: gira em torno do seu próprio pivô
        // (eixo Z, perpendicular ao plano das pás) e acompanha
        // a posição do helicóptero.
        // --------------------------------------------------
        const [px, py, pz] = this.tailRotorPivot;

        let tailRotorTransform = m4.translation(-px, -py, -pz);
        tailRotorTransform = m4.multiply(
            m4.zRotation(this.tailRotorAngle),
            tailRotorTransform
        );
        tailRotorTransform = m4.multiply(
            m4.translation(px, py, pz),
            tailRotorTransform
        );
        tailRotorTransform = m4.multiply(
            baseTransform,
            tailRotorTransform
        );

        this.helicopterTailPropeller.update(tailRotorTransform);
    }

    draw() {

        gl.clear(
            gl.COLOR_BUFFER_BIT |
            gl.DEPTH_BUFFER_BIT
        );

        gl.useProgram(program);

        this.helicopterBody.draw(
            this.renderer
        );

        this.helicopterTopShaft.draw(
            this.renderer
        );

        this.helicopterTail.draw(
            this.renderer
        );

        this.helicopterPropellers.draw(
            this.renderer
        );

        this.helicopterTailPropeller.draw(
            this.renderer
        );
    }

    execute() {

        this.update();
        this.draw();

        requestAnimationFrame(
            () => this.execute()
        );
    }

    init() {

        requestAnimationFrame(
            () => this.execute()
        );
    }
}
