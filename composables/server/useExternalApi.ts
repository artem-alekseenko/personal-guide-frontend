import type { TRequestMethod } from "~/types";

export const useExternalApi = async <T>(
  url: string,
  params: Record<string, string> = {},
  method: TRequestMethod = "GET",
): Promise<T> => {
  const accessToken = process.env.PG_API_AUTHORIZATION_TOKEN;
  const hasParams = Object.keys(params).length > 0;
  const urlEncodedParams = hasParams
    ? new URLSearchParams(params).toString()
    : "";

  let response: Promise<T>;

  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
  });

  const requestOptions: RequestInit = {
    method: method as TRequestMethod,
    headers: headers,
  };

  if (hasParams) {
    if (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD") {
      url += `?${urlEncodedParams}`;
    } else {
      requestOptions.body = urlEncodedParams;
      headers.append("Content-Type", "application/x-www-form-urlencoded");
    }
  }

  try {
    // @ts-ignore
    response = await $fetch<T>(url, requestOptions);
  } catch (error) {
    console.error("Inside useExternalApi error", error);
    throw error;
  }
  return response;
};
