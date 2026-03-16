import useSWR from "swr";
import type { PRType } from "@/lib/pr-type";

export interface PRTypeStats {
  type: PRType;
  total: number;
  merged: number;
  closed: number;
  open: number;
  mergeRate: number;
  avgDiffSize: number;
}

export interface PRTypeSummary {
  totalPRs: number;
  totalMerged: number;
  overallMergeRate: number;
  bestType: PRType | null;
  bestTypeMergeRate: number;
  easyWinRatio: number;
  easyWinMergeRate: number;
  easyWinTotal: number;
  easyWinMerged: number;
}

interface PRTypesResponse {
  types: PRTypeStats[];
  summary: PRTypeSummary;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePRTypes() {
  const { data, error, isLoading } = useSWR<PRTypesResponse>(
    "/api/metrics/pr-types",
    fetcher,
    { refreshInterval: 120000 }
  );
  return {
    types: data?.types,
    summary: data?.summary,
    error,
    isLoading,
  };
}
