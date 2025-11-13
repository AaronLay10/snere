import { logger } from '../logger';
import { SceneRuntime, ConditionGroup, PuzzleCondition, ConditionOperator } from '../types';
import { SensorMessage } from '../mqtt/MQTTClient';

/**
 * ConditionEvaluator evaluates puzzle win conditions based on sensor data
 *
 * Example puzzle metadata with win conditions:
 * {
 *   "id": "gauge_puzzle",
 *   "winConditions": {
 *     "logic": "AND",
 *     "conditions": [
 *       {"deviceId": "Gauge_1-3-4_v2", "sensorName": "GaugePositions", "field": "gauge_1", "operator": "==", "value": 50, "tolerance": 5},
 *       {"deviceId": "Gauge_1-3-4_v2", "sensorName": "GaugePositions", "field": "gauge_3", "operator": "==", "value": 75, "tolerance": 5},
 *       {"deviceId": "Gauge_2-5-7_v2", "sensorName": "GaugePositions", "field": "gauge_2", "operator": "==", "value": 25, "tolerance": 5}
 *     ]
 *   }
 * }
 */
export class ConditionEvaluator {
  // Store latest sensor values for each device
  private readonly sensorCache = new Map<string, Map<string, Record<string, unknown>>>();

  /**
   * Update sensor cache with new sensor data
   */
  public updateSensorData(message: SensorMessage): void {
    const { deviceId, sensorName, payload } = message;

    let deviceCache = this.sensorCache.get(deviceId);
    if (!deviceCache) {
      deviceCache = new Map();
      this.sensorCache.set(deviceId, deviceCache);
    }

    deviceCache.set(sensorName, payload);

    logger.debug(
      { deviceId, sensorName, payload },
      'Sensor cache updated'
    );
  }

  /**
   * Evaluate if a puzzle's win conditions are met
   */
  public evaluatePuzzle(puzzle: SceneRuntime): boolean {
    if (puzzle.type !== 'puzzle') {
      return false;
    }

    // Extract win conditions from puzzle metadata
    const winConditions = puzzle.metadata?.winConditions as ConditionGroup | undefined;

    if (!winConditions) {
      logger.warn(
        { puzzleId: puzzle.id },
        'Puzzle has no win conditions defined in metadata'
      );
      return false;
    }

    return this.evaluateConditionGroup(winConditions);
  }

  /**
   * Evaluate a group of conditions with AND/OR logic
   * Public method to support external condition evaluation (e.g., sensor watches)
   */
  public evaluateConditionGroup(group: ConditionGroup): boolean {
    const results = group.conditions.map((condition) => this.evaluateCondition(condition));

    if (group.logic === 'AND') {
      return results.every((result) => result);
    } else {
      // OR logic
      return results.some((result) => result);
    }
  }

  /**
   * Evaluate a single condition
   * Public method to support external condition evaluation (e.g., sensor watches)
   */
  public evaluateCondition(condition: PuzzleCondition): boolean {
    const { deviceId, sensorName, field, operator, value, tolerance } = condition;

    // Get sensor data from cache
    const deviceCache = this.sensorCache.get(deviceId);
    if (!deviceCache) {
      logger.debug({ deviceId }, 'No sensor data cached for device');
      return false;
    }

    const sensorData = deviceCache.get(sensorName);
    if (!sensorData) {
      logger.debug({ deviceId, sensorName }, 'No data cached for sensor');
      return false;
    }

    const actualValue = sensorData[field];
    if (actualValue === undefined) {
      logger.debug({ deviceId, sensorName, field }, 'Field not found in sensor data');
      return false;
    }

    // Evaluate based on operator
    switch (operator) {
      case '==':
        return this.evaluateEquals(actualValue, value, tolerance);

      case '!=':
        return !this.evaluateEquals(actualValue, value, tolerance);

      case '>':
        return typeof actualValue === 'number' && typeof value === 'number' && actualValue > value;

      case '<':
        return typeof actualValue === 'number' && typeof value === 'number' && actualValue < value;

      case '>=':
        return typeof actualValue === 'number' && typeof value === 'number' && actualValue >= value;

      case '<=':
        return typeof actualValue === 'number' && typeof value === 'number' && actualValue <= value;

      case 'between':
        if (
          typeof actualValue === 'number' &&
          Array.isArray(value) &&
          value.length === 2
        ) {
          return actualValue >= value[0] && actualValue <= value[1];
        }
        return false;

      case 'in':
        return Array.isArray(value) && value.includes(actualValue);

      case 'all':
        if (Array.isArray(actualValue) && Array.isArray(value)) {
          return value.every((v) => actualValue.includes(v));
        }
        return false;

      case 'any':
        if (Array.isArray(actualValue) && Array.isArray(value)) {
          return value.some((v) => actualValue.includes(v));
        }
        return false;

      default:
        logger.warn({ operator }, 'Unknown condition operator');
        return false;
    }
  }

  /**
   * Evaluate equality with optional tolerance for numeric values
   */
  private evaluateEquals(
    actualValue: unknown,
    expectedValue: unknown,
    tolerance?: number
  ): boolean {
    // Numeric comparison with tolerance
    if (
      typeof actualValue === 'number' &&
      typeof expectedValue === 'number' &&
      tolerance !== undefined
    ) {
      return Math.abs(actualValue - expectedValue) <= tolerance;
    }

    // Exact equality
    return actualValue === expectedValue;
  }

  /**
   * Get current sensor value for debugging
   */
  public getSensorValue(
    deviceId: string,
    sensorName: string,
    field: string
  ): unknown | undefined {
    const deviceCache = this.sensorCache.get(deviceId);
    if (!deviceCache) return undefined;

    const sensorData = deviceCache.get(sensorName);
    if (!sensorData) return undefined;

    return sensorData[field];
  }

  /**
   * Get all sensor data for a specific device
   * Useful for debugging and monitoring
   */
  public getDeviceSensorData(deviceId: string): Map<string, Record<string, unknown>> | undefined {
    return this.sensorCache.get(deviceId);
  }

  /**
   * Get all cached device IDs
   */
  public getCachedDeviceIds(): string[] {
    return Array.from(this.sensorCache.keys());
  }

  /**
   * Clear sensor cache (for testing or reset)
   */
  public clearCache(deviceId?: string): void {
    if (deviceId) {
      this.sensorCache.delete(deviceId);
      logger.debug({ deviceId }, 'Cleared sensor cache for device');
    } else {
      this.sensorCache.clear();
      logger.debug('Cleared all sensor cache');
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { deviceCount: number; sensorCount: number } {
    let sensorCount = 0;
    for (const deviceCache of this.sensorCache.values()) {
      sensorCount += deviceCache.size;
    }

    return {
      deviceCount: this.sensorCache.size,
      sensorCount
    };
  }
}
