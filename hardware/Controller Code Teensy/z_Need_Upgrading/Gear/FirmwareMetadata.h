/**
 * Firmware Metadata - Gear Puzzle
 *
 * Version Format: vMAJOR.MINOR.PATCH
 */

#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

#define FIRMWARE_VERSION "v1.0.0"
#define FIRMWARE_DATE "2025-10-11"
#define FIRMWARE_AUTHOR "ParagonMythraOS"

// Teensy board version helper
const char* teensyBoardVersion() {
  #if defined(__MK20DX256__)
    return "Teensy 3.2";
  #elif defined(__MK64FX512__)
    return "Teensy 3.5";
  #elif defined(__MK66FX1M0__)
    return "Teensy 3.6";
  #elif defined(__IMXRT1062__)
    #if defined(ARDUINO_TEENSY40)
      return "Teensy 4.0";
    #elif defined(ARDUINO_TEENSY41)
      return "Teensy 4.1";
    #elif defined(ARDUINO_TEENSYMM)
      return "Teensy MicroMod";
    #else
      return "Teensy 4.x";
    #endif
  #else
    return "Unknown Teensy";
  #endif
}

#endif // FIRMWARE_METADATA_H
