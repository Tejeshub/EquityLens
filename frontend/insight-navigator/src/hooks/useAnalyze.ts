import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { EquityResearchRequest, EquityResearchResponse } from "@/types/api";
import { useToast } from "@/hooks/use-toast";

export const useAnalyze = () => {
  const { toast } = useToast();

  return useMutation<EquityResearchResponse, Error, EquityResearchRequest>({
    mutationFn: (request) => apiClient.analyze(request),
    onError: (error) => {
      console.error("Analyze error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      console.log("Analysis success:", data);
      if (data.execution_status === "failed" || data.error) {
        toast({
          title: "Analysis Warning",
          description: data.error || "Analysis completed with warnings",
          variant: "default",
        });
      }
    },
  });
};
