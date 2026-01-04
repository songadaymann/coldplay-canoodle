// Toggle this to enable/disable debug visuals
const DEBUG = false; // <-- set to false to hide debug overlays

// Toggle this to switch between video mode and original PNG couple mode
const VIDEO_MODE = true; // <-- set to false to use original couple1.png/couple2.png system

// Toggle this to enable/disable background music
const MUSIC_ENABLED = true; // <-- set to false to disable music

// NFT-specific configuration
const NFT_MODE = true; // Enable NFT-specific features

// Detect if running in iframe (for OpenSea/NFT platforms)
const isInIframe = window.self !== window.top;

// Detect Web3 wallet presence
const hasWeb3 = typeof window.ethereum !== 'undefined';

const config = {
    type: Phaser.AUTO,
    render: {
        preserveDrawingBuffer: true  // Fix for iframe display issues
    },
    // Responsive scaling configuration with iframe support
    scale: {
        mode: Phaser.Scale.FIT,            // Maintain aspect ratio but fit within the parent
        autoCenter: Phaser.Scale.CENTER_BOTH, // Center the canvas horizontally & vertically
        parent: 'game-container',          // Target the container div for iframe compatibility
        width: 1536,
        height: 1024,
    },
    backgroundColor: "#000000",
    scene: {
        preload: preload,
        create: create,
        update: update,
    },
};

function preload() {
    // Load Google Font
    this.load.script('webfont', 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js');
    
    // Load the background image
    this.load.image('crowd', 'assets/crowd1.jpg');
    this.load.image('jumbotron', 'assets/jumbotron.png');
    // Close-up crowd image that will appear on the jumbotron screen
    this.load.image('crowd_big', 'assets/closeup-crowd-big.jpg');
    // --------------------------------------------------------------
    // NEW: Load 20 random close-up textures and the target couple
    for (let i = 1; i <= 20; i++) {
        this.load.image(`crowd${i}`, `assets/crowdshots/close-up-crowd${i}.webp`);
    }
    // Load assets based on mode
    if (VIDEO_MODE) {
        // Load the couple video that will play when found
        this.load.video('couple_video', 'assets/cheating-video-44442.webm', 'canplaythrough', true, true);
        // Load the couple WebP (first frame of the video)
        this.load.image('couple', 'assets/couple.webp');
    } else {
        // Load original couple WebPs
        this.load.image('target_happy', 'assets/couple1.webp');     // couple smiling
        this.load.image('target_surprised', 'assets/couple2.webp'); // couple surprised
    }
    // Load the camera operator
    this.load.image('cameraman', 'assets/cameraman.webp');
    
    
    // Load background music
    this.load.audio('bgmusic', 'assets/vida8bit.mp3');
    // Load win sound effect
    this.load.audio('winsound', 'assets/win-sound.mp3');

    // Load win video (will play on successful framing) - optimized for iframe contexts
    this.load.video('win_clip', 'assets/cheating-video-44442.webm', 'canplaythrough', true, true);
}

function create() {
    // Hide loading screen once game starts
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        document.body.classList.add('game-loaded');
    }
    
    // Add the image at the top-left corner
    const bg = this.add.image(0, 0, 'crowd').setOrigin(0, 0);

    // Scale the image so it covers the entire canvas while preserving aspect ratio
    const scaleX = this.cameras.main.width / bg.width;
    const scaleY = this.cameras.main.height / bg.height;
    const scale = Math.max(scaleX, scaleY);
    bg.setScale(scale).setScrollFactor(0);

    /* ----------------- Jumbotron Overlay -----------------
       Tweak these values to reposition/resize the jumbotron.
       width/height can be any numbers (in pixels) or null. If one is null,
       the image will scale proportionally based on the non-null dimension.
    ------------------------------------------------------*/
    const JUMBOTRON_CONFIG = {
        x: 600,      // Horizontal position in pixels (0 = left of canvas)
        y: 150,      // Vertical position in pixels (0 = top of canvas)
        width: 320,  // Desired width in pixels (null keeps original)
        height: 180, // Desired height in pixels (null keeps original)
    };

    // Dimensions of the transparent “screen” area inside the jumbotron (in the original, un-scaled art)
    const JUMBOTRON_INNER = {
        width: 405,
        height: 215,
        offsetX: 28, // distance from the left edge of the jumbotron art to the inner screen’s left edge
        offsetY: 26, // distance from the top edge of the jumbotron art to the inner screen’s top edge
    };

    // Create jumbotron sprite
    const jt = this.add.image(JUMBOTRON_CONFIG.x, JUMBOTRON_CONFIG.y, 'jumbotron').setOrigin(0, 0);

    // Resize according to config while preserving aspect ratio if one dimension is null
    if (JUMBOTRON_CONFIG.width !== null && JUMBOTRON_CONFIG.height !== null) {
        jt.setDisplaySize(JUMBOTRON_CONFIG.width, JUMBOTRON_CONFIG.height);
    } else if (JUMBOTRON_CONFIG.width !== null) {
        const aspect = jt.height / jt.width;
        jt.setDisplaySize(JUMBOTRON_CONFIG.width, JUMBOTRON_CONFIG.width * aspect);
    } else if (JUMBOTRON_CONFIG.height !== null) {
        const aspect = jt.width / jt.height;
        jt.setDisplaySize(JUMBOTRON_CONFIG.height * aspect, JUMBOTRON_CONFIG.height);
    }

    // Scale factor applied to the jumbotron image (so we can scale the inner rect the same amount)
    const jtScaleX = jt.displayWidth / jt.width;
    const jtScaleY = jt.displayHeight / jt.height;

    // Compute scaled inner-screen rectangle
    const innerX = JUMBOTRON_CONFIG.x + JUMBOTRON_INNER.offsetX * jtScaleX;
    const innerY = JUMBOTRON_CONFIG.y + JUMBOTRON_INNER.offsetY * jtScaleY;
    const innerW = JUMBOTRON_INNER.width * jtScaleX;
    const innerH = JUMBOTRON_INNER.height * jtScaleY;

    // Add a graphics rectangle (semi-transparent red) inside the jumbotron to visualize the inner area
    if (DEBUG) {
        const g = this.add.graphics();
        g.fillStyle(0xff0000, 0.3);
        g.fillRect(innerX, innerY, innerW, innerH);
        g.setDepth(20);
    }

    /* ----------------- Jumbotron SCREEN -----------------
       This invisible Zone represents the usable screen area where we
       will later place dynamic content (text, sprites, video, etc.).
    ------------------------------------------------------*/
    const screenZone = this.add.zone(innerX, innerY, innerW, innerH).setOrigin(0, 0);
    // Store reference for later steps
    this.jumbotronScreen = screenZone;
    // Ensure jumbotron appears on top of screen content
    screenZone.setDepth(5);
    jt.setDepth(10);

    // After creating screenZone and before setting depths, make it interactive so we only start drags inside the jumbotron screen
    screenZone.setInteractive({ cursor: 'pointer' });

    // ------------------ NEW: Dynamic "Kiss Cam" implementation ------------------
    // Render texture that acts as the jumbotron screen
    const screenRT = this.add.renderTexture(innerX, innerY, innerW, innerH)
        .setOrigin(0, 0)
        .setDepth(6); // behind frame, above background

    // Video object for couple video (hidden until needed) - only in video mode
    if (VIDEO_MODE) {
        const coupleVideo = this.add.video(innerX + innerW / 2, innerY + innerH / 2, 'couple_video')
            .setOrigin(0.5, 0.5)
            .setDepth(8)
            .setVisible(false);
        
        // Configure video for iframe compatibility
        coupleVideo.video.muted = true;
        coupleVideo.video.playsInline = true;
        coupleVideo.video.preload = 'auto';
        
        // Set size and current time once video is loaded
        coupleVideo.on('loadeddata', () => {
            coupleVideo.setDisplaySize(innerW, innerH);
            coupleVideo.setCurrentTime(0);
        });
        
        this.coupleVideo = coupleVideo;
    }

    // We'll use the couple.png image for the overlay now

    // --- Game state / constants ---
    const regularKeys = Array.from({ length: 20 }, (_, i) => `crowd${i + 1}`);
    const TARGET_VIDEO = 'couple_video';

    this.score = 0;
    const scoreText = this.add.text(16, 16, 'Score: 0', {
        fontSize: '32px',
        color: '#ffffff',
        fontFamily: 'Arial',
    }).setDepth(100);
    
    // NFT-specific UI elements
    if (NFT_MODE) {
        // Add NFT indicator in top-right corner
        const nftBadge = this.add.text(this.cameras.main.width - 16, 16, 'NFT', {
            fontSize: '20px',
            color: '#00ff88',
            fontFamily: '"Press Start 2P", monospace',
            backgroundColor: '#000000',
            padding: { x: 8, y: 4 }
        }).setOrigin(1, 0).setDepth(100);
        
        // Add platform indicator if in iframe
        if (isInIframe) {
            const platformText = this.add.text(this.cameras.main.width - 16, 50, 'OPENSEA', {
                fontSize: '12px',
                color: '#888888',
                fontFamily: '"Press Start 2P", monospace'
            }).setOrigin(1, 0).setDepth(100);
        }
        
        // Add wallet connection indicator if Web3 is available
        if (hasWeb3) {
            const walletText = this.add.text(16, 50, 'WEB3 READY', {
                fontSize: '12px',
                color: '#ffaa00',
                fontFamily: '"Press Start 2P", monospace'
            }).setOrigin(0, 0).setDepth(100);
        }
    }
    
    // Add background music (but don't start yet)
    const bgMusic = this.sound.add('bgmusic', { loop: true, volume: 0.5 });
    // Add win sound effect
    const winSound = this.sound.add('winsound', { volume: 0.8 });
    
    // Add music toggle button at top right (initially hidden)
    let musicPlaying = false;
    const musicToggle = this.add.text(this.cameras.main.width - 16, 16, '♪ OFF', {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial',
    }).setOrigin(1, 0).setDepth(100).setInteractive({ cursor: 'pointer' }).setVisible(false);
    
    musicToggle.on('pointerdown', () => {
        musicPlaying = !musicPlaying;
        if (musicPlaying) {
            bgMusic.play();
            musicToggle.setText('♪ ON');
        } else {
            bgMusic.stop();
            musicToggle.setText('♪ OFF');
        }
    });
    
    // Create intro screen with the working CSS font approach
    const createIntroScreen = () => {
        const introScreen = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2);
        introScreen.setDepth(200);
        
        // Modal background - wider and taller for sponsor logo
        const modalWidth = 850;
        const modalHeight = 520;
        const introBg = this.add.rectangle(0, 0, modalWidth, modalHeight, 0x000000, 0.9);
        introBg.setStrokeStyle(4, 0xffffff);
        introScreen.add(introBg);
        
        // Title text (moved up a bit)
        const titleText = this.add.text(0, -90, 'FIND THE COLDPLAY\nCANOODLERS!', {
            fontSize: '48px',
            color: '#ffffff',
            fontFamily: '"Press Start 2P", monospace',
            align: 'center',
            lineSpacing: 16
        }).setOrigin(0.5);
        introScreen.add(titleText);
        
        // Instructions with NFT context
        let instructionText;
        if (NFT_MODE && isInIframe) {
            instructionText = this.add.text(0, 5, 'Interactive NFT Game\nMove your mouse to search the crowd\nHold the target for 1 second to win!', {
                fontSize: '20px',
                color: '#ffffff',
                fontFamily: '"Press Start 2P", monospace',
                align: 'center',
                lineSpacing: 12
            }).setOrigin(0.5);
        } else {
            instructionText = this.add.text(0, 5, 'Move your mouse to search the crowd\nHold the target for 1 second to win!', {
                fontSize: '22px',
                color: '#ffffff',
                fontFamily: '"Press Start 2P", monospace',
                align: 'center',
                lineSpacing: 12
            }).setOrigin(0.5);
        }
        introScreen.add(instructionText);
        
        // Updated NFT info blurb
        if (NFT_MODE) {
            const nftInfoLines = [
                'by gamejew aka songadaymann',
                'aka jonathan mann',
                'This NFT commemorates the fact',
                'this went INSANELY VIRAL',
                'in the summer of 2025'
            ];
            const nftInfo = this.add.text(0, 110, nftInfoLines.join('\n'), {
                fontSize: '14px',
                color: '#00ff88',
                fontFamily: '"Press Start 2P", monospace',
                align: 'center',
                lineSpacing: 6
            }).setOrigin(0.5);
            introScreen.add(nftInfo);
        }
        
        
        // Close function
        const closeIntro = () => {
            introScreen.destroy();
            musicToggle.setVisible(true);
            if (MUSIC_ENABLED) {
                bgMusic.play();
                musicPlaying = true;
                musicToggle.setText('♪ ON');
            }
        };
        
        // X button (top right)
        const xButton = this.add.text(modalWidth / 2 - 30, -modalHeight / 2 + 30, 'X', {
            fontSize: '28px',
            color: '#ffffff',
            fontFamily: '"Press Start 2P", monospace',
        }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
        xButton.on('pointerdown', closeIntro);
        introScreen.add(xButton);
        
        // Red CLOSE button at bottom
        const closeButton = this.add.text(0, modalHeight / 2 - 65, 'CLOSE', {
            fontSize: '28px',
            color: '#ff0000',
            fontFamily: '"Press Start 2P", monospace',
        }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });
        closeButton.on('pointerdown', closeIntro);
        introScreen.add(closeButton);
    };
    
    // Use the working timeout approach that worked before
    setTimeout(createIntroScreen, 500);

    const scene = this; // preserve reference for nested callbacks

    // Probability helper (ramps from 5% to 50% over 30 seconds)
    function getTargetProbability(elapsed) {
        const base = 0.05;
        const max = 0.5;
        const ramp = 30000; // 30 s to reach max
        return Math.min(base + (elapsed / ramp) * (max - base), max);
    }

    // -------------------- CROWD SOURCE & SCROLLING --------------------
    // Hidden, scaled big crowd image as draw source
    const crowdSource = this.add.image(0, 0, 'crowd_big')
        .setOrigin(0, 0)
        .setScale(jtScaleX, jtScaleY)
        .setVisible(false);

    const bigW = crowdSource.displayWidth;
    const bigH = crowdSource.displayHeight;

    const maxOffsetX = bigW - innerW;
    const maxOffsetY = bigH - innerH;

    // -------------------- OVERLAY MANAGEMENT --------------------
    const OVERLAY_SCALE = 0.2; // scale factor for close-up overlays
    const COUPLE_SCALE = 0.08; // even smaller scale for couple image - more challenging!
    const baseOverlayW = this.textures.get(regularKeys[0]).getSourceImage().width;
    const OVERLAY_SIZE = baseOverlayW * jtScaleX * OVERLAY_SCALE; // approximate on‐screen width  (pixels)
    const MIN_DIST = OVERLAY_SIZE * 1.5; // minimal spacing between overlay centres

    // Target-specific scaled dimensions 
    const targetKey = VIDEO_MODE ? 'couple' : 'target_happy';
    const targetScale = VIDEO_MODE ? COUPLE_SCALE : OVERLAY_SCALE;
    const targetSrc = this.textures.get(targetKey).getSourceImage();
    const TARGET_W = targetSrc.width * jtScaleX * targetScale;
    const TARGET_H = targetSrc.height * jtScaleY * targetScale;

    const VISIBLE_THRESHOLD = 0.8; // percentage of target area that must be visible to count

    const regularOverlays = [];
    const targetOverlays = [];

    // ----------------- POSITION HELPERS -----------------
    // Simple dart-throwing sampler to distribute "count" points at least minDist apart.
    function generatePositions(count, minDist, width, height, maxAttempts = 10000) {
        const pts = [];
        let attempts = 0;
        while (pts.length < count && attempts < maxAttempts) {
            const { x, y } = randomPosInZones();
            let ok = true;
            for (const p of pts) {
                const dx = p.x - x;
                const dy = p.y - y;
                if (dx * dx + dy * dy < minDist * minDist) {
                    ok = false;
                    break;
                }
            }
            if (ok) pts.push({ x, y });
            attempts++;
        }
        // Fallback: if we couldn't place them all, relax the constraint for the remainder
        while (pts.length < count) {
            const { x, y } = randomPosInZones();
            pts.push({ x, y });
        }
        return pts;
    }

    // Reset board – reposition every overlay and ensure exactly one target
    function resetBoard() {
        regularOverlays.length = 0;
        targetOverlays.length = 0;

        // Custom generator that samples only within crowdZones
        const positions = [];
        let attempts = 0;
        while (positions.length < 21 && attempts < 15000) {
            const p = randomPosInZones();
            let ok = true;
            for (const q of positions) {
                const dx = q.x - p.x;
                const dy = q.y - p.y;
                if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) {
                    ok = false;
                    break;
                }
            }
            if (ok) positions.push(p);
            attempts++;
        }

        // Create a shuffled array of all 20 crowd images (no repeats)
        const shuffledCrowdKeys = [...regularKeys];
        Phaser.Utils.Array.Shuffle(shuffledCrowdKeys);

        positions.forEach((pos, idx) => {
            if (idx === 0) {
                // First point reserved for the target couple
                const targetKey = VIDEO_MODE ? 'couple' : 'target_happy';
                targetOverlays.push({ ...pos, key: targetKey });
            } else {
                // Use the shuffled crowd images (no repeats)
                const key = shuffledCrowdKeys[idx - 1];
                regularOverlays.push({ ...pos, key });
            }
        });
    }

    // Game-state flags now live on the scene so they are accessible from update()
    this.isLocked = false;
    this.fullTargetVisible = false; // set true each frame when couple fully in frame
    this.targetHoldTime = 0;       // ms accumulated while fully visible
    this.videoPlaying = false;     // flag to hide couple image when video plays

    const filmW = this.cameras.main.width;
    const filmH = this.cameras.main.height;

    // -------------------- CROWD PLAYABLE ZONES --------------------
    // Position the crowd bounds to match where the crowd actually appears in the stadium image
    const crowdZones = [
        {
            x: 0,  // Start at left edge
            y: filmH * 0.18,  // Start below the sky
            width: filmW,  // Full width
            height: filmH * 0.58,  // Height of just the crowd area
        },
    ];

    if (DEBUG) {
        crowdZones.forEach((z) => {
            this.add.rectangle(z.x, z.y, z.width, z.height, 0x00ff00, 0.15)
                .setOrigin(0, 0)
                .setDepth(80);
        });
    }

    // pick a random position within the allowed crowd zones
    // This generates positions in the big crowd image coordinate space
    function randomPosInZones() {
        // Generate positions across the entire big crowd image
        return {
            x: Math.random() * filmW,
            y: Math.random() * filmH,
        };
    }


    function shuffleOverlays() {
        // Shuffle positions only, keep the same keys to maintain no-repeat rule
        regularOverlays.forEach((o) => {
            const p = randomPosInZones();
            o.x = p.x;
            o.y = p.y;
        });
        targetOverlays.forEach((o) => {
            const p = randomPosInZones();
            o.x = p.x;
            o.y = p.y;
        });
    }

    function addTargetOverlay() {
        const pos = randomPosInZones();
        const targetKey = VIDEO_MODE ? 'couple' : 'target_happy';
        targetOverlays.push({ ...pos, key: targetKey });
    }

    // Initial board setup with optimal spacing
    resetBoard();

    // Make him smaller and move him to bottom left
    const cameraman = this.add.image(100, this.cameras.main.height - 10,
        'cameraman')
            .setOrigin(-1.2, 1)
            .setScale(0.6)
            .setDepth(50);
    
    // -------------------- CAMERAMAN VIEWFINDER --------------------
    // Adjust these values to position the viewfinder rectangle on the cameraman's camera
    const VIEWFINDER_CONFIG = {
        x: 1120,      // Horizontal position in pixels
        y: 476,      // Vertical position in pixels  
        width: 230,   // Width of the viewfinder
        height: 114,  // Height of the viewfinder
    };
    
    // Create mini render texture for the viewfinder (mirrors jumbotron content)
    const viewfinderRT = this.add.renderTexture(
        VIEWFINDER_CONFIG.x, 
        VIEWFINDER_CONFIG.y, 
        VIEWFINDER_CONFIG.width, 
        VIEWFINDER_CONFIG.height
    ).setOrigin(0, 0).setDepth(47); // Behind video (depth 48) and cameraman (depth 50)
    
    // Store reference for updating
    this.viewfinderRT = viewfinderRT;
    
    // ------------------------------------------------------------------
    // NEW: Create DOM <video> overlays instead of using Phaser video
    // These are positioned absolutely over the canvas so they never
    // touch WebGL, avoiding cross-origin restrictions in sandboxed NFTs
    // ------------------------------------------------------------------
    if (VIDEO_MODE) {
        const container = document.getElementById('game-container');

        const createDomVideo = (x, y, w, h) => {
            const vid = document.createElement('video');
            vid.src = 'assets/cheating-video-44442.webm';
            vid.muted = true;          // autoplay safety
            vid.playsInline = true;    // iOS / mobile
            vid.preload = 'auto';
            vid.loop = false;
            vid.style.position = 'absolute';
            vid.style.left = `${x}px`;
            vid.style.top = `${y}px`;
            vid.style.width = `${w}px`;
            vid.style.height = `${h}px`;
            vid.style.objectFit = 'cover';
            vid.style.pointerEvents = 'none';
            vid.style.display = 'none'; // hidden until needed
            vid.style.zIndex = 2;        // above canvas, below any UI overlays
            container.appendChild(vid);
            return vid;
        };

        // Pre-create DOM videos (we'll position them dynamically)
        this.domVideo = createDomVideo(0, 0, 0, 0);
        this.domViewVideo = createDomVideo(0, 0, 0, 0);

        // Helper to sync DOM video positions to the current canvas size
        const updateDomVideoPositions = () => {
            const rect = this.game.canvas.getBoundingClientRect();
            const scaleX = rect.width / config.scale.width;
            const scaleY = rect.height / config.scale.height;

            // Jumbotron video
            this.domVideo.style.left   = `${rect.left + innerX * scaleX}px`;
            this.domVideo.style.top    = `${rect.top  + innerY * scaleY}px`;
            this.domVideo.style.width  = `${innerW * scaleX}px`;
            this.domVideo.style.height = `${innerH * scaleY}px`;

            // Viewfinder video
            this.domViewVideo.style.left   = `${rect.left + VIEWFINDER_CONFIG.x * scaleX}px`;
            this.domViewVideo.style.top    = `${rect.top  + VIEWFINDER_CONFIG.y * scaleY}px`;
            this.domViewVideo.style.width  = `${VIEWFINDER_CONFIG.width  * scaleX}px`;
            this.domViewVideo.style.height = `${VIEWFINDER_CONFIG.height * scaleY}px`;
        };

        // Store reference so we can call in triggerWin and on resize
        this.updateDomVideoPositions = updateDomVideoPositions;

        // Initial sync and on window resize
        updateDomVideoPositions();
        window.addEventListener('resize', updateDomVideoPositions);
        //-------------------------------------------------------------
    }
    // ------------------------------------------------------------------
    
    // (Removed periodic shuffle/difficulty timers – board now resets only when target is found)

    // -------------------- RENDER HELPER --------------------
    function updateScreen(offsetX, offsetY) {
        // reset detection each frame
        scene.fullTargetVisible = false;
        screenRT.clear();
        screenRT.draw(crowdSource, -offsetX, -offsetY);
        
        // Also update the viewfinder with the same content
        scene.viewfinderRT.clear();
        scene.viewfinderRT.draw(crowdSource, -offsetX, -offsetY);

        // Map overlay positions (filmable coordinates) into crowd coords
        regularOverlays.forEach((o) => {
            const crowdX = (o.x / filmW) * maxOffsetX;
            const crowdY = (o.y / filmH) * maxOffsetY;

            const localX = crowdX - offsetX;
            const localY = crowdY - offsetY;
            if (localX + OVERLAY_SIZE > -OVERLAY_SIZE && localX < innerW && localY + OVERLAY_SIZE > -OVERLAY_SIZE && localY < innerH) {
                // Draw with desired scale (always regular scale for crowd images)
                const tmp = scene.add.image(localX, localY, o.key)
                    .setOrigin(0, 0)
                    .setScale(OVERLAY_SCALE * jtScaleX);
                screenRT.draw(tmp);
                scene.viewfinderRT.draw(tmp); // Also draw to viewfinder
                tmp.destroy();
            }
        });

        targetOverlays.forEach((t) => {
            const crowdX = (t.x / filmW) * maxOffsetX;
            const crowdY = (t.y / filmH) * maxOffsetY;

            const localX = crowdX - offsetX;
            const localY = crowdY - offsetY;
            const isOnScreen = localX + TARGET_W > 0 && localX < innerW && localY + TARGET_H > 0 && localY < innerH;

            // Compute visible area ratio
            const visibleLeft = Math.max(0, localX);
            const visibleTop = Math.max(0, localY);
            const visibleRight = Math.min(innerW, localX + TARGET_W);
            const visibleBottom = Math.min(innerH, localY + TARGET_H);
            const visibleW = Math.max(0, visibleRight - visibleLeft);
            const visibleH = Math.max(0, visibleBottom - visibleTop);
            const visibleArea = visibleW * visibleH;
            const totalArea = TARGET_W * TARGET_H;
            const fullyVisible = (visibleArea / totalArea) >= VISIBLE_THRESHOLD;

            if (DEBUG && isOnScreen) {
                console.log('Target on screen: fully?', fullyVisible, 'ratio', (visibleArea / totalArea).toFixed(2));
            }

            if (isOnScreen) {
                // Check if this is the target
                const isTarget = VIDEO_MODE ? (t.key === 'couple') : (t.key === 'target_happy' || t.key === 'target_surprised');
                
                // Skip rendering the couple image if video is playing
                if (VIDEO_MODE && isTarget && scene.videoPlaying) {
                    // Still check for visibility even though we're not rendering
                    if (fullyVisible) {
                        scene.fullTargetVisible = true;
                    }
                    return; // Don't render the couple image
                }
                
                // Use appropriate scale based on mode and target type
                let scaleToUse = OVERLAY_SCALE;
                if (VIDEO_MODE && t.key === 'couple') {
                    scaleToUse = COUPLE_SCALE;
                } else if (!VIDEO_MODE && (t.key === 'target_happy' || t.key === 'target_surprised')) {
                    scaleToUse = OVERLAY_SCALE;
                }
                
                const tmpT = scene.add.image(localX, localY, t.key)
                    .setOrigin(0, 0)
                    .setScale(scaleToUse * jtScaleX);
                screenRT.draw(tmpT);
                scene.viewfinderRT.draw(tmpT); // Also draw to viewfinder
                tmpT.destroy();
                
                // Check if this is the target and it's fully visible
                if (isTarget && fullyVisible) {
                    scene.fullTargetVisible = true;
                }
            }
        });
    }

    // Initial draw
    updateScreen(0, 0);

    // Define the filmable area
    const filmableArea = {
        x: 0,
        y: 0,
        width: this.cameras.main.width,
        height: this.cameras.main.height,
    };

    // DEBUG viewfinder
    let viewfinder;
    if (DEBUG) {
        viewfinder = this.add.rectangle(0, 0, innerW, innerH, 0xffffff, 0.2)
            .setStrokeStyle(2, 0xffffff)
            .setDepth(100)
            .setVisible(false);
    }

    // Track current offset so we can redraw when target changes state
    this.lastOffsetX = 0;
    this.lastOffsetY = 0;

    this.input.on('pointermove', (pointer) => {
        if (scene.isLocked) return;
        
        const zone = crowdZones[0];
        
        // Account for the viewfinder size when clamping
        const halfViewW = innerW / 2;
        const halfViewH = innerH / 2;
        
        // Clamp so the viewfinder stays fully within the crowd zone
        const clampedX = Math.max(zone.x + halfViewW, 
                                 Math.min(pointer.x, zone.x + zone.width - halfViewW));
        const clampedY = Math.max(zone.y + halfViewH, 
                                 Math.min(pointer.y, zone.y + zone.height - halfViewH));
        
        // Map to the crowd image coordinates
        const normX = (clampedX - zone.x - halfViewW) / (zone.width - innerW);
        const normY = (clampedY - zone.y - halfViewH) / (zone.height - innerH);
        
        const offsetX = Math.max(0, Math.min(normX * maxOffsetX, maxOffsetX));
        const offsetY = Math.max(0, Math.min(normY * maxOffsetY, maxOffsetY));

        this.lastOffsetX = offsetX;
        this.lastOffsetY = offsetY;

        updateScreen(offsetX, offsetY);

        if (DEBUG) {
            viewfinder.setVisible(true);
            viewfinder.setPosition(clampedX, clampedY);
        }
    });

    // NFT-specific social sharing function
    this.shareScore = (score) => {
        if (NFT_MODE && !isInIframe) {
            const gameTitle = "Find the Coldplay Canoodlers";
            const tweetText = `Just scored ${score} points in "${gameTitle}" - an interactive NFT game! 🎮✨ #NFTGaming #Coldplay #Web3`;
            const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
            window.open(tweetUrl, '_blank');
        }
    };

    // ----- WIN HANDLER (automatic, no click) ----------------
    this.triggerWin = () => {
        this.isLocked = true;
        
        // Play win sound effect
        winSound.play();
        
        this.score += 10;
        scoreText.setText(`Score: ${this.score}`);
        
        // NFT-specific milestone celebrations
        if (NFT_MODE && this.score % 50 === 0) {
            // Special celebration for milestone scores in NFT mode
            const milestoneText = this.add.text(this.cameras.main.width / 2, 100, `MILESTONE: ${this.score} POINTS!`, {
                fontSize: '24px',
                color: '#00ff88',
                fontFamily: '"Press Start 2P", monospace',
                align: 'center'
            }).setOrigin(0.5).setDepth(200);
            
            // Fade out milestone text
            this.tweens.add({
                targets: milestoneText,
                alpha: 0,
                y: 50,
                duration: 3000,
                ease: 'Power2',
                onComplete: () => milestoneText.destroy()
            });
        }

        if (VIDEO_MODE) {
            // ------------------ DOM video overlay path ------------------
            this.videoPlaying = true;
            // Hide the couple image immediately
            updateScreen(this.lastOffsetX, this.lastOffsetY);

            // Ensure videos are positioned correctly in case of resize before win
            if (this.updateDomVideoPositions) {
                this.updateDomVideoPositions();
            }

            const endHandler = () => {
                // Hide videos and clean up once playback finishes
                this.domVideo.style.display = 'none';
                this.domViewVideo.style.display = 'none';
                this.domVideo.removeEventListener('ended', endHandler);
                this.videoPlaying = false;
                this.isLocked = false;
                resetBoard();
                updateScreen(this.lastOffsetX, this.lastOffsetY);
            };

            // Prepare and show videos
            [this.domVideo, this.domViewVideo].forEach(v => {
                v.currentTime = 0;
                v.style.display = 'block';
                v.play();
            });
            // Listen for the main (jumbotron) video ending
            this.domVideo.addEventListener('ended', endHandler);
        } else {
            // ------------------ PNG fallback path ------------------
            targetOverlays.forEach((t) => (t.key = 'target_surprised'));
            updateScreen(this.lastOffsetX, this.lastOffsetY);

            // Reset after 2 seconds
            setTimeout(() => {
                this.isLocked = false;
                resetBoard();
                updateScreen(this.lastOffsetX, this.lastOffsetY);
            }, 2000);
        }
    };
    // ----------------------------------------------------------------
} // end create()

// -------------------- GAME UPDATE LOOP --------------------
function update(time, delta) {
    if (this.isLocked) return;

    if (this.fullTargetVisible) {
        this.targetHoldTime += delta;
        if (this.targetHoldTime >= 1000) {
            this.triggerWin();
            this.targetHoldTime = 0;
        }
    } else {
        this.targetHoldTime = 0;
    }
}
// -----------------------------------------------------------
// NFT-ready game initialization with error handling
function initGame() {
    try {
        // Create the Phaser game instance
        const game = new Phaser.Game(config);
        
        // Add global error handling for NFT platforms
        window.addEventListener('error', (e) => {
            console.warn('Game error (NFT-safe):', e.message);
            // Don't throw errors that could break NFT platform display
        });
        
        // Expose game instance for external access (useful for NFT platforms)
        if (NFT_MODE) {
            window.ColdplayGame = {
                game: game,
                version: '1.0.0',
                type: 'Interactive NFT Game',
                shareScore: function(score) {
                    if (game.scene.scenes[0] && game.scene.scenes[0].shareScore) {
                        game.scene.scenes[0].shareScore(score);
                    }
                }
            };
        }
        
        return game;
    } catch (error) {
        console.error('Failed to initialize game:', error);
        
        // Show fallback message if game fails to load
        const fallbackDiv = document.createElement('div');
        fallbackDiv.innerHTML = `
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: white;
                font-family: 'Press Start 2P', monospace;
                font-size: 16px;
            ">
                <div>GAME LOADING ERROR</div>
                <div style="font-size: 12px; margin-top: 20px; color: #888;">
                    Please refresh or try again
                </div>
            </div>
        `;
        document.getElementById('game-container').appendChild(fallbackDiv);
    }
}

// Initialize the game
const game = initGame(); 