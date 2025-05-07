interface TokenResponse {
  access_token: string;
}

export const useAccessToken = async (): Promise<string> => {
  const accessTokenUrl = process.env.PG_API_ACCESS_TOKEN_URL!;
  const username = process.env.PG_API_GET_TOKEN_USERNAME!;
  const password = process.env.PG_API_GET_TOKEN_PASSWORD!;

  if (!(accessTokenUrl && username && password)) {
    throw new Error(
      "You must provide a valid username and password and access token url",
    );
  }

  const paramsForGettingToken = {
    username,
    password,
    grant_type: "password",
  };
  const urlEncodedParams = new URLSearchParams(
    paramsForGettingToken,
  ).toString();

  let accessToken = "";

  try {
    const response: TokenResponse = await $fetch(accessTokenUrl, {
      method: "POST",
      body: urlEncodedParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    });

    accessToken = response.access_token;
  } catch (e) {
    console.error("Inside useAccessToken error", e);
  }

  return accessToken;
};
