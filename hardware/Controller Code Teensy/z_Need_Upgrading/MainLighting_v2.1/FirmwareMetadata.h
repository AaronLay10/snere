#ifndef FIRMWARE_METADATA_H
#define FIRMWARE_METADATA_H

namespace firmware
{
  // Change VERSION when making significant code changes - triggers re-registration
  // UNIQUE_ID must equal controller_id and be globally unique per controller
  constexpr const char *UNIQUE_ID = "main_lighting";
  constexpr const char *VERSION = "2.1.0";
  constexpr const char *BUILD_DATE = __DATE__ " " __TIME__;
}

#endif // FIRMWARE_METADATA_H
