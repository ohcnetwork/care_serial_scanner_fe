import routes from "./routes";
import { lazy } from "react";

const SerialScannerButton = lazy(
  () => import("./components/SerialScannerButton"),
);

const manifest = {
  plugin: "care_serial_scanner_fe",
  routes,
  extends: [],
  components: {
    PatientIdentifierFilterActions: SerialScannerButton,
  },
  devices: [],
} as const;

export default manifest;
