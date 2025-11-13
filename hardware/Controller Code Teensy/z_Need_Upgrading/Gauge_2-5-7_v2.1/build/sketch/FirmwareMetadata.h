#line 1 "/opt/sentient/hardware/Controller Code Teensy/Gauge_2-5-7_v2.1/FirmwareMetadata.h"
#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

namespace firmware
{
  constexpr const char *VERSION = "2.1.7";
  constexpr const char *BUILD_DATE = "2025-10-18";
  // Controller identity (primary key). Use snake_case without room prefix.
  constexpr const char *UNIQUE_ID = "gauge_2_5_7";
  constexpr const char *DESCRIPTION = "Converted all MQTT topics to snake_case (status/hardware, status/full)";
}

#endif
