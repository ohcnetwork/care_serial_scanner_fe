import { Check, Download, Loader2, Monitor, Usb } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
      fill="currentColor"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

interface ScannerSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSerial: () => void;
  onConnectWebSocket: () => void;
  isSerialSupported: boolean;
  isConnecting: boolean;
}

async function checkBridgeHealth(): Promise<{
  bridgeRunning: boolean;
  scannerConnected: boolean;
  port: string | null;
}> {
  try {
    const response = await fetch("http://localhost:7001/health", {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    const data = await response.json();
    return {
      bridgeRunning: data.status === "ok",
      scannerConnected: data.connected === true,
      port: data.port || null,
    };
  } catch {
    return { bridgeRunning: false, scannerConnected: false, port: null };
  }
}

type Platform = "macos" | "windows" | "linux" | "unknown";

function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("mac")) return "macos";
  if (userAgent.includes("win")) return "windows";
  if (userAgent.includes("linux")) return "linux";
  return "unknown";
}

function getBrowserName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg"))
    return "Chrome";
  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome"))
    return "Safari";
  return "your browser";
}

const DOWNLOAD_LINKS = {
  macos:
    import.meta.env.VITE_SCANNER_BRIDGE_DOWNLOAD_MACOS ||
    "https://github.com/ohcnetwork/care_scanner_bridge/releases/latest/download/care-scanner-bridge-macos.dmg",
  windows:
    import.meta.env.VITE_SCANNER_BRIDGE_DOWNLOAD_WINDOWS ||
    "https://github.com/ohcnetwork/care_scanner_bridge/releases/latest/download/care-scanner-bridge-setup.exe",
  linux:
    import.meta.env.VITE_SCANNER_BRIDGE_DOWNLOAD_LINUX ||
    "https://github.com/ohcnetwork/care_scanner_bridge/releases/latest/download/care-scanner-bridge-linux.AppImage",
  unknown:
    import.meta.env.VITE_SCANNER_BRIDGE_GITHUB ||
    "https://github.com/ohcnetwork/care_scanner_bridge/releases",
};

const PLATFORM_LABELS = {
  macos: "macOS (.dmg)",
  windows: "Windows (.exe)",
  linux: "Linux (.AppImage)",
  unknown: "All Platforms",
};

export function ScannerSetupDialog({
  isOpen,
  onClose,
  onConnectSerial,
  onConnectWebSocket,
  isSerialSupported,
  isConnecting,
}: ScannerSetupDialogProps) {
  const { t } = useTranslation();
  const [healthStatus, setHealthStatus] = useState<{
    bridgeRunning: boolean;
    scannerConnected: boolean;
    port: string | null;
  }>({ bridgeRunning: false, scannerConnected: false, port: null });

  const platform = detectPlatform();
  const browserName = getBrowserName();

  const isBridgeConnected = healthStatus.bridgeRunning;
  const isScannerConnected = healthStatus.scannerConnected;
  const scannerPort = healthStatus.port;

  // Check bridge status via HTTP when dialog opens and periodically
  useEffect(() => {
    if (!isOpen || isSerialSupported) return;

    checkBridgeHealth().then(setHealthStatus);

    const interval = setInterval(() => {
      checkBridgeHealth().then(setHealthStatus);
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, isSerialSupported]);

  // Auto-connect and close when both bridge and scanner are ready
  useEffect(() => {
    if (!isOpen || isSerialSupported) return;

    if (isBridgeConnected && isScannerConnected) {
      onConnectWebSocket();
      onClose();
    }
  }, [
    isOpen,
    isSerialSupported,
    isBridgeConnected,
    isScannerConnected,
    onConnectWebSocket,
    onClose,
  ]);

  const handleStartScanning = () => {
    onConnectWebSocket();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Usb className="size-5 text-blue-600" />
            {t("connect_barcode_scanner")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isSerialSupported ? (
            /* Chrome/Edge - Web Serial API */
            <>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <Monitor className="size-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-medium text-green-900 dark:text-green-100">
                      {t("direct_connection_available")}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      {t("direct_connection_description", { browserName })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {t("steps")}
                </h4>
                <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex gap-2">
                    <span className="shrink-0 size-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-medium">
                      1
                    </span>
                    <span>{t("step_connect_scanner_usb")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 size-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-medium">
                      2
                    </span>
                    <span>{t("step_click_connect_scanner")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 size-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-medium">
                      3
                    </span>
                    <span>{t("step_select_scanner_popup")}</span>
                  </li>
                </ol>
              </div>

              <Button
                onClick={onConnectSerial}
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("connecting")}
                  </>
                ) : (
                  <>
                    <Usb className="size-4" />
                    {t("connect_scanner")}
                  </>
                )}
              </Button>
            </>
          ) : (
            /* Firefox/Safari - Need Bridge App */
            <>
              {/* Status indicators */}
              <div className="space-y-2">
                {/* Bridge Status */}
                <div
                  className={cn(
                    "p-3 rounded-lg border flex items-center gap-3",
                    isBridgeConnected
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
                  )}
                >
                  <div
                    className={cn(
                      "size-3 rounded-full bg-gray-400",
                      isBridgeConnected && "bg-green-500",
                    )}
                  />
                  <div className="flex-1">
                    <span
                      className={cn(
                        "text-sm font-medium text-gray-600 dark:text-gray-300",
                        isBridgeConnected &&
                          "text-green-900 dark:text-green-100",
                      )}
                    >
                      {t("bridge_app")}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-xs text-gray-500 dark:text-gray-400",
                      isBridgeConnected && "text-green-700 dark:text-green-300",
                    )}
                  >
                    {isBridgeConnected ? t("running") : t("not_running")}
                  </span>
                </div>

                {/* Scanner Status */}
                <div
                  className={cn(
                    "p-3 rounded-lg border flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
                    isScannerConnected &&
                      "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                  )}
                >
                  <div
                    className={cn(
                      "size-3 rounded-full bg-gray-400",
                      isScannerConnected && "bg-green-500",
                    )}
                  />
                  <div className="flex-1">
                    <span
                      className={cn(
                        "text-sm font-medium text-gray-600 dark:text-gray-300",
                        isScannerConnected &&
                          "text-green-900 dark:text-green-100",
                      )}
                    >
                      {t("scanner")}
                    </span>
                    {scannerPort && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        ({scannerPort})
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs text-gray-500 dark:text-gray-400",
                      isScannerConnected &&
                        "text-green-700 dark:text-green-300",
                    )}
                  >
                    {isScannerConnected ? t("connected") : t("not_connected")}
                  </span>
                </div>
              </div>

              {/* Show success message if both connected */}
              {isBridgeConnected && isScannerConnected ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-3">
                    <Check className="size-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-medium text-green-900 dark:text-green-100">
                        {t("ready_to_scan")}
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        {t("scanner_ready_description")}
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleStartScanning} className="w-full mt-3">
                    {t("start_scanning")}
                  </Button>
                </div>
              ) : isBridgeConnected && !isScannerConnected ? (
                /* Bridge running but no scanner */
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <Usb className="size-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-medium text-amber-900 dark:text-amber-100">
                        {t("scanner_not_connected")}
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {t("scanner_not_connected_description")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Need to download/run bridge */
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <Download className="size-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-medium text-amber-900 dark:text-amber-100">
                        {t("bridge_app_required")}
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {t("bridge_app_required_description", { browserName })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Steps - only show if not fully connected */}
              {!(isBridgeConnected && isScannerConnected) && (
                <div className="space-y-3">
                  <h5 className="font-medium text-gray-900 dark:text-white">
                    {t("setup_steps")}
                  </h5>
                  <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex gap-2">
                      <span
                        className={cn(
                          "shrink-0 size-5 rounded-full flex items-center justify-center text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
                          isBridgeConnected &&
                            "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
                        )}
                      >
                        {isBridgeConnected ? "✓" : "1"}
                      </span>
                      <span
                        className={cn(
                          isBridgeConnected && "line-through text-gray-400",
                        )}
                      >
                        {t("step_download_install_bridge")}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span
                        className={cn(
                          "shrink-0 size-5 rounded-full flex items-center justify-center text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
                          isBridgeConnected &&
                            "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 ",
                        )}
                      >
                        {isBridgeConnected ? "✓" : "2"}
                      </span>
                      <span
                        className={cn(
                          isBridgeConnected && "line-through text-gray-400",
                        )}
                      >
                        {t("step_launch_app")}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span
                        className={cn(
                          "shrink-0 size-5 rounded-full flex items-center justify-center text-xs font-medium",
                          isScannerConnected
                            ? "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
                            : "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
                        )}
                      >
                        {isScannerConnected ? "✓" : "3"}
                      </span>
                      <span
                        className={cn(
                          isScannerConnected && "line-through text-gray-400",
                        )}
                      >
                        {t("step_select_scanner_port")}
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              {/* Download Button - only show if bridge not running */}
              {!isBridgeConnected && (
                <Button asChild className="w-full cursor-pointer">
                  <a
                    href={DOWNLOAD_LINKS[platform]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="size-4" />
                    {t("download_for", {
                      platform: PLATFORM_LABELS[platform],
                    })}
                  </a>
                </Button>
              )}

              {/* GitHub link */}
              <Button
                variant="link"
                asChild
                className="w-full text-xs text-muted-foreground cursor-pointer"
              >
                <a
                  href={DOWNLOAD_LINKS.unknown}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GithubIcon className="size-4" />
                  {t("for_other_platforms")}
                </a>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
