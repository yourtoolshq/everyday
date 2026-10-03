import { useCallback } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    refresh: () => navigate(0),
  };
}

export function usePathname() {
  return useLocation().pathname;
}

export function redirect(href: string) {
  if (typeof window !== "undefined") {
    window.location.assign(href);
  }
  return null;
}

export function notFound() {
  throw new Error("Not Found");
}

export function useParamsShim<T extends Record<string, string>>() {
  return useParams() as T;
}

export function useSearchParamsShim() {
  return useSearchParams();
}

export function useCallbackRefresh() {
  const navigate = useNavigate();
  return useCallback(() => navigate(0), [navigate]);
}
