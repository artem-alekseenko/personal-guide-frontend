// import buildCurlCommand from "~/utils/buildCurlCommand";

export const useExternalApi = async <T>(
  url: string,
  params: Record<string, string> = {},
  method: string = "GET",
) => {
  const accessToken = process.env.PG_API_AUTHORIZATION_TOKEN;
  const hasParams = Object.keys(params).length > 0;
  const urlEncodedParams = hasParams
    ? new URLSearchParams(params).toString()
    : "";

  let response: any = {};

  try {
    const requestOptions: any = {
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    if (hasParams) {
      if (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD") {
        url += `?${urlEncodedParams}`;
      } else {
        requestOptions.body = urlEncodedParams;
        requestOptions.headers["Content-Type"] =
          "application/x-www-form-urlencoded";
      }
    }

    // const curlCommand = buildCurlCommand(url, requestOptions);

    response = await $fetch<T>(url, requestOptions);
  } catch (error) {
    console.log("error", error);
    console.error("Inside useExternalApi error", error);
  }

  return response;
};
