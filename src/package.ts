import { linkedPackage } from '@_linked/core/utils/Package';

export const liveSessionsPackageName = '@_linked/live-sessions' as const;
const registration = linkedPackage(liveSessionsPackageName);
export const { getPackageShape, linkedOntology, linkedShape, linkedUtil,
  packageExports, packageMetadata, registerPackageExport, registerPackageModule } = registration;
export const packageName = registration.packageName;
