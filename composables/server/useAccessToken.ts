interface TokenResponse {
  access_token: string;
}

export const useAccessToken = async (): Promise<string> => {
  if (
    !process.env.PG_API_GET_TOKEN_USERNAME ||
    !process.env.PG_API_GET_TOKEN_PASSWORD
  ) {
    throw new Error("You must provide a valid username and password");
  }
  const accessTokenUrl = "https://api.personal-guide.ai/token";
  const paramsForGettingToken = {
    username: process.env.PG_API_GET_TOKEN_USERNAME,
    password: process.env.PG_API_GET_TOKEN_PASSWORD,
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
