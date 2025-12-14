import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class GestureController {
    constructor(videoElement) {
        this.video = videoElement;
        this.handLandmarker = null;
        this.runningMode = 'VIDEO';
        this.lastVideoTime = -1;
        this.listeners = {
            fist: [],
            open: [],
            move: []
        };
    }

    async initialize() {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );

        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: 'GPU'
            },
            runningMode: this.runningMode,
            numHands: 1
        });

        await this.setupCamera();
        this.predictWebcam();
    }

    async setupCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Browser API navigator.mediaDevices.getUserMedia not available');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 1280,
                height: 720
            }
        });

        this.video.srcObject = stream;

        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                resolve();
            };
        });
    }

    predictWebcam() {
        // Now let's detect the hand
        let startTimeMs = performance.now();

        if (this.lastVideoTime !== this.video.currentTime) {
            this.lastVideoTime = this.video.currentTime;
            const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);

            if (results.landmarks && results.landmarks.length > 0) {
                this.processGestures(results.landmarks[0]);
            }
        }

        window.requestAnimationFrame(() => this.predictWebcam());
    }

    processGestures(landmarks) {
        // 0 = Wrist
        // 8 = Index finger tip
        // 12 = Middle finger tip
        // 16 = Ring finger tip
        // 20 = Pinky tip
        // 4 = Thumb tip

        // Simple logic: Check if fingertips are close to palm (wrist/bases)
        // Actually, checking if tips are below a certain point relative to knuckles is better for "fist"
        // But let's use a simpler heuristic: Average distance of tips to wrist.

        const wrist = landmarks[0];
        const tips = [8, 12, 16, 20].map(i => landmarks[i]);

        // Calculate average distance from wrist to fingertips
        let totalDist = 0;
        tips.forEach(tip => {
            const d = Math.sqrt(
                Math.pow(tip.x - wrist.x, 2) +
                Math.pow(tip.y - wrist.y, 2) +
                Math.pow(tip.z - wrist.z, 2)
            );
            totalDist += d;
        });
        const avgDist = totalDist / 4;

        // Thresholds need tuning. 
        // Open hand usually > 0.3 (normalized coords)
        // Fist usually < 0.15

        if (avgDist < 0.2) {
            this.emit('fist');
        } else if (avgDist > 0.3) {
            this.emit('open');
        }

        // Rotation based on x position of wrist
        // x is 0 to 1. 
        this.emit('move', wrist.x);
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}
