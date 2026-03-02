import { useCallback, useEffect, useRef, useState } from "react";

interface WebSocketScannerOptions {
  onScan: (barcode: string) => void;
  serverUrl?: string;
  enabled?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  autoConnectOnMount?: boolean;
}

interface WebSocketScannerState {
  isBridgeConnected: boolean;
  isScannerConnected: boolean;
  scannerPort: string | null;
  isConnecting: boolean;
  error: string | null;
}

interface WebSocketScannerReturn extends WebSocketScannerState {
  connect: () => void;

  disconnect: () => void;
  requestStatus: () => void;
  // Legacy alias.
  isConnected: boolean;
}

// Check if bridge is running via HTTP health check
async function checkBridgeAvailable(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:7001/health", {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    const data = await response.json();
    return data.status === "ok" && data.connected === true;
  } catch {
    return false;
  }
}

export function useWebSocketScanner({
  onScan,
  serverUrl = "ws://localhost:7001/ws",
  enabled = true,
  autoReconnect = true,
  reconnectInterval = 3000,
  autoConnectOnMount = true,
}: WebSocketScannerOptions): WebSocketScannerReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasConnectedBeforeHiddenRef = useRef<boolean>(false);
  const hasAutoConnectedRef = useRef<boolean>(false);

  const [state, setState] = useState<WebSocketScannerState>({
    isBridgeConnected: false,
    isScannerConnected: false,
    scannerPort: null,
    isConnecting: false,
    error: null,
  });

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState((s) => ({
      ...s,
      isBridgeConnected: false,
      isScannerConnected: false,
      scannerPort: null,
      isConnecting: false,
    }));
  }, [clearReconnectTimeout]);

  const requestStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "status" }));
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    clearReconnectTimeout();
    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(serverUrl);

      ws.onopen = () => {
        setState((s) => ({
          ...s,
          isBridgeConnected: true,
          isConnecting: false,
          error: null,
        }));
        ws.send(JSON.stringify({ type: "status" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "status" && data.payload) {
            setState((s) => ({
              ...s,
              isScannerConnected: data.payload.connected === true,
              scannerPort: data.payload.currentPort || null,
            }));
          } else if (data.type === "scan" && data.payload?.barcode) {
            onScanRef.current(data.payload.barcode.trim());
          } else if (data.type === "scan" && data.data) {
            onScanRef.current(data.data.trim());
          }
        } catch {
          if (typeof event.data === "string" && event.data.trim()) {
            onScanRef.current(event.data.trim());
          }
        }
      };

      ws.onerror = () => {
        setState((s) => ({ ...s, error: "WebSocket connection error" }));
      };

      ws.onclose = () => {
        wsRef.current = null;
        setState((s) => ({
          ...s,
          isBridgeConnected: false,
          isScannerConnected: false,
          scannerPort: null,
          isConnecting: false,
        }));

        if (autoReconnect && enabled) {
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      setState({
        isBridgeConnected: false,
        isScannerConnected: false,
        scannerPort: null,
        isConnecting: false,
        error: error instanceof Error ? error.message : "Failed to connect",
      });
    }
  }, [
    serverUrl,
    autoReconnect,
    enabled,
    reconnectInterval,
    clearReconnectTimeout,
  ]);

  useEffect(() => {
    if (!autoReconnect) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasConnectedBeforeHiddenRef.current = state.isBridgeConnected;
        disconnect();
      } else {
        if (enabled) {
          checkBridgeAvailable().then((available) => {
            if (available) {
              connect();
            }
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [autoReconnect, state.isBridgeConnected, enabled, connect, disconnect]);

  // Auto-connect on mount if bridge is available
  useEffect(() => {
    if (!enabled || !autoConnectOnMount || hasAutoConnectedRef.current) return;

    checkBridgeAvailable().then((available) => {
      if (available && !wsRef.current) {
        hasAutoConnectedRef.current = true;
        connect();
      }
    });
  }, [enabled, autoConnectOnMount, connect]);

  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      wsRef.current?.close();
    };
  }, [clearReconnectTimeout]);

  const isConnected = state.isBridgeConnected && state.isScannerConnected;

  return {
    ...state,
    connect,
    disconnect,
    requestStatus,
    isConnected,
  };
}

export default useWebSocketScanner;
