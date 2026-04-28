// daw-audio.jsx
// Web Audio chiptune loop + menu blips. No audio files are loaded; every sound
// is synthesised in real-time using the Web Audio API (oscillators, noise buffers).
// Exposes window.makeAudio — a factory that returns a controller object so the
// game can start/stop the BGM loop and trigger one-shot sound effects.

// Factory function that creates and returns a self-contained audio engine.
// Must be called after a user gesture so the browser allows AudioContext to start.
// Returns an object with: blip, start, stop, setMuted, setVolume, isPlaying, resume.
function makeAudio(){
  // Create the AudioContext, falling back to the webkit-prefixed version for older Safari.
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  // Master gain node acts as a global volume control that all sound sources connect to.
  const master = ctx.createGain();
  let masterVol = 0.16;  // 0..1 — intentionally quiet so it doesn't overpower the UI
  master.gain.value = masterVol;
  master.connect(ctx.destination);

  // ── Blip ──────────────────────────────────────────────────────────────

  // Play a short one-shot blip sound effect (menu navigation, confirmations, etc.).
  // freq — oscillator frequency in Hz (default 660, roughly E5).
  // dur  — total duration in seconds (default 0.06).
  // type — oscillator waveform: 'square', 'sine', 'sawtooth', or 'triangle'.
  // vol  — peak gain of this blip before it fades (default 0.18).
  function blip(freq=660, dur=0.06, type='square', vol=0.18){
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    // Start at zero gain and ramp up quickly to avoid a click artefact.
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime+0.005);
    // Exponential decay to near-silence creates a natural percussive tail.
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur);
    o.connect(g).connect(master);
    o.start();
    // Stop slightly after the fade to cleanly free the oscillator node.
    o.stop(ctx.currentTime + dur + 0.02);
  }

  // ── Chiptune loop ─────────────────────────────────────────────────────
  // Simple 8-bar lead + bass. Hz values for notes.

  // Lookup table mapping note names to their exact frequencies in Hz.
  // The underscore key (_) represents a rest (silence).
  const N = {
    A3:220, B3:246.94, C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392,
    A4:440, B4:493.88, C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99,
    A5:880, _:0,
  };

  // Lead melody: a 32-step heroic minor phrase played on a square-wave oscillator.
  const lead = [
    'A4','C5','E5','C5','A4','G4','E4','G4',
    'F4','A4','C5','A4','F4','E4','D4','C4',
    'A4','C5','E5','G5','E5','C5','A4','C5',
    'G4','B4','D5','F5','D5','B4','G4','_',
  ];

  // Bass line: 32-step sequence mapped to frequencies and halved for the lower octave.
  const bass = [
    'A3','A3','A3','A3','A3','A3','A3','A3',
    'F4','F4','F4','F4','F4','F4','F4','F4',
    'A3','A3','A3','A3','C4','C4','C4','C4',
    'G4','G4','G4','G4','D4','D4','D4','D4',
  ].map(n=>N[n]/2); // dividing by 2 drops each note one octave

  const tempo = 0.21; // duration of one sequencer step in seconds (~286 BPM sixteenths)
  let stepIdx = 0;    // position within the lead/bass arrays, wraps via modulo
  let timer = null;   // handle returned by setInterval, kept so we can stop later
  let playing = false; // guard flag to prevent starting the loop twice

  // Scheduler callback: synthesises one step of lead, bass, and hi-hat, then advances the cursor.
  // Called once immediately on start() and then every `tempo` ms by setInterval.
  function step(){
    // Schedule sounds 10 ms into the future to give the audio thread a small buffer.
    const t = ctx.currentTime + 0.01;

    // Resolve the current lead and bass note frequencies (wrapping around the arrays).
    const ln = N[lead[stepIdx % lead.length]];
    const bn = bass[stepIdx % bass.length];

    // Lead voice: square-wave oscillator with attack + sustain + decay envelope.
    if(ln){
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square'; o.frequency.value = ln;
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.10, t+0.01);  // fast attack
      g.gain.linearRampToValueAtTime(0.06, t+0.05);  // slight decay to sustain level
      g.gain.exponentialRampToValueAtTime(0.0001, t+tempo*0.95); // tail off before next step
      o.connect(g).connect(master);
      o.start(t); o.stop(t+tempo);
    }

    // Bass voice: triangle-wave for a softer, rounder tone; slightly longer decay.
    if(bn){
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'triangle'; o2.frequency.value = bn;
      g2.gain.value = 0;
      g2.gain.linearRampToValueAtTime(0.08, t+0.01);
      // Bass decays over 1.4× the step so it bleeds into the next note, giving warmth.
      g2.gain.exponentialRampToValueAtTime(0.0001, t+tempo*1.4);
      o2.connect(g2).connect(master);
      o2.start(t); o2.stop(t+tempo*1.5);
    }

    // Hi-hat: white noise burst on every other step (every half-beat).
    if(stepIdx % 2 === 0){
      // Build a very short (40 ms) buffer of random samples to simulate noise.
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate*0.04, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      // Fill the buffer with random values in [-0.5, 0.5] for a gentle hiss.
      for(let i=0;i<ch.length;i++) ch[i] = (Math.random()*2-1)*0.5;
      noise.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.value = 0;
      ng.gain.linearRampToValueAtTime(0.04, t+0.005);
      ng.gain.exponentialRampToValueAtTime(0.0001, t+0.04);
      noise.connect(ng).connect(master);
      noise.start(t); noise.stop(t+0.05);
    }

    stepIdx++; // advance sequencer cursor; wraps naturally via modulo in next step() call
  }

  // Begin the BGM loop. Safe to call repeatedly — exits early if already playing.
  function start(){
    if(playing) return;
    playing = true;
    // Resume the AudioContext if the browser suspended it (autoplay policy).
    if(ctx.state === 'suspended') ctx.resume();
    step(); // fire the first step immediately so there is no silence on startup
    timer = setInterval(step, tempo*1000); // schedule subsequent steps at the correct interval
  }

  // Stop the BGM loop and cancel the interval timer.
  function stop(){
    playing = false;
    if(timer){ clearInterval(timer); timer = null; }
  }

  // Silence or restore the master output without stopping the sequencer.
  // m — true to mute, false to restore to the current masterVol.
  function setMuted(m){
    master.gain.value = m ? 0 : masterVol;
  }

  // Set the master volume level, clamped to [0, 1], and apply immediately.
  // v — desired volume between 0.0 (silent) and 1.0 (full).
  function setVolume(v){
    masterVol = Math.max(0, Math.min(1, v));
    master.gain.value = masterVol;
  }

  // Return the public controller interface. The isPlaying getter reads the
  // live `playing` flag so callers always see the current state.
  return { blip, start, stop, setMuted, setVolume,
    get isPlaying(){ return playing; },
    // resume() lets the game reactively un-suspend the context after a user gesture.
    resume: ()=>ctx.state==='suspended' && ctx.resume() };
}

// Register makeAudio globally so any game module can call it without imports.
Object.assign(window, { makeAudio });
