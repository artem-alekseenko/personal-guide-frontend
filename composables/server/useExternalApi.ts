import type { TRequestMethod } from "~/types";

/**
 * Makes an HTTP request to an external API with optional parameters and method.
 * Automatically includes an authorization token from environment variables.
 *
 * @template T The expected response type.
 * @param {string} url - The endpoint URL to send the request to.
 * @param {Record<string, string>} [params={}] - An object containing query parameters or body parameters.
 * @param {TRequestMethod} [method='GET'] - The HTTP method to use for the request.
 * @returns {Promise<T>} A promise that resolves to the response of type T.
 * @throws Will throw an error if the HTTP request fails.
 */
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

  const headers = new Headers();
  headers.append("Authorization", `Bearer ${accessToken}`);

  const requestOptions: RequestInit = {
    method,
    headers,
  };

  if (hasParams) {
    if (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD") {
      url += `?${urlEncodedParams}`;
    } else {
      requestOptions.body = JSON.stringify(params);
      headers.append("Content-Type", "application/json");
    }
  }

  try {
    // @ts-ignore
    return await $fetch<T>(url, requestOptions);
  } catch (error) {
    console.error("Inside useExternalApi error", error);
    throw error;
  }
};
