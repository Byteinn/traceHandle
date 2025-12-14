import * as THREE from 'three';

const vertexShader = `
uniform float uTime;
uniform float uPixelRatio;
attribute float size;
attribute vec3 customColor;
attribute float opacity;
varying vec3 vColor;
varying float vAlpha;

void main() {
    vColor = customColor;
    vAlpha = opacity;
    
    // Minimal breathing
    vec3 animatedPosition = position;
    // VERY subtle movement
    // float wind = sin(uTime * 0.5 + position.x * 0.2) * 0.05;
    // animatedPosition.x += wind;

    vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
    
    // Size attenuation (doubled for visibility)
    gl_PointSize = size * uPixelRatio * (12.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
uniform sampler2D pointTexture;
varying vec3 vColor;
varying float vAlpha;

void main() {
    // Soft glowing circle
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(gl_PointCoord, center);
    if (dist > 0.5) discard;
    
    // Soft gradient for magical glow
    float glow = 1.0 - (dist * 2.0);
    glow = pow(glow, 1.5); // Softer falloff for dreamy effect
    
    gl_FragColor = vec4(vColor, vAlpha * glow);
}
`;

export class ParticleTree {
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.meteors = null; // Line segments for meteors

        // Tree config
        this.treeCount = 20000; // High definition
        this.meteorCount = 100; // Number of active meteors

        // Geometry Data
        this.treeGeometry = new THREE.BufferGeometry();
        this.meteorGeometry = new THREE.BufferGeometry();

        // Arrays for tree
        this.treePositions = new Float32Array(this.treeCount * 3);
        this.treeTargetPositions = new Float32Array(this.treeCount * 3);
        this.treeColors = new Float32Array(this.treeCount * 3);
        this.treeSizes = new Float32Array(this.treeCount);
        this.treeOpacities = new Float32Array(this.treeCount);

        this.state = 'formed';
        this.rotationSpeed = 0;

        this.uniforms = {
            uTime: { value: 0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        };

        this.initParticles();
        this.initMeteors();
    }

    initParticles() {
        const color = new THREE.Color();

        for (let i = 0; i < this.treeCount; i++) {
            // Generate Banyan Shape
            const { x, y, z, type } = this.getBanyanPosition(i);

            // Set Positions
            this.treePositions[i * 3] = x;
            this.treePositions[i * 3 + 1] = y;
            this.treePositions[i * 3 + 2] = z;

            this.treeTargetPositions[i * 3] = x;
            this.treeTargetPositions[i * 3 + 1] = y;
            this.treeTargetPositions[i * 3 + 2] = z;

            // Colors & Sizes based on type
            let size = 1.0;
            let opacity = 1.0;

            if (type === 'trunk') {
                // Warm brown trunk
                const r = Math.random();
                if (r > 0.97) {
                    // Golden highlights
                    color.setHSL(0.08, 0.7, 0.6);
                    size = 2.5;
                } else {
                    // Dark to medium brown
                    color.setHSL(0.06, 0.4, 0.15 + (Math.random() * 0.25));
                    size = 0.8 + Math.random() * 0.5;
                }
                opacity = 0.9;
            } else if (type === 'root') {
                // Lighter brown/grey roots
                color.setHSL(0.08, 0.3, 0.35 + Math.random() * 0.15);
                size = 0.7;
                opacity = 0.7;
            } else if (type === 'leaves') {
                // Magical pink/purple/white gradient
                const r = Math.random();
                if (r > 0.85) {
                    // Pure white sparkles
                    color.setHex(0xffffff);
                    size = 2.0;
                    opacity = 1.0;
                } else if (r > 0.65) {
                    // Light pink
                    color.setHSL(0.89, 1.0, 0.85); // hsl(320, 100%, 85%)
                    size = 1.5 + Math.random() * 0.5;
                    opacity = 0.95;
                } else if (r > 0.35) {
                    // Medium pink
                    color.setHSL(0.86, 0.9, 0.75); // hsl(310, 90%, 75%)
                    size = 1.3 + Math.random() * 0.5;
                    opacity = 0.9;
                } else {
                    // Deep purple
                    color.setHSL(0.81, 0.8, 0.70); // hsl(290, 80%, 70%)
                    size = 1.2 + Math.random();
                    opacity = 0.85;
                }
            }

            this.treeColors[i * 3] = color.r;
            this.treeColors[i * 3 + 1] = color.g;
            this.treeColors[i * 3 + 2] = color.b;
            this.treeSizes[i] = size; // No huge multiplier
            this.treeOpacities[i] = opacity;
        }

        this.treeGeometry.setAttribute('position', new THREE.BufferAttribute(this.treePositions, 3));
        this.treeGeometry.setAttribute('customColor', new THREE.BufferAttribute(this.treeColors, 3));
        this.treeGeometry.setAttribute('size', new THREE.BufferAttribute(this.treeSizes, 1));
        this.treeGeometry.setAttribute('opacity', new THREE.BufferAttribute(this.treeOpacities, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            blending: THREE.AdditiveBlending, // Additive for magical glow
            depthWrite: false,
            transparent: true,
        });

        this.particles = new THREE.Points(this.treeGeometry, material);
        this.scene.add(this.particles);
    }

    initMeteors() {
        // Line Segments for Meteors
        // Each meteor has 2 points: Head and Tail
        const positions = new Float32Array(this.meteorCount * 2 * 3); // 2 vertices per line, 3 coords
        const colors = new Float32Array(this.meteorCount * 2 * 3);

        // Initialize meteors off screen
        this.meteorData = []; // Store velocity/state

        for (let i = 0; i < this.meteorCount; i++) {
            this.meteorData.push(this.resetMeteor({}, true));
        }

        this.meteorGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.meteorGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.8, // Increased opacity for better visibility
            linewidth: 2 // Try to request thicker lines (driver dependent)
        });

        this.meteors = new THREE.LineSegments(this.meteorGeometry, material);
        this.scene.add(this.meteors);
    }

    resetMeteor(data, randomStart) {
        // Spawn on right side, fly left
        const x = randomStart ? (Math.random() * 40 - 20) : (20 + Math.random() * 10);
        const y = (Math.random() * 20 - 10); // Vertical spread
        const z = (Math.random() * 10 - 20); // Behind tree mostly

        data.pos = new THREE.Vector3(x, y, z);
        data.velocity = new THREE.Vector3(-0.3 - Math.random() * 0.3, -0.05 - Math.random() * 0.1, 0); // Fly left-down
        data.length = 3.0 + Math.random() * 6.0; // Doubled length (was 1.5-3.5)

        // Magical comet colors - white and light blue
        const r = Math.random();
        if (r > 0.5) data.color = new THREE.Color(0xffffff); // Pure white
        else data.color = new THREE.Color(0xadd8e6); // Light blue

        return data;
    }

    getBanyanPosition(i) {
        // Same logic but tighter params if needed? 
        // Logic seems fine, it was likely just the rendering

        const r = Math.random();

        if (i < this.treeCount * 0.25) { // More trunk points
            const height = 4.0;
            const y = (Math.random() * height) - (height / 2) - 1.0;
            const progress = (y + (height / 2) + 1.0) / height;

            // Much tighter trunk for sharpness
            const radius = 0.3 + (1.0 - progress) * 1.5 + (Math.random() * 0.05);
            const angle = Math.random() * Math.PI * 2;

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            return { x, y, z, type: 'trunk' };
        }
        else if (i < this.treeCount * 0.35) {
            const dropHeight = 3.0;
            const y = (Math.random() * dropHeight) - 2.0;

            const radius = 1.2 + Math.random() * 2.5;
            const angle = Math.random() * Math.PI * 2;

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            return { x, y, z, type: 'root' };
        }
        else {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const r_sphere = 3.5 + Math.random() * 0.5; // Tighter shell

            let x = r_sphere * Math.sin(phi) * Math.cos(theta);
            let y = r_sphere * Math.sin(phi) * Math.sin(theta);
            let z = r_sphere * Math.cos(phi);

            y = Math.abs(y) * 0.6 + 0.5;

            x *= 1.5;
            z *= 1.5;

            return { x, y, z, type: 'leaves' };
        }
    }

    initAurora() {
        // Aurora Veil - Ribbon like structures
        const positions = new Float32Array(this.auroraCount * 3);
        const colors = new Float32Array(this.auroraCount * 3);
        const sizes = new Float32Array(this.auroraCount);
        const opacities = new Float32Array(this.auroraCount);

        const color = new THREE.Color();

        for (let i = 0; i < this.auroraCount; i++) {
            const t = i / this.auroraCount;
            const band = Math.floor(t * 3); // Fewer bands
            const angle = (t * Math.PI * 2) + band;

            // Push further back/out
            const radius = 12.0 + (Math.random() * 5.0);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Smoother wave
            const y = Math.sin(angle * 2.0) * 3.0 + (Math.random() - 0.5) * 2.0;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            if (Math.random() > 0.5) {
                color.setHex(0x00ffaa);
            } else {
                color.setHex(0xaa00ff);
            }

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            sizes[i] = (20.0 + Math.random() * 30.0) * 10.0; // Big soft blobs
            opacities[i] = 0.1 + Math.random() * 0.1; // Very transparent
        }

        this.auroraGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.auroraGeometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
        this.auroraGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        this.auroraGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

        // Re-use shader heavily modified for aurora flow? 
        // Or just use same shader but different params?
        // Let's use the same shader for coherence but rely on the sine wave in vertex shader

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader, // Reusing standard particle shader which has wave movement
            fragmentShader: fragmentShader,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
        });

        this.auroraParticles = new THREE.Points(this.auroraGeometry, material);
        this.scene.add(this.auroraParticles);
    }

    getDispersedPosition() {
        const r = 10 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);

        return {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi)
        };
    }

    form() {
        if (this.state === 'formed') return;
        this.state = 'formed';
        for (let i = 0; i < this.treeCount; i++) {
            const { x, y, z } = this.getBanyanPosition(i);
            this.treeTargetPositions[i * 3] = x;
            this.treeTargetPositions[i * 3 + 1] = y;
            this.treeTargetPositions[i * 3 + 2] = z;
        }
    }

    disperse() {
        if (this.state === 'dispersed') return;
        this.state = 'dispersed';
        for (let i = 0; i < this.treeCount; i++) {
            const { x, y, z } = this.getDispersedPosition();
            this.treeTargetPositions[i * 3] = x;
            this.treeTargetPositions[i * 3 + 1] = y;
            this.treeTargetPositions[i * 3 + 2] = z;
        }
    }

    rotate(normalizedX) {
        const speed = (normalizedX - 0.5) * 0.1;
        this.rotationSpeed = speed;
    }

    update() {
        this.uniforms.uTime.value += 0.01;

        // Update Tree positions
        const positions = this.treeGeometry.attributes.position.array;
        for (let i = 0; i < this.treeCount * 3; i++) {
            positions[i] += (this.treeTargetPositions[i] - positions[i]) * 0.06;
        }
        this.treeGeometry.attributes.position.needsUpdate = true;

        // Rotate
        if (this.particles) {
            this.particles.rotation.y += this.rotationSpeed;
            this.rotationSpeed *= 0.96;
        }

        // Update Meteors
        if (this.meteors) {
            const positions = this.meteorGeometry.attributes.position.array;
            const colors = this.meteorGeometry.attributes.color.array;

            for (let i = 0; i < this.meteorCount; i++) {
                const data = this.meteorData[i];
                // Move
                data.pos.add(data.velocity);

                // Head
                positions[i * 6] = data.pos.x;
                positions[i * 6 + 1] = data.pos.y;
                positions[i * 6 + 2] = data.pos.z;

                // Tail
                positions[i * 6 + 3] = data.pos.x - data.velocity.x * data.length; // Trail behind
                positions[i * 6 + 4] = data.pos.y - data.velocity.y * data.length;
                positions[i * 6 + 5] = data.pos.z - data.velocity.z * data.length;

                // Colors
                colors[i * 6] = data.color.r;
                colors[i * 6 + 1] = data.color.g;
                colors[i * 6 + 2] = data.color.b;

                colors[i * 6 + 3] = 0; // Black tail fade? Or same color?
                colors[i * 6 + 4] = 0;
                colors[i * 6 + 5] = 0;

                // Reset if out of bounds
                if (data.pos.x < -30) {
                    this.resetMeteor(data, false);
                }
            }
            this.meteorGeometry.attributes.position.needsUpdate = true;
            this.meteorGeometry.attributes.color.needsUpdate = true;
        }
    }
}
