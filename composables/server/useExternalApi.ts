export const useExternalApi = async <T>(
    url: string,
    params: Record<string, string> = {},
    method: string = "GET",
) => {
    // const accessToken = await useAccessToken();
    const accessToken = process.env.PG_API_GUIDES_TOKEN;
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
            requestOptions.body = urlEncodedParams;
        }

        response = await $fetch<T>(url, requestOptions);
    } catch (error) {
        console.error("Inside useExternalApi error", error);
    }

    return response;
};
