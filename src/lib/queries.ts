import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { fetchCategories, fetchCurrentPlan, fetchFavoriteIds, fetchPrefs, fetchRecipes, fetchPlannerRecipes, fetchDietOptions } from "./data";

export function useUid() {
  return useAuth().session?.user.id;
}

export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
export const useDietOptions = () => useQuery({ queryKey: ["diet_options"], queryFn: fetchDietOptions });
export const useRecipes = () => useQuery({ queryKey: ["recipes"], queryFn: fetchRecipes });
export const usePlannerRecipes = () => useQuery({ queryKey: ["planner_recipes"], queryFn: fetchPlannerRecipes });

export function usePrefs() {
  const uid = useUid();
  return useQuery({ queryKey: ["prefs", uid], queryFn: () => fetchPrefs(uid!), enabled: !!uid });
}
export function useCurrentPlan() {
  const uid = useUid();
  return useQuery({ queryKey: ["plan", uid], queryFn: () => fetchCurrentPlan(uid!), enabled: !!uid });
}
export function useFavorites() {
  const uid = useUid();
  return useQuery({ queryKey: ["favorites", uid], queryFn: () => fetchFavoriteIds(uid!), enabled: !!uid });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
