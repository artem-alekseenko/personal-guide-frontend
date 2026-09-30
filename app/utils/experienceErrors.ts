type ApiError = {
  statusCode?: number;
  status?: number;
  response?: { status?: number };
  data?: { code?: string; data?: { code?: string } };
};
export function experienceErrorKey(error: unknown): string {
  const failure = (error ?? {}) as ApiError;
  const code = failure.data?.data?.code ?? failure.data?.code;
  const status =
    failure.statusCode ?? failure.status ?? failure.response?.status;
  if (code === "provider_unavailable") return "experience.modelUnavailable";
  if (status === 409) return "experience.conflict";
  if (status === 401 || status === 403) return "experience.authFailed";
  if (status === 404) return "experience.unavailable";
  if (status === 400 || status === 422) return "experience.invalidAction";
  return "experience.failed";
}
