'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  AlertTriangle,
  Zap,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  Power,
  ToggleLeft,
  ToggleRight,
  Lightbulb,
  Activity,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DeviceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  deviceCategory: string;
  emergencyStopRequired?: boolean;
  capabilities?: { commands?: string[] };
  deviceCommandName?: string; // Single command name from device registry
  onTest: (action: string, parameters: any, confirmSafety: boolean) => Promise<any>;
}

interface ActionButton {
  id: string;
  label: string;
  icon: any;
  color: string;
  parameters?: {
    name: string;
    type: 'number' | 'boolean' | 'string';
    label: string;
    default?: any;
    min?: number;
    max?: number;
  }[];
}

// Define common actions based on device type
const getActionsForDevice = (deviceType: string, deviceCategory: string, capabilities?: { commands?: string[] }, deviceCommandName?: string): ActionButton[] => {
  const actions: ActionButton[] = [];

  // Priority 1: Use device_command_name from device registry (from Teensy)
  if (deviceCommandName) {
    // Check if this is an ON/OFF type command
    const lowerCommand = deviceCommandName.toLowerCase();
    const isOnCommand = lowerCommand.endsWith('_on') || lowerCommand.endsWith('on');
    const isOffCommand = lowerCommand.endsWith('_off') || lowerCommand.endsWith('off');

    if (isOnCommand) {
      // Automatically add both ON and OFF buttons
      const baseCommand = deviceCommandName.replace(/_on$/i, '').replace(/on$/i, '');

      actions.push({
        id: `${baseCommand}_on`,
        label: 'Turn ON',
        icon: Play,
        color: 'green',
      });

      actions.push({
        id: `${baseCommand}_off`,
        label: 'Turn OFF',
        icon: Play,
        color: 'red',
      });
    } else if (isOffCommand) {
      // Automatically add both ON and OFF buttons
      const baseCommand = deviceCommandName.replace(/_off$/i, '').replace(/off$/i, '');

      actions.push({
        id: `${baseCommand}_on`,
        label: 'Turn ON',
        icon: Play,
        color: 'green',
      });

      actions.push({
        id: `${baseCommand}_off`,
        label: 'Turn OFF',
        icon: Play,
        color: 'red',
      });
    } else {
      // Not an ON/OFF command - just add the single command
      actions.push({
        id: deviceCommandName,
        label: deviceCommandName.replace(/([A-Z])/g, ' $1').trim(), // Convert camelCase to Title Case
        icon: Play,
        color: 'cyan',
      });
    }

    // Add custom command option
    actions.push({
      id: 'custom',
      label: 'Custom Command',
      icon: Send,
      color: 'gray',
      parameters: [
        {
          name: 'command',
          type: 'string',
          label: 'Command Name',
          default: '',
        },
      ],
    });

    return actions;
  }

  // Priority 2: If device has registered commands in capabilities, use those
  if (capabilities?.commands && capabilities.commands.length > 0) {
    capabilities.commands.forEach(command => {
      actions.push({
        id: command,
        label: command.replace(/([A-Z])/g, ' $1').trim(), // Convert camelCase to Title Case
        icon: Play,
        color: 'cyan',
      });
    });

    // Still add custom command option
    actions.push({
      id: 'custom',
      label: 'Custom Command',
      icon: Send,
      color: 'gray',
      parameters: [
        {
          name: 'command',
          type: 'string',
          label: 'Command Name',
          default: '',
        },
      ],
    });

    return actions;
  }

  // Priority 3: No registered commands - only offer custom command
  // Remove hardcoded device-type-specific buttons
  actions.push({
    id: 'custom',
    label: 'Custom Command',
    icon: Send,
    color: 'gray',
    parameters: [
      {
        name: 'command',
        type: 'string',
        label: 'Command Name',
        default: '',
      },
    ],
  });

  return actions;
};

export default function DeviceTestModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
  deviceType,
  deviceCategory,
  emergencyStopRequired = false,
  capabilities,
  deviceCommandName,
  onTest,
}: DeviceTestModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionButton | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [confirmSafety, setConfirmSafety] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const actions = getActionsForDevice(deviceType, deviceCategory, capabilities, deviceCommandName);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Initialize parameters with defaults when action is selected
    if (selectedAction?.parameters) {
      const defaultParams: Record<string, any> = {};
      selectedAction.parameters.forEach((param) => {
        defaultParams[param.name] = param.default ?? '';
      });
      setParameters(defaultParams);
    } else {
      setParameters({});
    }
  }, [selectedAction]);

  const handleParameterChange = (name: string, value: any) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  const handleTest = async () => {
    if (!selectedAction) {
      toast.error('Please select an action');
      return;
    }

    if (emergencyStopRequired && !confirmSafety) {
      toast.error('Please confirm safety procedures for this emergency-stop device');
      return;
    }

    // Build the action string
    let actionString = selectedAction.id;
    if (selectedAction.id === 'custom' && parameters.command) {
      actionString = parameters.command;
    }

    setTesting(true);
    setResult(null);

    try {
      const response = await onTest(actionString, parameters, confirmSafety);
      setResult({ success: true, data: response });
      toast.success(`Command "${actionString}" sent to ${deviceName}`);
    } catch (error: any) {
      setResult({ success: false, error: error.response?.data || error.message });
      toast.error(error.response?.data?.message || 'Failed to send command');
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setSelectedAction(null);
    setParameters({});
    setConfirmSafety(false);
    setResult(null);
    onClose();
  };

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-3xl bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-cyan-500/30 overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-500/10">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white">Test Device</h2>
                <p className="text-sm text-gray-400">{deviceName}</p>
                <p className="text-xs text-gray-500 capitalize">{deviceType} • {deviceCategory}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Emergency Stop Warning */}
          {emergencyStopRequired && (
            <div className="p-4 bg-red-500/10 border-b border-red-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-400 mb-1">
                    Emergency Stop Required
                  </h3>
                  <p className="text-xs text-gray-300">
                    This device is classified as requiring emergency stop integration. Ensure all
                    safety procedures are followed before testing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Action Selection */}
            {!selectedAction ? (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Select an Action</h3>

                {/* Show message if no commands registered (only Custom Command available) */}
                {actions.length === 1 && actions[0].id === 'custom' && (
                  <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-400 mb-1">
                          No Commands Registered
                        </p>
                        <p className="text-xs text-gray-300">
                          This device has not registered any commands with Sentient.
                          Use the Custom Command option below to manually send MQTT commands.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => setSelectedAction(action)}
                        className={`p-4 rounded-xl border-2 border-${action.color}-500/30 bg-${action.color}-500/10 hover:bg-${action.color}-500/20 transition-all group`}
                      >
                        <Icon className={`w-6 h-6 text-${action.color}-400 mx-auto mb-2`} />
                        <p className="text-sm font-medium text-white">{action.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Action Display */}
                <div className="flex items-center justify-between p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
                  <div className="flex items-center gap-3">
                    <selectedAction.icon className="w-6 h-6 text-cyan-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedAction.label}</p>
                      <p className="text-xs text-gray-400">Action ID: {selectedAction.id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAction(null)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Change
                  </button>
                </div>

                {/* Parameters */}
                {selectedAction.parameters && selectedAction.parameters.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-300">Parameters</h4>
                    {selectedAction.parameters.map((param) => (
                      <div key={param.name}>
                        <label className="block text-xs text-gray-400 mb-1">{param.label}</label>
                        {param.type === 'number' ? (
                          <input
                            type="number"
                            value={parameters[param.name] ?? param.default ?? 0}
                            onChange={(e) => handleParameterChange(param.name, parseInt(e.target.value))}
                            min={param.min}
                            max={param.max}
                            className="w-full px-3 py-2 bg-black/30 border border-cyan-500/20 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
                          />
                        ) : param.type === 'boolean' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleParameterChange(param.name, !parameters[param.name])}
                              className={`px-4 py-2 rounded-lg transition-colors ${
                                parameters[param.name]
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {parameters[param.name] ? 'True' : 'False'}
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={parameters[param.name] ?? param.default ?? ''}
                            onChange={(e) => handleParameterChange(param.name, e.target.value)}
                            className="w-full px-3 py-2 bg-black/30 border border-cyan-500/20 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
                          />
                        )}
                        {param.min !== undefined && param.max !== undefined && (
                          <p className="text-xs text-gray-500 mt-1">Range: {param.min} - {param.max}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Safety Confirmation */}
                {emergencyStopRequired && (
                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmSafety}
                        onChange={(e) => setConfirmSafety(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-red-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-red-400">Confirm Safety Procedures</p>
                        <p className="text-xs text-gray-400 mt-1">
                          I have verified emergency stop systems are in place and operational
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Result Display */}
                {result && (
                  <div className={`p-4 rounded-xl border ${result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="flex items-start gap-3">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                          {result.success ? 'Command Sent Successfully' : 'Command Failed'}
                        </p>
                        <pre className="text-xs text-gray-300 mt-2 overflow-auto max-h-32">
                          {JSON.stringify(result.success ? result.data : result.error, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedAction && (
            <div className="p-6 border-t border-gray-700 bg-black/30">
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-6 py-3 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing || (emergencyStopRequired && !confirmSafety)}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Send Command</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
