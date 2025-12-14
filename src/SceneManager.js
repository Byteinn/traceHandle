import * as THREE from 'three';
import { ParticleTree } from './ParticleTree.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.scene = new THREE.Scene();
        // Dark Night Sky for magical glow contrast
        this.scene.background = new THREE.Color(0x0a1a2a); // Midnight Blue
        this.scene.fog = new THREE.Fog(0x0a1a2a, 20, 50); // Darker fog matching background

        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.z = 10; // Moved back for full view

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: false, antialias: true }); // Enable antialias for sharp points
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ReinhardToneMapping;

        // Post-processing setup
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Bloom Pass - Magical but controlled
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.6; // Higher threshold so background doesn't glow
        bloomPass.strength = 1.2; // Strong magical glow
        bloomPass.radius = 0.5; // Medium soft radius
        this.composer.addPass(bloomPass);

        this.tree = new ParticleTree(this.scene);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.composer.setSize(this.width, this.height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.tree.update();
        // this.renderer.render(this.scene, this.camera); // Replaced by composer
        this.composer.render();
    }
}
