import { PuzzleConfig } from '../types';

export const CLOCKWORK_PUZZLES: PuzzleConfig[] = [
  {
    id: 'clockwork-pilotlight',
    name: 'Pilot Light',
    roomId: 'clockwork',
    description:
      'Ignite the boiler by matching the correct flame profile, then drive the boiler startup effects sequence.',
    timeLimitMs: 5 * 60 * 1000,
    outputs: ['clockwork-pilotlight-solve'],
    metadata: {
      devices: ['PilotLight'],
      deviceFriendlyName: 'Pilot Light',
      mqttNamespace: 'Clockwork/PilotLight',
      sensorPublishIntervalMs: 1000,
      inputs: [
        {
          id: 'pilotlight-color-sensor',
          type: 'TCS34725',
          description: 'Monitors pilot light ignition via color temperature and lux readings.',
          mqttTopic: 'Clockwork/PilotLight/ColorSensor/sensors/color',
          trigger: {
            metric: 'colorTemp',
            threshold: 1500,
            comparison: '>=',
            notes: 'Matches firmware config::COLOR_TEMP_TRIGGER to confirm flame ignition.'
          }
        }
      ],
      outputs: [
        {
          id: 'boiler-led-strip',
          type: 'led-strip',
          pins: [2, 3, 4, 5, 6, 7],
          sequenceId: 'clockwork-pilotlight-led-fire-animation',
          description: 'Six-channel LED fire animation wrapped around the boiler.',
          mqttCommand: 'fireLEDs',
          mqttDevice: 'Teensy 4.1',
          toggleable: true,
          mqttValueOn: 'on',
          mqttValueOff: 'off'
        },
        {
          id: 'boiler-rpi-power',
          type: 'power-relay',
          pin: 10,
          description: 'Controls power for the Boiler Display Raspberry Pi.',
          mqttCommand: 'boilerRpiPower',
          mqttDevice: 'Teensy 4.1',
          toggleable: true,
          mqttValueOn: 'on',
          mqttValueOff: 'off'
        },
        {
          id: 'boiler-monitor-power',
          type: 'power-relay',
          pin: 11,
          description: 'Controls power for the Boiler Display monitor.',
          mqttCommand: 'boilerMonitor',
          mqttDevice: 'Teensy 4.1',
          toggleable: true,
          mqttValueOn: 'on',
          mqttValueOff: 'off'
        },
        {
          id: 'fog-machine',
          type: 'fog-machine',
          sequenceId: 'clockwork-pilotlight-fog-activate',
          mqttTopic: 'Clockwork/PilotLight/FogMachine',
          description: 'Triggers boiler fog burst during startup.',
          mqttCommand: 'warmUpFogMachine',
          mqttDevice: 'Teensy 4.1'
        },
        {
          id: 'startup-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-pilotlight-sfx-boiler-start',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the boiler start-up whistle audio file (Q3 - pilotlight.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q3', command: 'playCue' }),
              label: '🔊 Test PilotLight SFX (Q3)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'gauge-puzzle-activation',
          type: 'puzzle-link',
          sequenceId: 'clockwork-gauges-activate',
          dependsOn: 'clockwork-gauges',
          description: 'Activates Gauge puzzle state once the boiler is online.'
        }
      ],
      sequences: {
        powerOn: {
          steps: [
            {
              order: 1,
              action: 'clockwork-pilotlight-power-aux',
              description: 'Power on Teensy controller and auxiliary supply rails.'
            },
            {
              order: 2,
              action: 'clockwork-pilotlight-power-rpi',
              description: 'Power on the Boiler Display Raspberry Pi.'
            },
            {
              order: 3,
              action: 'clockwork-pilotlight-power-monitor',
              description: 'Power on the Boiler Display monitor.'
            }
          ]
        },
        roomReady: {
          steps: [
            {
              order: 1,
              action: 'clockwork-pilotlight-monitor-off',
              description: 'Turn off the Boiler Monitor while staging the room.'
            }
          ]
        },
        introVideoStart: {
          steps: [
            {
              order: 1,
              action: 'clockwork-pilotlight-fog-standby',
              description: 'Enable fog machine power and wait for operator trigger during intro video.'
            }
          ]
        },
        solve: {
          sequenceId: 'clockwork-pilotlight-solve',
          durationMs: 10000,
          steps: [
            {
              order: 1,
              offsetMs: 50,
              action: 'clockwork-pilotlight-led-fire-animation',
              description: 'Start the boiler LED fire animation shortly after confirmation.'
            },
            {
              order: 2,
              offsetMs: 2000,
              action: 'clockwork-pilotlight-fog-activate',
              description: 'Trigger fog burst two seconds into the solve sequence.'
            },
            {
              order: 3,
              offsetMs: 3000,
              action: 'clockwork-pilotlight-sfx-boiler-start',
              description: 'Play boiler start-up whistle one second after fog starts.'
            },
            {
              order: 4,
              offsetMs: 0,
              action: 'clockwork-gauges-activate',
              description: 'Notify Gauge puzzle to enter active state when boiler is online.'
            },
            {
              order: 5,
              offsetMs: 10000,
              action: 'clockwork-pilotlight-effects-reset',
              description: 'Stop LED, fog, and sound effects after the 10 second solve window.'
            }
          ]
        }
      },
      references: [
        'hardware/Puzzle Code Teensy/PilotLight/config/PilotLight Configuration Details.md'
      ]
    }
  },
  {
    id: 'clockwork-chemical',
    name: 'Chemical Lab',
    roomId: 'clockwork',
    description: 'Place the correct vials into the rack.',
    timeLimitMs: 10 * 60 * 1000,
    prerequisites: ['clockwork-pilotlight'],
    outputs: ['clockwork-chemical-success'],
    metadata: {
      devices: ['Chemical'],
      deviceFriendlyName: 'Chemical Puzzle',
      mqttNamespace: 'Clockwork/Chemical',
      requiredTags: 6,
      sensorPublishIntervalMs: 1000,
      inputs: [
        {
          id: 'rfid-reader-1',
          type: 'RFID-RC522',
          description: 'RFID reader for vial slot 1',
          pin: 10,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on vial insertion'
          }
        },
        {
          id: 'rfid-reader-2',
          type: 'RFID-RC522',
          description: 'RFID reader for vial slot 2',
          pin: 9,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on vial insertion'
          }
        },
        {
          id: 'rfid-reader-3',
          type: 'RFID-RC522',
          description: 'RFID reader for vial slot 3',
          pin: 8,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on vial insertion'
          }
        },
        {
          id: 'rfid-reader-4',
          type: 'RFID-RC522',
          description: 'RFID reader for vial slot 4',
          pin: 7,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on vial insertion'
          }
        },
        {
          id: 'rfid-reader-5',
          type: 'RFID-RC522',
          description: 'RFID reader for vial slot 5',
          pin: 6,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on vial insertion'
          }
        },
        {
          id: 'rfid-reader-6',
          type: 'RFID-RC522',
          description: 'RFID reader for vial slot 6',
          pin: 5,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on vial insertion'
          }
        }
      ],
      outputs: [
        {
          id: 'chemical-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-chemical-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the chemical lab solve sound effect (Q9 - chemical.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q9', command: 'playCue' }),
              label: '🔊 Test Chemical SFX (Q9)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'linear-actuator',
          type: 'linear-actuator',
          pins: { extend: 14, retract: 15 },
          description: 'Linear actuator to reveal hidden compartment on puzzle solve'
        },
        {
          id: 'maglock-1',
          type: 'magnetic-lock',
          pin: 16,
          description: 'Magnetic lock for compartment door 1'
        },
        {
          id: 'maglock-2',
          type: 'magnetic-lock',
          pin: 17,
          description: 'Magnetic lock for compartment door 2'
        },
        {
          id: 'power-led',
          type: 'led-indicator',
          pin: 13,
          description: 'Power/status LED indicator'
        }
      ]
    }
  },
  {
    id: 'clockwork-keys',
    name: 'Keys Puzzle',
    roomId: 'clockwork',
    description: 'Solve the keys puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-keys-success'],
    metadata: {
      devices: ['Keys'],
      deviceFriendlyName: 'Keys Puzzle',
      mqttNamespace: 'Clockwork/Keys',
      inputs: [
        {
          id: 'button-pair-1',
          type: 'button-pair',
          description: 'Button pair 1 for key input sequence',
          pins: [2, 3],
          trigger: {
            metric: 'pressed',
            notes: 'Detects button press for puzzle sequence'
          }
        },
        {
          id: 'button-pair-2',
          type: 'button-pair',
          description: 'Button pair 2 for key input sequence',
          pins: [4, 5],
          trigger: {
            metric: 'pressed',
            notes: 'Detects button press for puzzle sequence'
          }
        },
        {
          id: 'button-pair-3',
          type: 'button-pair',
          description: 'Button pair 3 for key input sequence',
          pins: [6, 7],
          trigger: {
            metric: 'pressed',
            notes: 'Detects button press for puzzle sequence'
          }
        },
        {
          id: 'button-pair-4',
          type: 'button-pair',
          description: 'Button pair 4 for key input sequence',
          pins: [8, 9],
          trigger: {
            metric: 'pressed',
            notes: 'Detects button press for puzzle sequence'
          }
        }
      ],
      outputs: [
        {
          id: 'keys-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-keys-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the keys puzzle solve sound effect (Q10 - keys.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q10', command: 'playCue' }),
              label: '🔊 Test Keys SFX (Q10)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'led-strip',
          type: 'led-strip',
          pin: 10,
          description: 'LED strip for visual feedback and solve indication'
        }
      ]
    }
  },
  {
    id: 'clockwork-music',
    name: 'Music Puzzle',
    roomId: 'clockwork',
    description: 'Musical sequence puzzle using audio-based inputs and feedback.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-music-success'],
    metadata: {
      devices: ['Music'],
      deviceFriendlyName: 'Music Puzzle',
      mqttNamespace: 'Clockwork/Music',
      outputs: [
        {
          id: 'music-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-music-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the music puzzle solve sound effect (Q7 - music.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q7', command: 'playCue' }),
              label: '🔊 Test Music SFX (Q7)',
              style: 'primary'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'clockwork-floor',
    name: 'Floor Puzzle',
    roomId: 'clockwork',
    description: 'Solve the floor puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-floor-success'],
    metadata: {
      devices: ['Floor'],
      deviceFriendlyName: 'Floor Puzzle',
      mqttNamespace: 'Clockwork/Floor',
      inputs: [
        {
          id: 'floor-buttons',
          type: 'button-array',
          description: 'Floor-mounted pressure buttons for sequence input',
          pins: [2, 3, 4, 5, 6],
          trigger: {
            metric: 'pressed',
            notes: 'Detects floor tile button activation'
          }
        },
        {
          id: 'pressure-sensors',
          type: 'pressure-sensor',
          description: 'Pressure sensors for floor tile detection',
          pins: [7, 8, 9, 10],
          trigger: {
            metric: 'pressure',
            threshold: 50,
            comparison: '>=',
            notes: 'Detects weight on floor tiles'
          }
        }
      ],
      outputs: [
        {
          id: 'floor-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-floor-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the floor puzzle solve sound effect (Q11 - floor.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q11', command: 'playCue' }),
              label: '🔊 Test Floor SFX (Q11)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'led-strips',
          type: 'led-strip',
          pins: [11, 12, 13, 14],
          description: 'LED strips for floor tile illumination and feedback'
        },
        {
          id: 'stepper-motor',
          type: 'stepper-motor',
          pins: { step: 15, dir: 16, enable: 17 },
          description: 'Stepper motor for mechanical reveal or movement'
        },
        {
          id: 'maglock',
          type: 'magnetic-lock',
          pin: 18,
          description: 'Magnetic lock for compartment release'
        },
        {
          id: 'solenoid',
          type: 'solenoid',
          pin: 19,
          description: 'Solenoid for quick-release mechanism'
        }
      ]
    }
  },
  {
    id: 'clockwork-fuse',
    name: 'Fuse Box',
    roomId: 'clockwork',
    description: 'Solve the fuse box puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-fuse-success'],
    metadata: {
      devices: ['Fuse'],
      deviceFriendlyName: 'Fuse Box',
      mqttNamespace: 'Clockwork/Fuse',
      inputs: [
        {
          id: 'rfid-reader-1',
          type: 'RFID-RC522',
          description: 'RFID reader for fuse slot 1',
          pin: 10,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on fuse insertion'
          }
        },
        {
          id: 'rfid-reader-2',
          type: 'RFID-RC522',
          description: 'RFID reader for fuse slot 2',
          pin: 9,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on fuse insertion'
          }
        },
        {
          id: 'rfid-reader-3',
          type: 'RFID-RC522',
          description: 'RFID reader for fuse slot 3',
          pin: 8,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on fuse insertion'
          }
        },
        {
          id: 'rfid-reader-4',
          type: 'RFID-RC522',
          description: 'RFID reader for fuse slot 4',
          pin: 7,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on fuse insertion'
          }
        },
        {
          id: 'rfid-reader-5',
          type: 'RFID-RC522',
          description: 'RFID reader for fuse slot 5',
          pin: 6,
          trigger: {
            metric: 'tagId',
            notes: 'Detects RFID tag on fuse insertion'
          }
        }
      ],
      outputs: [
        {
          id: 'fuse-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-fuse-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the fuse box solve sound effect (Q5 - fuse.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q5', command: 'playCue' }),
              label: '🔊 Test Fuse SFX (Q5)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'actuator',
          type: 'linear-actuator',
          pins: { extend: 14, retract: 15 },
          description: 'Linear actuator for compartment reveal'
        },
        {
          id: 'maglock-1',
          type: 'magnetic-lock',
          pin: 16,
          description: 'Magnetic lock 1 for fuse box door'
        },
        {
          id: 'maglock-2',
          type: 'magnetic-lock',
          pin: 17,
          description: 'Magnetic lock 2 for hidden compartment'
        }
      ]
    }
  },
  {
    id: 'clockwork-gear',
    name: 'Gear Puzzle',
    roomId: 'clockwork',
    description: 'Mechanical gear alignment puzzle using rotary encoders and position sensors.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-gear-success'],
    metadata: {
      devices: ['GearOne'],
      deviceFriendlyName: 'Gear Puzzle',
      mqttNamespace: 'Clockwork/GearOne',
      outputs: [
        {
          id: 'gear-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-gear-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the gear puzzle solve sound effect (Q6 - gear.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q6', command: 'playCue' }),
              label: '🔊 Test Gear SFX (Q6)',
              style: 'primary'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'clockwork-gundrawers',
    name: 'Gun Drawers',
    roomId: 'clockwork',
    description: 'Drawer sequence puzzle using magnetic sensors and electromagnetic locks.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-gundrawers-success'],
    metadata: {
      devices: ['GunDrawers'],
      deviceFriendlyName: 'Gun Drawers',
      mqttNamespace: 'Clockwork/GunDrawers',
      outputs: [
        {
          id: 'gundrawers-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-gundrawers-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the gun drawers solve sound effect (Q12 - gundrawers.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q12', command: 'playCue' }),
              label: '🔊 Test Gun Drawers SFX (Q12)',
              style: 'primary'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'clockwork-kraken',
    name: 'Kraken Puzzle',
    roomId: 'clockwork',
    description: 'Solve the kraken puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-kraken-success'],
    metadata: {
      devices: ['Kraken'],
      deviceFriendlyName: 'Kraken Puzzle',
      mqttNamespace: 'Clockwork/Kraken',
      inputs: [
        {
          id: 'wheel-encoder',
          type: 'rotary-encoder',
          description: 'Rotary encoder for ship wheel rotation',
          pins: { a: 2, b: 3 },
          trigger: {
            metric: 'rotation',
            notes: 'Tracks wheel rotation for navigation control'
          }
        },
        {
          id: 'throttle-switch',
          type: 'switch',
          description: 'Throttle switch for speed control',
          pin: 4,
          trigger: {
            metric: 'state',
            notes: 'Detects throttle position changes'
          }
        }
      ],
      outputs: [
        {
          id: 'kraken-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-kraken-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the kraken puzzle solve sound effect (Q13 - kraken.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q13', command: 'playCue' }),
              label: '🔊 Test Kraken SFX (Q13)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'kraken-effects',
          type: 'effect-controller',
          pin: 5,
          description: 'Controls Kraken animation and effects'
        }
      ]
    }
  },
  {
    id: 'clockwork-leverboiler',
    name: 'Boiler Lever',
    roomId: 'clockwork',
    description: 'Solve the boiler lever puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-leverboiler-success'],
    metadata: {
      devices: ['LeverBoiler'],
      deviceFriendlyName: 'Boiler Lever',
      mqttNamespace: 'Clockwork/LeverBoiler',
      inputs: [
        {
          id: 'ir-sensors',
          type: 'ir-sensor-array',
          description: 'IR sensors for lever position detection',
          pins: [2, 3, 4, 5],
          trigger: {
            metric: 'position',
            notes: 'Detects lever positions via IR beam breaks'
          }
        },
        {
          id: 'photocells',
          type: 'photocell',
          description: 'Photocells for ambient light detection',
          pins: [14, 15],
          trigger: {
            metric: 'light',
            threshold: 100,
            comparison: '>=',
            notes: 'Monitors light levels for puzzle state'
          }
        }
      ],
      outputs: [
        {
          id: 'leverboiler-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-leverboiler-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the boiler lever solve sound effect (Q14 - leverboiler.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q14', command: 'playCue' }),
              label: '🔊 Test Lever Boiler SFX (Q14)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'maglocks',
          type: 'magnetic-lock',
          pins: [6, 7],
          description: 'Magnetic locks for compartment release'
        },
        {
          id: 'stepper-motor',
          type: 'stepper-motor',
          pins: { step: 8, dir: 9, enable: 10 },
          description: 'Stepper motor for mechanical movement'
        }
      ]
    }
  },
  {
    id: 'clockwork-leverfansafe',
    name: 'Fan & Safe Lever',
    roomId: 'clockwork',
    description: 'Solve the fan and safe lever puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-leverfansafe-success'],
    metadata: {
      devices: ['LeverFanSafe'],
      deviceFriendlyName: 'Fan & Safe Lever',
      mqttNamespace: 'Clockwork/LeverFanSafe',
      inputs: [
        {
          id: 'ir-sensors',
          type: 'ir-sensor-array',
          description: 'IR sensors for lever position detection',
          pins: [2, 3, 4],
          trigger: {
            metric: 'position',
            notes: 'Detects lever positions via IR beam breaks'
          }
        },
        {
          id: 'photocells',
          type: 'photocell',
          description: 'Photocells for light-based puzzle state',
          pins: [14, 15],
          trigger: {
            metric: 'light',
            threshold: 100,
            comparison: '>=',
            notes: 'Monitors light levels for puzzle state'
          }
        }
      ],
      outputs: [
        {
          id: 'leverfansafe-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-leverfansafe-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the fan & safe lever solve sound effect (Q15 - leverfansafe.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q15', command: 'playCue' }),
              label: '🔊 Test Lever Fan/Safe SFX (Q15)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'maglock',
          type: 'magnetic-lock',
          pin: 5,
          description: 'Magnetic lock for safe release'
        },
        {
          id: 'solenoid',
          type: 'solenoid',
          pin: 6,
          description: 'Solenoid for quick-release mechanism'
        },
        {
          id: 'stepper-motor',
          type: 'stepper-motor',
          pins: { step: 7, dir: 8, enable: 9 },
          description: 'Stepper motor for fan or mechanical movement'
        }
      ]
    }
  },
  {
    id: 'clockwork-leverriddle',
    name: 'Riddle Lever',
    roomId: 'clockwork',
    description: 'Solve the riddle lever puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-leverriddle-success'],
    metadata: {
      devices: ['LeverRiddle'],
      deviceFriendlyName: 'Riddle Lever',
      mqttNamespace: 'Clockwork/LeverRiddle',
      inputs: [
        {
          id: 'ir-sensors',
          type: 'ir-sensor-array',
          description: 'IR sensors for lever position detection',
          pins: [2, 3, 4, 5],
          trigger: {
            metric: 'position',
            notes: 'Detects lever positions via IR beam breaks'
          }
        },
        {
          id: 'hall-sensors',
          type: 'hall-effect-sensor',
          description: 'Hall effect sensors for magnetic detection',
          pins: [6, 7],
          trigger: {
            metric: 'magnetic',
            notes: 'Detects magnetic field for puzzle state'
          }
        },
        {
          id: 'photocell',
          type: 'photocell',
          description: 'Photocell for light detection',
          pin: 14,
          trigger: {
            metric: 'light',
            threshold: 100,
            comparison: '>=',
            notes: 'Monitors light level for puzzle state'
          }
        },
        {
          id: 'riddle-button',
          type: 'button',
          description: 'Button for riddle interaction',
          pin: 8,
          trigger: {
            metric: 'pressed',
            notes: 'Detects button press for puzzle input'
          }
        }
      ],
      outputs: [
        {
          id: 'leverriddle-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-leverriddle-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the riddle lever solve sound effect (Q16 - leverriddle.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q16', command: 'playCue' }),
              label: '🔊 Test Lever Riddle SFX (Q16)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'maglock',
          type: 'magnetic-lock',
          pin: 9,
          description: 'Magnetic lock for compartment release'
        },
        {
          id: 'led-indicators',
          type: 'led-array',
          pins: [10, 11, 12, 13],
          description: 'LED indicators for visual feedback'
        }
      ]
    }
  },
  {
    id: 'clockwork-pilaster',
    name: 'Pilaster Puzzle',
    roomId: 'clockwork',
    description: 'Architectural column puzzle using pressure sensors and hidden compartment reveals.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-pilaster-success'],
    metadata: {
      devices: ['Pilaster'],
      deviceFriendlyName: 'Pilaster Puzzle',
      mqttNamespace: 'Clockwork/Pilaster',
      outputs: [
        {
          id: 'pilaster-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-pilaster-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the pilaster puzzle solve sound effect (Q17 - pilaster.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q17', command: 'playCue' }),
              label: '🔊 Test Pilaster SFX (Q17)',
              style: 'primary'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'clockwork-riddle',
    name: 'Riddle Puzzle',
    roomId: 'clockwork',
    description: 'Solve the riddle puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-riddle-success'],
    metadata: {
      devices: ['Riddle'],
      deviceFriendlyName: 'Riddle Puzzle',
      mqttNamespace: 'Clockwork/Riddle',
      inputs: [
        {
          id: 'knobs',
          type: 'potentiometer',
          description: 'Rotary knobs for puzzle input',
          pins: [14, 15, 16],
          trigger: {
            metric: 'position',
            notes: 'Reads knob positions for puzzle combination'
          }
        },
        {
          id: 'buttons',
          type: 'button-array',
          description: 'Buttons for puzzle interaction',
          pins: [2, 3, 4, 5],
          trigger: {
            metric: 'pressed',
            notes: 'Detects button presses for puzzle input'
          }
        },
        {
          id: 'ir-sensors',
          type: 'ir-sensor',
          description: 'IR sensors for object detection',
          pins: [6, 7],
          trigger: {
            metric: 'detected',
            notes: 'Detects object placement via IR'
          }
        },
        {
          id: 'proximity-sensors',
          type: 'proximity-sensor',
          description: 'Proximity sensors for player detection',
          pins: [8, 9],
          trigger: {
            metric: 'distance',
            threshold: 10,
            comparison: '<=',
            notes: 'Detects player proximity'
          }
        }
      ],
      outputs: [
        {
          id: 'riddle-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-riddle-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the riddle puzzle solve sound effect (Q8 - riddle.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q8', command: 'playCue' }),
              label: '🔊 Test Riddle SFX (Q8)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'led-indicators',
          type: 'led-array',
          pins: [10, 11, 12, 13],
          description: 'LED indicators for visual feedback'
        },
        {
          id: 'stepper-motors',
          type: 'stepper-motor',
          pins: [
            { step: 17, dir: 18, enable: 19 },
            { step: 20, dir: 21, enable: 22 }
          ],
          description: 'Stepper motors for mechanical reveals'
        },
        {
          id: 'maglock',
          type: 'magnetic-lock',
          pin: 23,
          description: 'Magnetic lock for compartment release'
        }
      ]
    }
  },
  {
    id: 'clockwork-syringe',
    name: 'Syringe Puzzle',
    roomId: 'clockwork',
    description: 'Solve the syringe puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-syringe-success'],
    metadata: {
      devices: ['Syringe'],
      deviceFriendlyName: 'Syringe Puzzle',
      mqttNamespace: 'Clockwork/Syringe',
      inputs: [
        {
          id: 'encoder-1',
          type: 'rotary-encoder',
          description: 'Rotary encoder for syringe 1 position',
          pins: { a: 2, b: 3 },
          trigger: {
            metric: 'position',
            notes: 'Tracks syringe 1 plunger position'
          }
        },
        {
          id: 'encoder-2',
          type: 'rotary-encoder',
          description: 'Rotary encoder for syringe 2 position',
          pins: { a: 4, b: 5 },
          trigger: {
            metric: 'position',
            notes: 'Tracks syringe 2 plunger position'
          }
        },
        {
          id: 'encoder-3',
          type: 'rotary-encoder',
          description: 'Rotary encoder for syringe 3 position',
          pins: { a: 6, b: 7 },
          trigger: {
            metric: 'position',
            notes: 'Tracks syringe 3 plunger position'
          }
        },
        {
          id: 'encoder-4',
          type: 'rotary-encoder',
          description: 'Rotary encoder for syringe 4 position',
          pins: { a: 8, b: 9 },
          trigger: {
            metric: 'position',
            notes: 'Tracks syringe 4 plunger position'
          }
        },
        {
          id: 'encoder-5',
          type: 'rotary-encoder',
          description: 'Rotary encoder for syringe 5 position',
          pins: { a: 10, b: 11 },
          trigger: {
            metric: 'position',
            notes: 'Tracks syringe 5 plunger position'
          }
        },
        {
          id: 'encoder-6',
          type: 'rotary-encoder',
          description: 'Rotary encoder for syringe 6 position',
          pins: { a: 12, b: 13 },
          trigger: {
            metric: 'position',
            notes: 'Tracks syringe 6 plunger position'
          }
        }
      ],
      outputs: [
        {
          id: 'syringe-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-syringe-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the syringe puzzle solve sound effect (Q18 - syringe.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q18', command: 'playCue' }),
              label: '🔊 Test Syringe SFX (Q18)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'led-ring-1',
          type: 'led-ring',
          pin: 14,
          description: 'LED ring for syringe 1 visual feedback'
        },
        {
          id: 'led-ring-2',
          type: 'led-ring',
          pin: 15,
          description: 'LED ring for syringe 2 visual feedback'
        },
        {
          id: 'led-ring-3',
          type: 'led-ring',
          pin: 16,
          description: 'LED ring for syringe 3 visual feedback'
        },
        {
          id: 'led-ring-4',
          type: 'led-ring',
          pin: 17,
          description: 'LED ring for syringe 4 visual feedback'
        },
        {
          id: 'led-ring-5',
          type: 'led-ring',
          pin: 18,
          description: 'LED ring for syringe 5 visual feedback'
        },
        {
          id: 'led-ring-6',
          type: 'led-ring',
          pin: 19,
          description: 'LED ring for syringe 6 visual feedback'
        },
        {
          id: 'actuators',
          type: 'linear-actuator',
          pins: [
            { extend: 20, retract: 21 },
            { extend: 22, retract: 23 }
          ],
          description: 'Linear actuators for compartment reveal'
        }
      ]
    }
  },
  {
    id: 'clockwork-vault',
    name: 'Vault Puzzle',
    roomId: 'clockwork',
    description: 'Combination lock vault using rotary encoders and magnetic lock release.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-vault-success'],
    metadata: {
      devices: ['Vault'],
      deviceFriendlyName: 'Vault Puzzle',
      mqttNamespace: 'Clockwork/Vault',
      outputs: [
        {
          id: 'vault-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-vault-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the vault puzzle solve sound effect (Q19 - vault.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q19', command: 'playCue' }),
              label: '🔊 Test Vault SFX (Q19)',
              style: 'primary'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'clockwork-clock',
    name: 'Clock Puzzle',
    roomId: 'clockwork',
    description: 'Solve the clock puzzle.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-clock-success'],
    metadata: {
      devices: ['Clock'],
      deviceFriendlyName: 'Clock Puzzle',
      mqttNamespace: 'Clockwork/Clock',
      sensorPublishIntervalMs: 500,
      inputs: [
        {
          id: 'resistor-input-1',
          type: 'resistor-analog',
          description: 'Resistor input sensor 1 for clock configuration',
          pin: 14,
          trigger: {
            metric: 'resistance',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads resistor value for puzzle state'
          }
        },
        {
          id: 'resistor-input-2',
          type: 'resistor-analog',
          description: 'Resistor input sensor 2 for clock configuration',
          pin: 15,
          trigger: {
            metric: 'resistance',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads resistor value for puzzle state'
          }
        },
        {
          id: 'resistor-input-3',
          type: 'resistor-analog',
          description: 'Resistor input sensor 3 for clock configuration',
          pin: 16,
          trigger: {
            metric: 'resistance',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads resistor value for puzzle state'
          }
        },
        {
          id: 'resistor-input-4',
          type: 'resistor-analog',
          description: 'Resistor input sensor 4 for clock configuration',
          pin: 17,
          trigger: {
            metric: 'resistance',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads resistor value for puzzle state'
          }
        },
        {
          id: 'resistor-input-5',
          type: 'resistor-analog',
          description: 'Resistor input sensor 5 for clock configuration',
          pin: 18,
          trigger: {
            metric: 'resistance',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads resistor value for puzzle state'
          }
        },
        {
          id: 'resistor-input-6',
          type: 'resistor-analog',
          description: 'Resistor input sensor 6 for clock configuration',
          pin: 19,
          trigger: {
            metric: 'resistance',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads resistor value for puzzle state'
          }
        },
        {
          id: 'resistor-input-7',
          type: 'resistor-analog',
          description: 'Resistor input sensor 7 for clock configuration',
          pin: 20,
          trigger: {
            metric: 'resistance',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads resistor value for puzzle state'
          }
        },
        {
          id: 'resistor-input-8',
          type: 'resistor-analog',
          description: 'Resistor input sensor 8 for clock configuration',
          pin: 21,
          trigger: {
            metric: 'resistance',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads resistor value for puzzle state'
          }
        },
        {
          id: 'encoder-hour',
          type: 'rotary-encoder',
          description: 'Rotary encoder for hour hand position',
          pins: { a: 2, b: 3 },
          trigger: {
            metric: 'position',
            notes: 'Tracks hour hand rotation position'
          }
        },
        {
          id: 'encoder-minute',
          type: 'rotary-encoder',
          description: 'Rotary encoder for minute hand position',
          pins: { a: 4, b: 5 },
          trigger: {
            metric: 'position',
            notes: 'Tracks minute hand rotation position'
          }
        },
        {
          id: 'encoder-second',
          type: 'rotary-encoder',
          description: 'Rotary encoder for second hand position',
          pins: { a: 6, b: 7 },
          trigger: {
            metric: 'position',
            notes: 'Tracks second hand rotation position'
          }
        },
        {
          id: 'proximity-sensor',
          type: 'proximity-sensor',
          description: 'Proximity sensor to detect player presence or object placement',
          pin: 22,
          trigger: {
            metric: 'detected',
            threshold: 1,
            comparison: '>=',
            notes: 'Triggers when object detected in range'
          }
        }
      ],
      outputs: [
        {
          id: 'clock-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-clock-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the clock puzzle solve sound effect (Q20 - clock.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q20', command: 'playCue' }),
              label: '🔊 Test Clock SFX (Q20)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'stepper-hour',
          type: 'stepper-motor',
          pins: { step: 8, dir: 9, enable: 10 },
          description: 'Stepper motor for hour hand movement'
        },
        {
          id: 'stepper-minute',
          type: 'stepper-motor',
          pins: { step: 11, dir: 12, enable: 13 },
          description: 'Stepper motor for minute hand movement'
        },
        {
          id: 'stepper-second',
          type: 'stepper-motor',
          pins: { step: 14, dir: 15, enable: 16 },
          description: 'Stepper motor for second hand movement'
        },
        {
          id: 'led-strip-1',
          type: 'led-strip',
          pin: 23,
          description: 'LED strip 1 for clock face illumination and effects'
        },
        {
          id: 'led-strip-2',
          type: 'led-strip',
          pin: 24,
          description: 'LED strip 2 for clock face illumination and effects'
        },
        {
          id: 'led-strip-3',
          type: 'led-strip',
          pin: 25,
          description: 'LED strip 3 for clock face illumination and effects'
        },
        {
          id: 'led-strip-4',
          type: 'led-strip',
          pin: 26,
          description: 'LED strip 4 for clock face illumination and effects'
        },
        {
          id: 'maglock-1',
          type: 'magnetic-lock',
          pin: 27,
          description: 'Magnetic lock 1 for compartment or door release'
        },
        {
          id: 'maglock-2',
          type: 'magnetic-lock',
          pin: 28,
          description: 'Magnetic lock 2 for compartment or door release'
        },
        {
          id: 'actuator-1',
          type: 'linear-actuator',
          pins: { extend: 29, retract: 30 },
          description: 'Linear actuator 1 for mechanical reveal or movement'
        },
        {
          id: 'actuator-2',
          type: 'linear-actuator',
          pins: { extend: 31, retract: 32 },
          description: 'Linear actuator 2 for mechanical reveal or movement'
        },
        {
          id: 'fog-machine',
          type: 'fog-machine',
          pin: 33,
          description: 'Fog machine for atmospheric effects on solve'
        },
        {
          id: 'ambient-lights',
          type: 'lighting-control',
          pin: 34,
          description: 'Ambient lighting control for room atmosphere'
        }
      ]
    }
  },
  {
    id: 'clockwork-crank',
    name: 'Crank Puzzle',
    roomId: 'clockwork',
    description: 'Manual crank mechanism using rotary encoder to track rotation and trigger stepper motor.',
    timeLimitMs: 10 * 60 * 1000,
    outputs: ['clockwork-crank-success'],
    metadata: {
      devices: ['Crank'],
      deviceFriendlyName: 'Crank Puzzle',
      mqttNamespace: 'Clockwork/Crank',
      outputs: [
        {
          id: 'crank-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-crank-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the crank puzzle solve sound effect (Q21 - crank.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q21', command: 'playCue' }),
              label: '🔊 Test Crank SFX (Q21)',
              style: 'primary'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'clockwork-gauges',
    name: 'Gauge Puzzle',
    roomId: 'clockwork',
    description: 'Monitor and control the steam gauges to maintain proper pressure levels.',
    timeLimitMs: 10 * 60 * 1000,
    prerequisites: ['clockwork-pilotlight'],
    outputs: ['clockwork-gauges-success'],
    metadata: {
      devices: ['Gauge_2-5-7', 'Gauge_1-3-4', 'Gauge_6-Leds'],
      deviceFriendlyName: 'Gauge Controllers',
      mqttNamespace: 'Clockwork/Gauge',
      description: 'Three gauge controllers manage 7 gauges and LED effects',
      sensorPublishIntervalMs: 500,
      inputs: [
        {
          id: 'valve-pot-1-controller-1',
          type: 'potentiometer',
          description: 'Valve control potentiometer 1 on Gauge_1-3-4 controller',
          pin: 14,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        },
        {
          id: 'valve-pot-2-controller-1',
          type: 'potentiometer',
          description: 'Valve control potentiometer 2 on Gauge_1-3-4 controller',
          pin: 15,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        },
        {
          id: 'valve-pot-3-controller-1',
          type: 'potentiometer',
          description: 'Valve control potentiometer 3 on Gauge_1-3-4 controller',
          pin: 16,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        },
        {
          id: 'valve-pot-1-controller-2',
          type: 'potentiometer',
          description: 'Valve control potentiometer 1 on Gauge_2-5-7 controller',
          pin: 14,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        },
        {
          id: 'valve-pot-2-controller-2',
          type: 'potentiometer',
          description: 'Valve control potentiometer 2 on Gauge_2-5-7 controller',
          pin: 15,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        },
        {
          id: 'valve-pot-3-controller-2',
          type: 'potentiometer',
          description: 'Valve control potentiometer 3 on Gauge_2-5-7 controller',
          pin: 16,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        },
        {
          id: 'valve-pot-1-controller-3',
          type: 'potentiometer',
          description: 'Valve control potentiometer 1 on Gauge_6-Leds controller',
          pin: 14,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        },
        {
          id: 'valve-pot-2-controller-3',
          type: 'potentiometer',
          description: 'Valve control potentiometer 2 on Gauge_6-Leds controller',
          pin: 15,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        },
        {
          id: 'valve-pot-3-controller-3',
          type: 'potentiometer',
          description: 'Valve control potentiometer 3 on Gauge_6-Leds controller',
          pin: 16,
          trigger: {
            metric: 'position',
            threshold: 0,
            comparison: '>=',
            notes: 'Reads valve position for gauge control (0-1023 analog range)'
          }
        }
      ],
      outputs: [
        {
          id: 'gauges-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-gauges-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the gauge puzzle solve sound effect (Q4 - gauges.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q4', command: 'playCue' }),
              label: '🔊 Test Gauges SFX (Q4)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'stepper-gauge-1-controller-1',
          type: 'stepper-motor',
          pins: { step: 2, dir: 3, enable: 4 },
          description: 'Stepper motor for gauge 1 needle control on Gauge_1-3-4'
        },
        {
          id: 'stepper-gauge-2-controller-1',
          type: 'stepper-motor',
          pins: { step: 5, dir: 6, enable: 7 },
          description: 'Stepper motor for gauge 2 needle control on Gauge_1-3-4'
        },
        {
          id: 'stepper-gauge-3-controller-1',
          type: 'stepper-motor',
          pins: { step: 8, dir: 9, enable: 10 },
          description: 'Stepper motor for gauge 3 needle control on Gauge_1-3-4'
        },
        {
          id: 'stepper-gauge-1-controller-2',
          type: 'stepper-motor',
          pins: { step: 2, dir: 3, enable: 4 },
          description: 'Stepper motor for gauge 1 needle control on Gauge_2-5-7'
        },
        {
          id: 'stepper-gauge-2-controller-2',
          type: 'stepper-motor',
          pins: { step: 5, dir: 6, enable: 7 },
          description: 'Stepper motor for gauge 2 needle control on Gauge_2-5-7'
        },
        {
          id: 'stepper-gauge-3-controller-2',
          type: 'stepper-motor',
          pins: { step: 8, dir: 9, enable: 10 },
          description: 'Stepper motor for gauge 3 needle control on Gauge_2-5-7'
        },
        {
          id: 'stepper-gauge-1-controller-3',
          type: 'stepper-motor',
          pins: { step: 2, dir: 3, enable: 4 },
          description: 'Stepper motor for gauge 1 needle control on Gauge_6-Leds'
        },
        {
          id: 'stepper-gauge-2-controller-3',
          type: 'stepper-motor',
          pins: { step: 5, dir: 6, enable: 7 },
          description: 'Stepper motor for gauge 2 needle control on Gauge_6-Leds'
        },
        {
          id: 'stepper-gauge-3-controller-3',
          type: 'stepper-motor',
          pins: { step: 8, dir: 9, enable: 10 },
          description: 'Stepper motor for gauge 3 needle control on Gauge_6-Leds'
        }
      ]
    }
  },
  {
    id: 'clockwork-aether-power-source',
    name: 'Aether Power Source',
    roomId: 'clockwork',
    description:
      'Insert the Aether Power Source into the raised Newel Post to activate the clock mechanism and open the path forward.',
    timeLimitMs: 2 * 60 * 1000,
    prerequisites: ['clockwork-crank'],
    outputs: ['clockwork-aether-activation'],
    metadata: {
      devices: ['LeverRiddle', 'LeverBoiler'],
      deviceFriendlyName: 'Aether Insertion Point',
      mqttNamespace: 'Clockwork/LeverRiddle',
      inputs: [
        {
          id: 'aether-button',
          type: 'physical-button',
          description: 'Physical button on LeverRiddle Teensy detects Aether insertion into Newel Post.',
          mqttTopic: 'Clockwork/LeverRiddle/*/Events/AetherInserted',
          trigger: {
            event: 'AetherInserted',
            notes: 'Triggered when button is pressed, confirming Aether object is fully inserted.'
          }
        }
      ],
      outputs: [
        {
          id: 'aether-solve-sfx',
          type: 'sound-effect',
          sequenceId: 'clockwork-aether-sfx-solve',
          mqttTopic: 'Clockwork/Audio/commands/playCue',
          description: 'Plays the aether power source solve sound effect (Q22 - aether.wav via SCS).',
          mqttCommand: 'playCue',
          mqttDevice: 'Audio',
          actions: [
            {
              command: 'playCue',
              value: JSON.stringify({ cueId: 'Q22', command: 'playCue' }),
              label: '🔊 Test Aether SFX (Q22)',
              style: 'primary'
            }
          ]
        },
        {
          id: 'clock-lasers',
          type: 'laser-array',
          sequenceId: 'clockwork-aether-clock-lasers-on',
          description: 'Activate laser effects in the clock room.'
        },
        {
          id: 'clock-door-lock',
          type: 'door-lock',
          sequenceId: 'clockwork-aether-close-clock-door',
          description: 'Close and lock the door to the clock room.'
        },
        {
          id: 'study-door-prepare',
          type: 'door-actuator',
          sequenceId: 'clockwork-aether-study-door-ready',
          description: 'Prepare the Study door opening sequence for final exit.'
        }
      ],
      sequences: {
        prepare: {
          steps: [
            {
              order: 1,
              action: 'clockwork-aether-raise-newel-post',
              description: 'Raise Newel Post via stepper motor when Crank puzzle is solved.'
            }
          ]
        },
        solve: {
          sequenceId: 'clockwork-aether-activation',
          durationMs: 5000,
          steps: [
            {
              order: 1,
              offsetMs: 0,
              action: 'clockwork-aether-clock-lasers-on',
              description: 'Turn on clock room laser array.'
            },
            {
              order: 2,
              offsetMs: 1000,
              action: 'clockwork-aether-close-clock-door',
              description: 'Close and lock clock room door.'
            },
            {
              order: 3,
              offsetMs: 2000,
              action: 'clockwork-aether-study-door-ready',
              description: 'Prepare study door for opening sequence.'
            }
          ]
        }
      },
      references: [
        'docs/Clockwork Flow Chart-3.pdf',
        'docs/CLOCKWORK_HARDWARE_MAPPING.md'
      ]
    }
  }
];
