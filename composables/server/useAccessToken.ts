interface TokenResponse {
  access_token: string;
}

export const useAccessToken = async (): Promise<string> => {
  const accessTokenUrl = "https://api.personal-guide.ai/token";
  const paramsForGettingToken = {
    username: "abba",
    password: "123",
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
