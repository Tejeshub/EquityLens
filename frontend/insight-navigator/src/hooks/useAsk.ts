import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { AskRequest, AskResponse } from "@/types/api";
import { useToast } from "@/hooks/use-toast";

export const useAsk = () => {
  const { toast } = useToast();

  return useMutation<AskResponse, Error, AskRequest>({
    mutationFn: (request) => apiClient.ask(request),
    onError: (error) => {
      console.error("Ask error:", error);
      toast({
        title: "Question Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
