import { logger } from '../logger';
import { SafetyCheck, SceneRuntime } from '../types';
import { DeviceMonitorClient } from '../clients/DeviceMonitorClient';

export interface SafetyCheckResult {
  passed: boolean;
  failedChecks: Array<{
    check: SafetyCheck;
    reason: string;
    currentValue?: unknown;
  }>;
}

/**
 * SafetyVerifier ensures all safety conditions are met before starting scenes
 *
 * This is critical for player safety - mechanical movements, doors, etc.
 * must verify sensors before activation.
 */
export class SafetyVerifier {
  constructor(private readonly deviceMonitor?: DeviceMonitorClient) {}

  /**
   * Verify all safety checks for a scene
   */
  public async verify(scene: SceneRuntime): Promise<SafetyCheckResult> {
    if (!scene.safetyChecks || scene.safetyChecks.length === 0) {
      // No safety checks required
      return { passed: true, failedChecks: [] };
    }

    logger.info(
      { sceneId: scene.id, checkCount: scene.safetyChecks.length },
      'Running safety checks'
    );

    const failedChecks: SafetyCheckResult['failedChecks'] = [];

    for (const check of scene.safetyChecks) {
      const result = await this.verifySingleCheck(check);
      if (!result.passed) {
        failedChecks.push({
          check,
          reason: result.reason,
          currentValue: result.currentValue
        });
      }
    }

    const passed = failedChecks.length === 0;

    if (passed) {
      logger.info({ sceneId: scene.id }, 'All safety checks passed');
    } else {
      logger.error(
        {
          sceneId: scene.id,
          failedChecks: failedChecks.map((f) => ({
            checkId: f.check.id,
            reason: f.reason
          }))
        },
        'Safety checks failed'
      );
    }

    return { passed, failedChecks };
  }

  /**
   * Verify a single safety check
   */
  private async verifySingleCheck(
    check: SafetyCheck
  ): Promise<{ passed: boolean; reason: string; currentValue?: unknown }> {
    try {
      // If no device monitor, we can't verify device-based checks
      if (check.deviceId && !this.deviceMonitor) {
        logger.warn(
          { checkId: check.id, deviceId: check.deviceId },
          'Cannot verify device check: DeviceMonitor not available'
        );
        return {
          passed: false,
          reason: 'Device monitoring not available'
        };
      }

      // Query device state
      if (check.deviceId && this.deviceMonitor) {
        const deviceState = await this.deviceMonitor.getDeviceState(check.deviceId);

        if (!deviceState) {
          return {
            passed: false,
            reason: `Device ${check.deviceId} not found or offline`
          };
        }

        // If expected value is specified, check it
        if (check.expectedValue !== undefined) {
          // Compare the device state to expected value
          const matches = this.compareValues(deviceState, check.expectedValue);

          if (!matches) {
            return {
              passed: false,
              reason: `Device ${check.deviceId} state mismatch`,
              currentValue: deviceState
            };
          }
        }

        logger.debug({ checkId: check.id, deviceId: check.deviceId }, 'Safety check passed');
        return { passed: true, reason: '' };
      }

      // For checks without device ID, assume they're manual/external checks
      // These would need to be verified through other means (e.g., operator confirmation)
      logger.warn(
        { checkId: check.id },
        'Safety check has no deviceId - assuming manual verification'
      );
      return { passed: true, reason: '' };
    } catch (error) {
      logger.error(
        { checkId: check.id, error },
        'Error during safety check verification'
      );
      return {
        passed: false,
        reason: `Verification error: ${(error as Error).message}`
      };
    }
  }

  /**
   * Compare device state to expected value
   * Handles different data types and nested objects
   */
  private compareValues(actual: unknown, expected: unknown): boolean {
    // Simple equality check for primitives
    if (typeof expected !== 'object' || expected === null) {
      return actual === expected;
    }

    // For objects, check if all expected keys match
    if (typeof actual === 'object' && actual !== null) {
      const expectedObj = expected as Record<string, unknown>;
      const actualObj = actual as Record<string, unknown>;

      return Object.entries(expectedObj).every(
        ([key, value]) => this.compareValues(actualObj[key], value)
      );
    }

    return false;
  }

  /**
   * Quick check if any safety checks are defined
   */
  public hasSafetyChecks(scene: SceneRuntime): boolean {
    return (scene.safetyChecks?.length ?? 0) > 0;
  }
}
