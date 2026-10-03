import { Navigate } from "react-router-dom";

import { getAuthToken, isRemoteHostUrl } from "../lib/auth";
import { getHostUrl } from "../lib/host";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const hostUrl = getHostUrl();
  if (!isRemoteHostUrl(hostUrl)) return children;
  if (getAuthToken()) return children;
  return <Navigate to="/pair" replace />;
}
