#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

namespace firmware
{
  constexpr const char *VERSION = "2.1.7";
  constexpr const char *BUILD_DATE = "2025-10-18";
  // Controller identity (primary key). Use snake_case without room prefix.
  constexpr const char *UNIQUE_ID = "pilot_light";
  constexpr const char *DESCRIPTION = "Changed MQTT topics to snake_case format.";
}

#endif
