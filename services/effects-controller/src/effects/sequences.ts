import { Sequence } from '../types.js';

export const PILOT_LIGHT_SEQUENCES: Sequence[] = [
  {
    id: 'clockwork-pilotlight-solve',
    name: 'Pilot Light Solve Sequence',
    puzzleId: 'clockwork-pilotlight',
    roomId: 'clockwork',
    durationMs: 10000,
    steps: [
      {
        order: 1,
        offsetMs: 0,
        action: 'play-pilotlight-sfx',
        description: 'Play PilotLight sound effect via SCS',
        payload: {
          topic: 'paragon/Clockwork/Audio/commands/playCue',
          command: 'playCue',
          cueId: 'Q3'
        }
      },
      {
        order: 2,
        offsetMs: 50,
        action: 'start-boiler',
        description: 'Trigger the boiler startup animation',
        payload: {
          topic: 'paragon/Clockwork/PilotLight/clockwork-pilotlight/Commands',
          command: 'startBoiler'
        }
      },
      {
        order: 3,
        offsetMs: 100,
        action: 'fade-to-boiler-music',
        description: 'Fade in Boiler ambient music',
        payload: {
          topic: 'paragon/Clockwork/Audio/commands/fadeIn',
          command: 'fadeIn',
          cueId: 'Q50',
          durationMs: 3000
        }
      },
      {
        order: 4,
        offsetMs: 2000,
        action: 'warmup-fog-machine',
        description: 'Warm up fog machine for boiler effect',
        payload: {
          topic: 'paragon/Clockwork/PilotLight/clockwork-pilotlight/Commands',
          command: 'warmUpFogMachine'
        }
      }
    ]
  }
];

export const AETHER_SEQUENCES: Sequence[] = [
  {
    id: 'clockwork-aether-activation',
    name: 'Aether Power Source Activation',
    puzzleId: 'clockwork-aether-power-source',
    roomId: 'clockwork',
    durationMs: 5000,
    steps: [
      {
        order: 1,
        offsetMs: 0,
        action: 'clock-lasers-on',
        description: 'Activate clock room laser array effects',
        payload: {
          command: 'activateLasers',
          intensity: 100
        }
      },
      {
        order: 2,
        offsetMs: 1000,
        action: 'close-clock-door',
        description: 'Close and lock the clock room door',
        payload: {
          command: 'closeDoor',
          lock: true
        }
      },
      {
        order: 3,
        offsetMs: 2000,
        action: 'prepare-study-door',
        description: 'Prepare the study door opening mechanism',
        payload: {
          command: 'prepareStudyDoor'
        }
      }
    ]
  },
  {
    id: 'clockwork-aether-raise-newel',
    name: 'Raise Newel Post',
    puzzleId: 'clockwork-crank',
    roomId: 'clockwork',
    durationMs: 8000,
    steps: [
      {
        order: 1,
        offsetMs: 0,
        action: 'raise-newel-post',
        description: 'Activate stepper motor to raise Newel Post',
        payload: {
          command: 'raiseNewelPost',
          speed: 1000
        }
      }
    ]
  }
];

export const VERN_SEQUENCES: Sequence[] = [
  {
    id: 'vern-intro',
    name: 'Vern Introduction',
    puzzleId: 'intro',
    roomId: 'clockwork',
    durationMs: 15000,
    steps: [
      {
        order: 1,
        offsetMs: 0,
        action: 'vern-voice-intro',
        description: 'Play Vern introduction voice line',
        payload: {
          command: 'playVoiceLine',
          voiceLineId: 'intro',
          priority: 1
        }
      }
    ]
  },
  {
    id: 'vern-death',
    name: 'Vern Death Scene',
    puzzleId: 'clockwork-rope',
    roomId: 'clockwork',
    durationMs: 20000,
    steps: [
      {
        order: 1,
        offsetMs: 0,
        action: 'vern-voice-death',
        description: 'Play Vern death voice line',
        payload: {
          command: 'playVoiceLine',
          voiceLineId: 'vern_death',
          priority: 1
        }
      }
    ]
  },
  {
    id: 'vern-outro',
    name: 'Vern Outro',
    puzzleId: 'finale',
    roomId: 'clockwork',
    durationMs: 12000,
    steps: [
      {
        order: 1,
        offsetMs: 0,
        action: 'vern-voice-outro',
        description: 'Play Vern outro voice line',
        payload: {
          command: 'playVoiceLine',
          voiceLineId: 'outro',
          priority: 1
        }
      }
    ]
  }
];

export const ALL_SEQUENCES = [
  ...PILOT_LIGHT_SEQUENCES,
  ...AETHER_SEQUENCES,
  ...VERN_SEQUENCES
];
