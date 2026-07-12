import type { AxiosError } from "axios";

// Pulls the specific message the backend sent back, falling back to
// a generic one only when there genuinely isn't one, a real network
// failure, for example. Backend validation errors always carry a
// real message field, this is what surfaces those instead of hiding
// them behind one generic string every time.
export const getErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError?.response?.data?.message ?? fallback;
};