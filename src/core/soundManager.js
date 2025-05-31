/**
 * @module core/soundManager
 * @description Manages procedural sound generation for the application.
 */

let audioContext = null;
let masterOutput = null;
let reverbNode = null;
let reverbSendGain = null;
let dryGain = null;


const REVERB_WET_LEVEL = 0.35;
const REVERB_DRY_LEVEL = 0.65;

const DEFAULT_SOUND_MAX_GAIN = 0.6;
const DEFAULT_NOISE_BUFFER_DURATION = 0.1;

const DEFAULT_ENV_BASE_ATTACK_TIME = 0.008; 
const DEFAULT_ENV_ATTACK_INTENSITY_FACTOR = 0.005;
const DEFAULT_ENV_BASE_DECAY_TIME = 0.1; 
const DEFAULT_ENV_DECAY_INTENSITY_FACTOR = 0.04;
const DEFAULT_ENV_SUSTAIN_LEVEL = 0.0001;

const DEFAULT_FILTER_BASE_FREQUENCY = 150; 
const DEFAULT_FILTER_FREQUENCY_INTENSITY_FACTOR = 1500;
const DEFAULT_FILTER_BASE_Q = 0.8; 
const DEFAULT_FILTER_Q_INTENSITY_FACTOR = 3;

const DEFAULT_SOURCE_STOP_BASE_OFFSET = 0.15; 
const DEFAULT_SOURCE_STOP_INTENSITY_FACTOR = 0.05;

const CUBE_SOUND_MAX_GAIN = 0.5;
const CUBE_NOISE_BUFFER_DURATION = 0.12;


const CUBE_ENV_BASE_ATTACK_TIME = 0.01;
const CUBE_ENV_ATTACK_INTENSITY_FACTOR = 0.003;
const CUBE_ENV_BASE_DECAY_TIME = 0.15;
const CUBE_ENV_DECAY_INTENSITY_FACTOR = 0.03;
const CUBE_ENV_SUSTAIN_LEVEL = 0.0001;


const CUBE_FILTER_BASE_FREQUENCY = 80;
const CUBE_FILTER_FREQUENCY_INTENSITY_FACTOR = 800;
const CUBE_FILTER_BASE_Q = 0.5;
const CUBE_FILTER_Q_INTENSITY_FACTOR = 1.5;


const CUBE_SOURCE_STOP_BASE_OFFSET = 0.20;
const CUBE_SOURCE_STOP_INTENSITY_FACTOR = 0.04;


/**
 * Creates a simple synthetic impulse response for the reverb.
 */
function createImpulseResponse() {
    if (!audioContext) return null;
    const sampleRate = audioContext.sampleRate;
    const duration = 1.5; 
    const decay = 3.0; 
    const length = sampleRate * duration;
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / duration, decay);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / duration, decay * 0.85);
    }
    return impulse;
}

/**
 * Initializes the Web Audio API AudioContext and the main audio graph.
 */
function initAudio() {
    console.log("Attempting to initialize AudioContext and audio graph...");
    if (!audioContext && typeof window !== 'undefined' && window.AudioContext) {
        audioContext = new window.AudioContext();
        masterOutput = audioContext.createGain();
        masterOutput.connect(audioContext.destination);
        reverbNode = audioContext.createConvolver();
        const impulseResponse = createImpulseResponse();
        if (impulseResponse) {
            reverbNode.buffer = impulseResponse;
            console.log("Impulse response created and set for reverb.");
        } else {
            console.warn("Failed to create impulse response for reverb.");
        }
        reverbNode.connect(masterOutput); 
        reverbSendGain = audioContext.createGain();
        reverbSendGain.gain.value = REVERB_WET_LEVEL;
        reverbSendGain.connect(reverbNode);
        dryGain = audioContext.createGain();
        dryGain.gain.value = REVERB_DRY_LEVEL;
        dryGain.connect(masterOutput);
        console.log("AudioContext and base audio graph initialized successfully. State:", audioContext.state);
    } else if (audioContext) {
        console.log("AudioContext already initialized. State:", audioContext.state);
    } else {
        console.warn("Web Audio API not supported or not in a browser environment. AudioContext not created.");
    }
}

/**
 * Plays a procedurally generated collision sound with filter and reverb.
 * @param {object} collisionDetails - Details about the collision.
 * @param {number} collisionDetails.intensity - The intensity of the collision.
 * @param {string} collisionDetails.typeA - Type of the first colliding body.
 * @param {string} collisionDetails.typeB - Type of the second colliding body.
 */
function playCollisionSound(collisionDetails) {
    console.log("playCollisionSound called with details:", collisionDetails);
    if (!audioContext || !dryGain || !reverbSendGain) {
        console.warn("AudioContext or essential audio nodes not initialized. Attempting to initialize...");
        initAudio(); 
        if (!audioContext || !dryGain || !reverbSendGain) {
            console.error("Failed to initialize AudioContext/graph in playCollisionSound. Cannot play sound.");
            return;
        }
    }

    if (audioContext.state === 'suspended') {
        console.log("AudioContext is suspended. Attempting to resume...");
        audioContext.resume().then(() => {
            console.log("AudioContext resumed successfully.");
            proceedWithSoundGeneration(collisionDetails);
        }).catch(err => {
            console.error("Error resuming AudioContext:", err);
        });
    } else {
        console.log("AudioContext is active. Proceeding with sound generation.");
        proceedWithSoundGeneration(collisionDetails);
    }
}

/**
 * Internal function to generate and play the sound once AudioContext is confirmed to be active/resumed.
 * This function sets up the audio nodes (noise source, filter, envelope) based on collision intensity and object types.
 * @param {object} collisionDetails - Details about the collision.
 * @param {number} collisionDetails.intensity - The intensity of the collision.
 * @param {string} collisionDetails.typeA - Type of the first colliding body.
 * @param {string} collisionDetails.typeB - Type of the second colliding body.
 * @private
 */
function proceedWithSoundGeneration(collisionDetails) {
    if (!audioContext || audioContext.state !== 'running' || !dryGain || !reverbSendGain) {
        console.warn(`Cannot generate sound, AudioContext not available/running or essential nodes missing. State: ${audioContext?.state}`);
        return;
    }
    const intensity = collisionDetails.intensity || 0.5;
    const typeA = collisionDetails.typeA;
    const typeB = collisionDetails.typeB;

    console.log(`Generating sound with intensity: ${intensity}, types: ${typeA}, ${typeB}`);

    let soundMaxGain, noiseBufferDuration;
    let envBaseAttack, envAttackFactor, envBaseDecay, envDecayFactor, envSustain;
    let filterBaseFreq, filterFreqFactor, filterBaseQ, filterQFactor;
    let stopBaseOffset, stopIntensityFactor;

    const useCubeProfile = 
        (typeA === 'box' && typeB === 'box') || 
        (typeA === 'box' && typeB === 'boundary') || 
        (typeA === 'boundary' && typeB === 'box');

    if (useCubeProfile) {
        console.log("Using CUBE/BOUNDARY sound profile.");
        soundMaxGain = CUBE_SOUND_MAX_GAIN;
        noiseBufferDuration = CUBE_NOISE_BUFFER_DURATION;
        envBaseAttack = CUBE_ENV_BASE_ATTACK_TIME;
        envAttackFactor = CUBE_ENV_ATTACK_INTENSITY_FACTOR;
        envBaseDecay = CUBE_ENV_BASE_DECAY_TIME;
        envDecayFactor = CUBE_ENV_DECAY_INTENSITY_FACTOR;
        envSustain = CUBE_ENV_SUSTAIN_LEVEL;
        filterBaseFreq = CUBE_FILTER_BASE_FREQUENCY;
        filterFreqFactor = CUBE_FILTER_FREQUENCY_INTENSITY_FACTOR;
        filterBaseQ = CUBE_FILTER_BASE_Q;
        filterQFactor = CUBE_FILTER_Q_INTENSITY_FACTOR;
        stopBaseOffset = CUBE_SOURCE_STOP_BASE_OFFSET;
        stopIntensityFactor = CUBE_SOURCE_STOP_INTENSITY_FACTOR;
    } else {
        console.log("Using DEFAULT/SPHERE sound profile.");
        soundMaxGain = DEFAULT_SOUND_MAX_GAIN;
        noiseBufferDuration = DEFAULT_NOISE_BUFFER_DURATION;
        envBaseAttack = DEFAULT_ENV_BASE_ATTACK_TIME;
        envAttackFactor = DEFAULT_ENV_ATTACK_INTENSITY_FACTOR;
        envBaseDecay = DEFAULT_ENV_BASE_DECAY_TIME;
        envDecayFactor = DEFAULT_ENV_DECAY_INTENSITY_FACTOR;
        envSustain = DEFAULT_ENV_SUSTAIN_LEVEL;
        filterBaseFreq = DEFAULT_FILTER_BASE_FREQUENCY;
        filterFreqFactor = DEFAULT_FILTER_FREQUENCY_INTENSITY_FACTOR;
        filterBaseQ = DEFAULT_FILTER_BASE_Q;
        filterQFactor = DEFAULT_FILTER_Q_INTENSITY_FACTOR;
        stopBaseOffset = DEFAULT_SOURCE_STOP_BASE_OFFSET;
        stopIntensityFactor = DEFAULT_SOURCE_STOP_INTENSITY_FACTOR;
    }

    const now = audioContext.currentTime;

    const bufferSize = audioContext.sampleRate * noiseBufferDuration;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filterNode = audioContext.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.setValueAtTime(filterBaseFreq + Math.min(intensity, 1.0) * filterFreqFactor, now); 
    filterNode.Q.setValueAtTime(filterBaseQ + intensity * filterQFactor, now);

    const envelopeGain = audioContext.createGain();
    const effectiveGain = Math.min(intensity, 1.0) * soundMaxGain;
    envelopeGain.gain.setValueAtTime(0, now);
    const attackTime = envBaseAttack + (intensity * envAttackFactor);
    const decayTime = envBaseDecay + (intensity * envDecayFactor);
    envelopeGain.gain.linearRampToValueAtTime(effectiveGain, now + attackTime);
    envelopeGain.gain.exponentialRampToValueAtTime(envSustain, now + attackTime + decayTime);

    noiseSource.connect(filterNode);
    filterNode.connect(envelopeGain);
    envelopeGain.connect(dryGain);
    envelopeGain.connect(reverbSendGain);
    
    noiseSource.start(now);
    const stopTime = now + stopBaseOffset + (intensity * stopIntensityFactor);
    noiseSource.stop(stopTime); 
    console.log(`Sound generation complete. Attack: ${attackTime.toFixed(4)}s, Decay: ${decayTime.toFixed(4)}s, Stop: ${stopTime.toFixed(4)}s`);
}

export {
    initAudio,
    playCollisionSound,
    setSoundEffectsVolume
};

/**
 * Sets the master volume for all sound effects.
 * @param {number} volume - The desired volume level (0.0 to 1.0).
 */
function setSoundEffectsVolume(volume) {
    if (masterOutput && masterOutput.gain) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        masterOutput.gain.setValueAtTime(clampedVolume, audioContext.currentTime);
        console.log(`Sound effects master volume set to: ${clampedVolume}`);
    } else {
        console.warn("Cannot set sound effects volume: masterOutput gain node not initialized. Attempting initAudio.");
        initAudio();
        if (masterOutput && masterOutput.gain) {
            const clampedVolume = Math.max(0, Math.min(1, volume));
            masterOutput.gain.setValueAtTime(clampedVolume, audioContext.currentTime);
            console.log(`Sound effects master volume set to: ${clampedVolume} after re-init.`);
        } else {
            console.error("Failed to set sound effects volume even after re-init attempt.");
        }
    }
}
