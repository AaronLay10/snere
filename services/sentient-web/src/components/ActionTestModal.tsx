'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  Clock,
  Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ActionParameter {
  name: string;
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  default?: any;
  description?: string;
}

interface Action {
  action_id: string;
  friendly_name: string;
  description?: string;
  safety_critical?: boolean;
  duration_ms?: number;
  can_interrupt?: boolean;
  parameters?: ActionParameter[];
}

interface ActionTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: Action | null;
  controllerName: string;
  onTest: (actionId: string, parameters: any, confirmSafety: boolean) => Promise<any>;
}

export default function ActionTestModal({
  isOpen,
  onClose,
  action,
  controllerName,
  onTest,
}: ActionTestModalProps) {
  const [mounted, setMounted] = useState(false);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [confirmSafety, setConfirmSafety] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Mount guard for SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize parameters with defaults
  useEffect(() => {
    if (action?.parameters) {
      const defaultParams: Record<string, any> = {};
      action.parameters.forEach((param) => {
        if (param.default !== undefined) {
          defaultParams[param.name] = param.default;
        }
      });
      setParameters(defaultParams);
    } else {
      setParameters({});
    }
  }, [action]);

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const validateParameters = (): boolean => {
    if (!action?.parameters) return true;

    for (const param of action.parameters) {
      if (param.required && parameters[param.name] === undefined) {
        toast.error(`Required parameter "${param.name}" is missing`);
        return false;
      }

      if (parameters[param.name] !== undefined && param.type === 'number') {
        const value = parseFloat(parameters[param.name]);
        if (isNaN(value)) {
          toast.error(`Parameter "${param.name}" must be a number`);
          return false;
        }
        if (param.min !== undefined && value < param.min) {
          toast.error(`Parameter "${param.name}" must be >= ${param.min}`);
          return false;
        }
        if (param.max !== undefined && value > param.max) {
          toast.error(`Parameter "${param.name}" must be <= ${param.max}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleTest = async () => {
    if (!action) return;

    if (action.safety_critical && !confirmSafety) {
      toast.error('Please confirm safety procedures for this safety-critical action');
      return;
    }

    if (!validateParameters()) {
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const response = await onTest(action.action_id, parameters, confirmSafety);
      setResult({ success: true, data: response });
      toast.success(`Action "${action.friendly_name}" executed successfully`);
    } catch (error: any) {
      setResult({ success: false, error: error.response?.data || error.message });
      toast.error(error.response?.data?.message || 'Failed to execute action');
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setParameters({});
    setConfirmSafety(false);
    setResult(null);
    onClose();
  };

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && action && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-cyan-500/30 overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl ${
                  action.safety_critical ? 'bg-red-500/10' : 'bg-purple-500/10'
                }`}
              >
                <Play className={`w-6 h-6 ${action.safety_critical ? 'text-red-400' : 'text-purple-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold text-white">{action.friendly_name}</h2>
                  {action.safety_critical && (
                    <div className="relative group">
                      <Shield className="w-5 h-5 text-red-400" />
                      <span className="absolute left-1/2 -translate-x-1/2 -top-8 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Safety Critical
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-400">{controllerName}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Safety Warning */}
          {action.safety_critical && (
            <div className="p-4 bg-red-500/10 border-b border-red-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-400 mb-1">
                    Safety-Critical Action
                  </h3>
                  <p className="text-xs text-gray-300">
                    This action is classified as safety-critical. Ensure all safety procedures are
                    followed before executing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Description */}
            {action.description && (
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-gray-300">{action.description}</p>
              </div>
            )}

            {/* Action Info */}
            <div className="grid grid-cols-2 gap-4">
              {action.duration_ms !== undefined && (
                <div className="p-3 bg-black/30 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs uppercase">Duration</span>
                  </div>
                  <p className="text-white font-semibold">{action.duration_ms}ms</p>
                </div>
              )}
              {action.can_interrupt !== undefined && (
                <div className="p-3 bg-black/30 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Ban className="w-4 h-4" />
                    <span className="text-xs uppercase">Interruptible</span>
                  </div>
                  <p
                    className={`font-semibold ${
                      action.can_interrupt ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {action.can_interrupt ? 'Yes' : 'No'}
                  </p>
                </div>
              )}
            </div>

            {/* Parameters */}
            {action.parameters && action.parameters.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Parameters
                </h3>
                {action.parameters.map((param) => (
                  <div key={param.name} className="space-y-2">
                    <label className="block">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{param.name}</span>
                        <span className="text-xs text-purple-400 font-mono">{param.type}</span>
                        {param.required && (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs">
                            required
                          </span>
                        )}
                      </div>
                      {param.description && (
                        <p className="text-xs text-gray-500 mb-2">{param.description}</p>
                      )}
                      {param.type === 'number' ? (
                        <div className="relative">
                          <input
                            type="number"
                            value={parameters[param.name] ?? ''}
                            onChange={(e) =>
                              handleParameterChange(param.name, parseFloat(e.target.value))
                            }
                            min={param.min}
                            max={param.max}
                            step="any"
                            placeholder={param.default !== undefined ? String(param.default) : ''}
                            className="w-full px-4 py-2.5 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                          />
                          {(param.min !== undefined || param.max !== undefined) && (
                            <p className="mt-1 text-xs text-gray-500">
                              Range: {param.min ?? '−∞'} to {param.max ?? '∞'}
                            </p>
                          )}
                        </div>
                      ) : param.type === 'boolean' ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={parameters[param.name] ?? false}
                            onChange={(e) => handleParameterChange(param.name, e.target.checked)}
                            className="w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500/20"
                          />
                          <span className="text-sm text-gray-400">Enable</span>
                        </label>
                      ) : (
                        <input
                          type="text"
                          value={parameters[param.name] ?? ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                          placeholder={param.default !== undefined ? String(param.default) : ''}
                          className="w-full px-4 py-2.5 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                        />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-gray-700/30 rounded-lg text-center">
                <p className="text-sm text-gray-400">This action has no parameters</p>
              </div>
            )}

            {/* Safety Confirmation */}
            {action.safety_critical && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmSafety}
                    onChange={(e) => setConfirmSafety(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500/20"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-semibold text-orange-400">
                        Safety Confirmation Required
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">
                      I confirm that all safety procedures have been followed and it is safe to
                      execute this action.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Result Display */}
            {result && (
              <div
                className={`p-4 rounded-lg border ${
                  result.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold mb-2 ${
                        result.success ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {result.success ? 'Action Executed Successfully' : 'Action Failed'}
                    </p>
                    <pre className="text-xs bg-black/30 p-3 rounded overflow-x-auto">
                      {JSON.stringify(result.success ? result.data : result.error, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700 bg-gray-800/50">
            <button
              onClick={handleClose}
              className="px-6 py-2.5 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleTest}
              disabled={testing || (action.safety_critical && !confirmSafety)}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {testing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Execute Action</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
