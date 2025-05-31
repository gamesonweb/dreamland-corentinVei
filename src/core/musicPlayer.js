/**
 * @module musicPlayer
 * @description Handles the background music playback for the application.
 */

/** @type {HTMLAudioElement|null} Reference to the audio element used for music playback. */
let audio = null;

/**
 * Sets up the background music player.
 * Fetches a list of music tracks from 'assets/music/music-manifest.json',
 * creates an audio element, and plays tracks randomly in a loop.
 * @async
 */
export async function setupBackgroundMusicPlayer() {
  try {
    const response = await fetch('assets/music/music-manifest.json');
    if (!response.ok) {
      console.error('Failed to load music manifest:', response.statusText);
      return;
    }
    const manifest = await response.json();
    const tracks = manifest.tracks;

    if (!tracks || tracks.length === 0) {
      console.log('No music tracks found in manifest.');
      return;
    }

    audio = document.createElement('audio');
    audio.id = 'background-music-player';
    audio.loop = false;
    const storedVolume = parseFloat(localStorage.getItem('settings_musicVolume') || "0.75");
    audio.volume = Math.max(0, Math.min(1, storedVolume));
    console.log(`Initial music volume set to: ${audio.volume} from localStorage`);
    document.body.appendChild(audio);

    let interactionListenersActive = false;

    /**
     * Adds event listeners for the first user interaction to enable audio playback.
     * This is necessary due to browser autoplay policies.
     */
    const addInteractionListeners = () => {
      if (!interactionListenersActive) {
        console.log('Setting up listeners for first user interaction to play music.');
        document.addEventListener('click', handleFirstInteraction, { once: true, capture: true });
        document.addEventListener('mousedown', handleFirstInteraction, { once: true, capture: true });
        document.addEventListener('touchstart', handleFirstInteraction, { once: true, capture: true });
        document.addEventListener('keydown', handleFirstInteraction, { once: true, capture: true });
        interactionListenersActive = true;
      }
    };

    /**
     * Removes event listeners for user interaction if they were active.
     * Typically, {once: true} listeners remove themselves, but this ensures cleanup.
     */
    const removeInteractionListeners = () => {
        if (interactionListenersActive) {
            document.removeEventListener('click', handleFirstInteraction, { capture: true });
            document.removeEventListener('mousedown', handleFirstInteraction, { capture: true });
            document.removeEventListener('touchstart', handleFirstInteraction, { capture: true });
            document.removeEventListener('keydown', handleFirstInteraction, { capture: true });
            interactionListenersActive = false;
            console.log('Interaction listeners have been cleared or were self-removed.');
        }
    };

    /**
     * Attempts to play the audio if a source is set and it's currently paused.
     * Handles autoplay restrictions by adding interaction listeners if playback fails.
     */
    const attemptPlay = () => {
      if (audio.src && audio.paused) {
        audio.play()
          .then(() => {
            console.log('Audio playback started successfully.');
            if (interactionListenersActive) {
              removeInteractionListeners();
            }
          })
          .catch(error => {
            console.warn('Audio play attempt failed:', error.message, '(This is common before user interaction)');
            addInteractionListeners();
          });
      } else if (audio.src && !audio.paused) {
        if (interactionListenersActive) {
            removeInteractionListeners();
        }
      } else if (!audio.src) {
        console.log('No audio source set yet.');
      }
    };

    /**
     * Handles the first user interaction by attempting to play the audio.
     * Called once by the interaction event listeners.
     */
    const handleFirstInteraction = () => {
      console.log('User interaction detected.');
      interactionListenersActive = false;
      attemptPlay();
    };

    /**
     * Selects and plays a random track from the available music tracks.
     * Sets the audio source and then attempts to play it.
     */
    const playRandomTrack = () => {
      if (tracks.length === 0) return;
      const randomIndex = Math.floor(Math.random() * tracks.length);
      const trackToPlay = tracks[randomIndex];
      console.log(`Loading track: assets/music/${trackToPlay}`);
      audio.src = `assets/music/${trackToPlay}`;
      attemptPlay();
    };

    audio.addEventListener('ended', () => {
        console.log('Track ended, playing next random track.');
        playRandomTrack();
    });

    playRandomTrack();

  } catch (error) {
    console.error('Error setting up background music player:', error);
  }
}

/**
 * Sets the volume for the background music.
 * @param {number} volume - The desired volume level (0.0 to 1.0).
 */
export function setMusicVolume(volume) {
  if (audio) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    audio.volume = clampedVolume;
    console.log(`Music volume set to: ${clampedVolume}`);
  } else {
    console.warn("Cannot set music volume: audio element not initialized.");
  }
}
