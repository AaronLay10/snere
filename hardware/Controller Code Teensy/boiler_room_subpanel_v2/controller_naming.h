#ifndef CONTROLLER_NAMING_H
#define CONTROLLER_NAMING_H

// Boiler Room Subpanel v2.1 — Canonical naming
// Purpose: single source of truth for identifiers used in MQTT topics and manifests.
// This file does NOT change behavior until included by the sketch; safe to edit iteratively.

#include "FirmwareMetadata.h" // Provides firmware::UNIQUE_ID (must equal controller_id)

namespace naming
{
    // Tenant and room identifiers (snake_case, DB-sourced)
    constexpr const char *CLIENT_ID = "paragon";
    constexpr const char *ROOM_ID = "clockwork";

    // Controller identifier: must match DB controllers.controller_id
    // By convention, this equals firmware::UNIQUE_ID
    constexpr const char *CONTROLLER_ID = firmware::UNIQUE_ID; // "boiler_room_subpanel"

    // Friendly names (UI-only; never used in MQTT topics)
    constexpr const char *CONTROLLER_FRIENDLY_NAME = "Boiler Room Subpanel";

    // Device identifiers (one physical unit = one device_id)
    // Use these in capability manifests and topic construction.
    constexpr const char *DEV_INTRO_TV = "intro_tv_control"; // Renamed to avoid collision with Pi video player
    constexpr const char *DEV_BOILER_FOG_MACHINE = "boiler_room_fog_machine";
    constexpr const char *DEV_BOILER_ROOM_BARREL = "boiler_room_barrel";
    constexpr const char *DEV_STUDY_DOOR = "study_door";
    constexpr const char *DEV_GAUGE_PROGRESS_CHEST = "gauge_progress_chest";
    // Controller-scoped virtual device (for controller-level commands)
    constexpr const char *DEV_CONTROLLER = "controller";

    // Device friendly names (UI-only)
    constexpr const char *FRIENDLY_INTRO_TV = "Intro TV Control";
    constexpr const char *FRIENDLY_BOILER_FOG_MACHINE = "Fog Machine";
    constexpr const char *FRIENDLY_BOILER_ROOM_BARREL = "Barrel Maglock";
    constexpr const char *FRIENDLY_STUDY_DOOR = "Study Door";
    constexpr const char *FRIENDLY_GAUGE_PROGRESS_CHEST = "Gauge Progress Chest";
    constexpr const char *FRIENDLY_CONTROLLER = "Controller";

    // Command slugs (snake_case). Map the older mixedCase to these during migration.
    // Intro TV
    constexpr const char *CMD_TV_POWER_ON = "power_on";
    constexpr const char *CMD_TV_POWER_OFF = "power_off";
    constexpr const char *CMD_TV_LIFT_UP = "lift_up";
    constexpr const char *CMD_TV_LIFT_DOWN = "lower_down"; // or "lift_down"
    // Boiler Room Fog machine
    constexpr const char *CMD_FOG_POWER_ON = "fog_power_on";
    constexpr const char *CMD_FOG_POWER_OFF = "fog_power_off";
    constexpr const char *CMD_FOG_TRIGGER = "trigger_fog";
    constexpr const char *CMD_ULTRASONIC_ON = "ultrasonic_on";
    constexpr const char *CMD_ULTRASONIC_OFF = "ultrasonic_off";
    // Study Door
    constexpr const char *CMD_DOOR_LOCK = "lock";
    constexpr const char *CMD_DOOR_UNLOCK = "unlock";
    // Gauge Progress Chest
    constexpr const char *CMD_GAUGE_SOLVED_1 = "solved_1";
    constexpr const char *CMD_GAUGE_SOLVED_2 = "solved_2";
    constexpr const char *CMD_GAUGE_SOLVED_3 = "solved_3";
    constexpr const char *CMD_GAUGE_CLEAR = "clear";
    // Boiler Room Barrel
    constexpr const char *CMD_BARREL_LOCK = "lock";
    constexpr const char *CMD_BARREL_UNLOCK = "unlock";
    // IR
    constexpr const char *CMD_ACTIVATE_IR = "activate_ir"; // prefer snake_case if changing
    constexpr const char *CMD_DEACTIVATE_IR = "deactivate_ir";

    // Controller-level commands
    constexpr const char *CMD_CONTROLLER_POWER_OFF_SEQUENCE = "power_off_sequence"; // initiate graceful shutdown sequence

    // Friendly names for commands (UI-only; sent during registration)
    // Intro TV
    constexpr const char *FRIENDLY_CMD_TV_POWER_ON = "Intro TV Power On";
    constexpr const char *FRIENDLY_CMD_TV_POWER_OFF = "Intro TV Power Off";
    constexpr const char *FRIENDLY_CMD_TV_LIFT_UP = "Intro TV Lift Up";
    constexpr const char *FRIENDLY_CMD_TV_LIFT_DOWN = "Intro TV Lift Down";
    // Boiler Room Fog machine
    constexpr const char *FRIENDLY_CMD_FOG_POWER_ON = "Fog Machine Power On";
    constexpr const char *FRIENDLY_CMD_FOG_POWER_OFF = "Fog Machine Power Off";
    constexpr const char *FRIENDLY_CMD_FOG_TRIGGER = "Fog Machine Trigger";
    constexpr const char *FRIENDLY_CMD_ULTRASONIC_ON = "Fog Machine Ultrasonic On";
    constexpr const char *FRIENDLY_CMD_ULTRASONIC_OFF = "Fog Machine Ultrasonic Off";
    // Study Door
    constexpr const char *FRIENDLY_CMD_DOOR_LOCK = "Lock Study Room Door";
    constexpr const char *FRIENDLY_CMD_DOOR_UNLOCK = "Unlock Study Room Door";
    // Gauge Progress Chest
    constexpr const char *FRIENDLY_CMD_GAUGE_SOLVED_1 = "Set Gauge Progress 1";
    constexpr const char *FRIENDLY_CMD_GAUGE_SOLVED_2 = "Set Gauge Progress 2";
    constexpr const char *FRIENDLY_CMD_GAUGE_SOLVED_3 = "Set Gauge Progress 3";
    constexpr const char *FRIENDLY_CMD_GAUGE_CLEAR = "Clear Gauge Progress";
    // Barrel
    constexpr const char *FRIENDLY_CMD_BARREL_LOCK = "Lock Barrel";
    constexpr const char *FRIENDLY_CMD_BARREL_UNLOCK = "Unlock Barrel";
    constexpr const char *FRIENDLY_CMD_BARREL_ACTIVATE_IR = "Barrel Activate IR";
    constexpr const char *FRIENDLY_CMD_BARREL_DEACTIVATE_IR = "Barrel Deactivate IR";

    // Controller-level command friendly names
    constexpr const char *FRIENDLY_CMD_CONTROLLER_POWER_OFF_SEQUENCE = "Power-Off Sequence";

    // Categories (fixed, lowercase)
    constexpr const char *CAT_COMMANDS = "commands";
    constexpr const char *CAT_SENSORS = "sensors";
    constexpr const char *CAT_STATUS = "status";
    constexpr const char *CAT_EVENTS = "events";
    constexpr const char *ITEM_HEARTBEAT = "heartbeat";
    constexpr const char *ITEM_HARDWARE = "hardware";
} // namespace naming

#endif // CONTROLLER_NAMING_H
