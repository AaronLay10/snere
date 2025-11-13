#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

// Firmware version information for Chemical Puzzle
namespace FirmwareMetadata {
  constexpr const char* VERSION = "2.0.0";
  constexpr const char* BUILD_DATE = __DATE__;
  constexpr const char* BUILD_TIME = __TIME__;
  constexpr const char* DEVICE_NAME = "clockwork-chemical";
  constexpr const char* DESCRIPTION = "Chemical Puzzle - 6 RFID readers with drawer actuator mechanism";

  // Migration notes
  constexpr const char* MIGRATION_FROM = "Chemical.ino (ParagonMQTT)";
  constexpr const char* MIGRATION_TO = "MythraOS_MQTT architecture";
}

#endif // FIRMWARE_METADATA_H
