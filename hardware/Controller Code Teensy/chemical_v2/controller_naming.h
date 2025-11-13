#ifndef CONTROLLER_NAMING_H
#define CONTROLLER_NAMING_H

// Chemical Puzzle Controller v2 — Canonical naming
#include "FirmwareMetadata.h"

namespace naming
{
    constexpr const char *CLIENT_ID = "paragon";
    constexpr const char *ROOM_ID = "clockwork";
    constexpr const char *CONTROLLER_ID = firmware::UNIQUE_ID; // "chemical"
    constexpr const char *CONTROLLER_FRIENDLY_NAME = "Chemical Puzzle Controller";

    // Devices - 6 RFID readers + actuator + maglock
    constexpr const char *DEV_RFID_A = "rfid_a";
    constexpr const char *DEV_RFID_B = "rfid_b";
    constexpr const char *DEV_RFID_C = "rfid_c";
    constexpr const char *DEV_RFID_D = "rfid_d";
    constexpr const char *DEV_RFID_E = "rfid_e";
    constexpr const char *DEV_RFID_F = "rfid_f";
    constexpr const char *DEV_ACTUATOR = "actuator";
    constexpr const char *DEV_MAGLOCKS = "maglocks";

    // Friendly names
    constexpr const char *FRIENDLY_RFID_A = "RFID Reader A";
    constexpr const char *FRIENDLY_RFID_B = "RFID Reader B";
    constexpr const char *FRIENDLY_RFID_C = "RFID Reader C";
    constexpr const char *FRIENDLY_RFID_D = "RFID Reader D";
    constexpr const char *FRIENDLY_RFID_E = "RFID Reader E";
    constexpr const char *FRIENDLY_RFID_F = "RFID Reader F";
    constexpr const char *FRIENDLY_ACTUATOR = "Linear Actuator";
    constexpr const char *FRIENDLY_MAGLOCKS = "Door Maglocks";

    // Commands
    constexpr const char *CMD_ACTUATOR_FORWARD = "actuator_forward";
    constexpr const char *CMD_ACTUATOR_REVERSE = "actuator_reverse";
    constexpr const char *CMD_ACTUATOR_STOP = "actuator_stop";
    constexpr const char *CMD_MAGLOCKS_LOCK = "lock";
    constexpr const char *CMD_MAGLOCKS_UNLOCK = "unlock";

    // Friendly command names
    constexpr const char *FRIENDLY_CMD_ACTUATOR_FORWARD = "Actuator Forward";
    constexpr const char *FRIENDLY_CMD_ACTUATOR_REVERSE = "Actuator Reverse";
    constexpr const char *FRIENDLY_CMD_ACTUATOR_STOP = "Actuator Stop";
    constexpr const char *FRIENDLY_CMD_LOCK = "Lock";
    constexpr const char *FRIENDLY_CMD_UNLOCK = "Unlock";

    // Sensors
    constexpr const char *SENSOR_RFID_TAG = "rfid_tag";
    constexpr const char *SENSOR_TIR = "tag_in_range";

    // Categories
    constexpr const char *CAT_COMMANDS = "commands";
    constexpr const char *CAT_SENSORS = "sensors";
    constexpr const char *CAT_STATUS = "status";
    constexpr const char *CAT_EVENTS = "events";
    constexpr const char *ITEM_HEARTBEAT = "heartbeat";
    constexpr const char *ITEM_HARDWARE = "hardware";
    constexpr const char *ITEM_COMMAND_ACK = "command_ack";
}

#endif // CONTROLLER_NAMING_H
