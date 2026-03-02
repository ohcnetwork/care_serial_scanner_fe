import { ScannerSetupDialog } from "./ScannerSetupDialog.tsx";
import { useSerialBarcodeScanner } from "@/hooks/useSerialBarcodeScanner";
import { useWebSocketScanner } from "@/hooks/useWebSocketScanner";
import { Usb } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Props {
  facilityId: string;
  onScan: (scannedData: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * USB/Serial Scanner Button Component
 *
 * Provides USB-COM barcode scanner support via:
 * 1. Web Serial API (Chrome/Edge only)
 * 2. WebSocket bridge fallback (Firefox/Safari - requires bridge app)
 */
export default function SerialScannerButton({
  onScan,
  disabled = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const [showSetupDialog, setShowSetupDialog] = useState(false);

  // Serial port scanner (Web Serial API - Chromium only)
  const {
    isSupported: isSerialSupported,
    isConnected: isSerialConnected,
    isConnecting: isSerialConnecting,
    connect: connectSerial,
    error: serialError,
  } = useSerialBarcodeScanner({
    onScan,
    enabled: !disabled,
  });

  // WebSocket bridge scanner (fallback for non-Chromium browsers)
  const {
    isConnected: isWsBridgeConnected,
    isConnecting: isWsBridgeConnecting,
    connect: connectWsBridge,
    error: wsBridgeError,
  } = useWebSocketScanner({
    onScan,
    enabled: !disabled && !isSerialSupported,
    autoReconnect: true,
    autoConnectOnMount: true,
  });

  const isConnected = isSerialConnected || isWsBridgeConnected;
  const isConnecting = isSerialConnecting || isWsBridgeConnecting;

  // Toast notifications for status changes
  useEffect(() => {
    if (serialError) {
      toast.error(`Scanner error: ${serialError}`);
    }
  }, [serialError]);

  useEffect(() => {
    if (wsBridgeError) {
      toast.error(`Bridge error: ${wsBridgeError}`);
    }
  }, [wsBridgeError]);

  // Show connected indicator(TODO: need to change placing)
  if (isConnected) {
    return (
      <div className="relative flex items-center justify-center size-4">
        <div className="absolute size-1.5 rounded-full bg-green-600 animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowSetupDialog(true)}
        disabled={isConnecting || disabled}
        className={className}
        aria-label={t("connect_serial_scanner")}
        title={
          isSerialSupported
            ? t("connect_serial_scanner")
            : t("connect_scanner_bridge")
        }
      >
        {isConnecting ? (
          <div className="size-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Usb className="size-4" />
        )}
      </button>

      <ScannerSetupDialog
        isOpen={showSetupDialog}
        onClose={() => setShowSetupDialog(false)}
        onConnectSerial={connectSerial}
        onConnectWebSocket={connectWsBridge}
        isSerialSupported={isSerialSupported}
        isConnecting={isConnecting}
      />
    </>
  );
}
