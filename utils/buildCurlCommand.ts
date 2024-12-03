export default (url: string, options: RequestInit): string => {
  let command = `curl -X ${options.method} '${url}'`;

  if (options.headers) {
    let headersArray: [string, string][] = [];

    if (options.headers instanceof Headers) {
      headersArray = Array.from(options.headers.entries());
    } else if (typeof options.headers === "object") {
      headersArray = Object.entries(options.headers);
    }

    for (const [key, value] of headersArray) {
      command += ` -H '${key}: ${value}'`;
    }
  }

  if (options.body) {
    command += ` -d '${options.body}'`;
  }

  return command;
};
