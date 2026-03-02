/* eslint-disable no-empty */
import { useCallback, useEffect, useRef, useState } from "react";

interface SerialScannerOptions {
  onScan: (barcode: string) => void;
  baudRate?: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "even" | "odd";
  enabled?: boolean;
  autoReconnect?: boolean;
}

interface SerialScannerState {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  portInfo: SerialPortInfo | null;
}

interface SerialScannerReturn extends SerialScannerState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
}

export function useSerialBarcodeScanner({
  onScan,
  baudRate = 9600,
  dataBits = 8,
  stopBits = 1,
  parity = "none",
  enabled = true,
  autoReconnect = true,
}: SerialScannerOptions): SerialScannerReturn {
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );
  const isReadingRef = useRef<boolean>(false);
  const bufferRef = useRef<string>("");
  const wasConnectedBeforeHiddenRef = useRef<boolean>(false);

  const [state, setState] = useState<SerialScannerState>({
    isSupported: typeof navigator !== "undefined" && "serial" in navigator,
    isConnected: false,
    isConnecting: false,
    error: null,
    portInfo: null,
  });

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const processData = useCallback((text: string) => {
    for (const char of text) {
      if (char === "\r" || char === "\n") {
        const barcode = bufferRef.current.trim();
        if (barcode.length > 0) {
          onScanRef.current(barcode);
        }
        bufferRef.current = "";
      } else {
        bufferRef.current += char;
      }
    }
  }, []);

  const startReading = useCallback(
    async (port: SerialPort) => {
      if (!port.readable || isReadingRef.current) return;

      isReadingRef.current = true;
      const decoder = new TextDecoder();

      try {
        const reader = port.readable.getReader();
        readerRef.current = reader;

        while (isReadingRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const text = decoder.decode(value, { stream: true });
            processData(text);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "NetworkError") {
          console.error("[SerialScanner] Read error:", error);
          setState((s) => ({
            ...s,
            error:
              error instanceof Error ? error.message : "Failed to read data",
          }));
        }
      } finally {
        isReadingRef.current = false;
        if (readerRef.current) {
          try {
            await readerRef.current.cancel();
          } catch {}
          try {
            readerRef.current.releaseLock();
          } catch {}
          readerRef.current = null;
        }
      }
    },
    [processData],
  );

  const stopReading = useCallback(async () => {
    isReadingRef.current = false;
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch {}
      try {
        readerRef.current.releaseLock();
      } catch {}
      readerRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!state.isSupported || !navigator.serial) {
      setState((s) => ({ ...s, error: "Web Serial API not supported" }));
      return;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      // Close any existing connection first
      if (portRef.current) {
        try {
          await stopReading();
          await portRef.current.close();
        } catch {
          // Ignore errors when closing
        }
        portRef.current = null;
      }

      const port = await navigator.serial.requestPort();

      // Try to open with specified baud rate
      const baudRatesToTry = [baudRate, 9600, 115200, 19200, 38400].filter(
        (rate, index, arr) => arr.indexOf(rate) === index,
      );

      let opened = false;
      let lastError: Error | null = null;

      for (const rate of baudRatesToTry) {
        try {
          await port.open({ baudRate: rate, dataBits, stopBits, parity });
          opened = true;
          break;
        } catch (e) {
          lastError = e as Error;
          // If port is already open, we need to close it first
          try {
            await port.close();
          } catch {}
        }
      }

      if (!opened) {
        throw lastError || new Error("Failed to open port with any baud rate");
      }

      portRef.current = port;
      const portInfo = port.getInfo();

      setState((s) => ({
        ...s,
        isConnected: true,
        isConnecting: false,
        error: null,
        portInfo,
      }));

      startReading(port);
    } catch (error) {
      if ((error as Error).name === "NotFoundError") {
        setState((s) => ({ ...s, isConnecting: false, error: null }));
        return;
      }
      setState((s) => ({
        ...s,
        isConnected: false,
        isConnecting: false,
        error: error instanceof Error ? error.message : "Failed to connect",
      }));
    }
  }, [
    state.isSupported,
    baudRate,
    dataBits,
    stopBits,
    parity,
    startReading,
    stopReading,
  ]);

  const disconnect = useCallback(async () => {
    await stopReading();
    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {}
      portRef.current = null;
    }
    bufferRef.current = "";
    setState((s) => ({
      ...s,
      isConnected: false,
      error: null,
      portInfo: null,
    }));
  }, [stopReading]);

  const reconnect = useCallback(async () => {
    if (!state.isSupported || !navigator.serial) return;

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const ports = await navigator.serial.getPorts();
      if (ports.length === 0) {
        setState((s) => ({
          ...s,
          isConnecting: false,
          error: "No ports found",
        }));
        return;
      }

      const port = ports[0];
      await port.open({ baudRate, dataBits, stopBits, parity });

      portRef.current = port;
      const portInfo = port.getInfo();

      setState((s) => ({
        ...s,
        isConnected: true,
        isConnecting: false,
        error: null,
        portInfo,
      }));

      startReading(port);
    } catch (error) {
      setState((s) => ({
        ...s,
        isConnected: false,
        isConnecting: false,
        error: error instanceof Error ? error.message : "Failed to reconnect",
      }));
    }
  }, [state.isSupported, baudRate, dataBits, stopBits, parity, startReading]);

  // Auto-reconnect on mount
  useEffect(() => {
    let mounted = true;
    const tryAutoReconnect = async () => {
      if (
        !autoReconnect ||
        !enabled ||
        !state.isSupported ||
        state.isConnected ||
        state.isConnecting
      )
        return;
      try {
        const ports = await navigator.serial?.getPorts();
        if (ports?.length > 0 && mounted) {
          setTimeout(() => mounted && reconnect(), 100);
        }
      } catch {}
    };
    tryAutoReconnect();
    return () => {
      mounted = false;
    };
  }, [autoReconnect, enabled, state.isSupported]);

  // Tab visibility handling
  useEffect(() => {
    if (!state.isSupported || !autoReconnect) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasConnectedBeforeHiddenRef.current = state.isConnected;
        if (state.isConnected) disconnect();
      } else {
        if (wasConnectedBeforeHiddenRef.current && enabled) {
          setTimeout(() => reconnect(), 200);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [
    state.isSupported,
    state.isConnected,
    autoReconnect,
    enabled,
    disconnect,
    reconnect,
  ]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopReading();
      portRef.current?.close().catch(() => {});
    };
  }, [stopReading]);

  return { ...state, connect, disconnect, reconnect };
}

export default useSerialBarcodeScanner;
