#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

namespace firmware
{
  constexpr const char *VERSION = "2.1.7";
  constexpr const char *BUILD_DATE = "2025-10-18";
  // Controller identity (primary key). Use snake_case without room prefix.
  constexpr const char *UNIQUE_ID = "gauge_1_3_4";
  constexpr const char *DESCRIPTION = "Converted all MQTT topics to snake_case (status/hardware, status/full)";
}

#endif
