#line 1 "/opt/sentient/hardware/Controller Code Teensy/gauge_6_leds_v2/FirmwareMetadata.h"
#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

namespace firmware
{
    constexpr const char *VERSION = "2.0.7";
    constexpr const char *BUILD_DATE = "2025-10-29";
    // UNIQUE_ID must equal controller_id and be globally unique per controller
    constexpr const char *UNIQUE_ID = "gauge_6_leds";
    constexpr const char *DESCRIPTION = "Upgraded to v2 architecture with controller_naming.h and device-scoped command routing.";
}

#endif // FIRMWARE_METADATA_H
