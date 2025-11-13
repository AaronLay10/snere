#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

// Firmware version information for Vault Puzzle
namespace FirmwareMetadata {
  constexpr const char* VERSION = "2.0.0";
  constexpr const char* BUILD_DATE = __DATE__;
  constexpr const char* BUILD_TIME = __TIME__;
  constexpr const char* DEVICE_NAME = "clockwork-vault";
  constexpr const char* DESCRIPTION = "Vault Puzzle - RFID vault door identifier with 36 vault tags";

  // Migration notes
  constexpr const char* MIGRATION_FROM = "Vault.ino (ParagonMQTT)";
  constexpr const char* MIGRATION_TO = "MythraOS_MQTT architecture";
}

#endif // FIRMWARE_METADATA_H
