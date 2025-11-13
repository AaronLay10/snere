#line 1 "/opt/sentient/hardware/Controller Code Teensy/LeverBoiler_v2.1/FirmwareMetadata.h"
#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

namespace firmware
{
  constexpr const char *VERSION = "2.1.6";
  constexpr const char *BUILD_DATE = "2025-10-18";
  // Controller identity (primary key). Use snake_case without room prefix.
  constexpr const char *UNIQUE_ID = "lever_boiler";
  constexpr const char *DESCRIPTION = "Changed MQTT topics to snake_case format.";
}

#endif
