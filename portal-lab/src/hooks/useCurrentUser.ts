import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { UserDto } from "../../convex/users/index";

export function useCurrentUser(): {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserDto | null;
} {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.queries.me, isAuthenticated ? {} : "skip");
  return { isLoading, isAuthenticated, user: user ?? null };
}
