#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

// Firmware version information for Keys Puzzle
namespace FirmwareMetadata {
  constexpr const char* VERSION = "2.0.0";
  constexpr const char* BUILD_DATE = __DATE__;
  constexpr const char* BUILD_TIME = __TIME__;
  constexpr const char* DEVICE_NAME = "clockwork-keys";
  constexpr const char* DESCRIPTION = "Keys Puzzle - 8 key switches in 4 color pairs with LED feedback";

  // Migration notes
  constexpr const char* MIGRATION_FROM = "Keys.ino (ParagonMQTT)";
  constexpr const char* MIGRATION_TO = "MythraOS_MQTT architecture";
}

#endif // FIRMWARE_METADATA_H
